// 파싱된 ParsedIntakeForm[] → DB INSERT
// POST: { items: ParsedIntakeForm[], duplicateMode: "skip" | "addCase" }
//   skip: rrn 중복 시 해당 항목 skip
//   addCase: rrn 중복 시 기존 Patient에 새 Case 추가
// Response: { ok, created, skipped, failed, errors }

export const maxDuration = 120;
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ParsedIntakeForm, mapCaseType } from "@/lib/intake-form-parser";

const ALLOWED_ROLES = ["ADMIN", "조직관리자"];
const BATCH_SIZE = 50;

type CommitItem = ParsedIntakeForm & {
  selected?: boolean;
};

type CommitError = {
  fileName: string;
  patientName: string | null;
  reason: string;
};

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!ALLOWED_ROLES.includes(session.user.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: {
    items?: CommitItem[];
    duplicateMode?: "skip" | "addCase";
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON 파싱 실패" }, { status: 400 });
  }

  const items = (body.items || []).filter((i) => i && i.ok);
  const duplicateMode = body.duplicateMode === "addCase" ? "addCase" : "skip";

  if (items.length === 0) {
    return NextResponse.json({ error: "import할 항목이 없습니다" }, { status: 400 });
  }

  // 사전: User 매핑 (대리인 이름 → User.id)
  const users = await prisma.user.findMany({ select: { id: true, name: true } });
  const userByName = new Map<string, string>();
  for (const u of users) {
    if (u.name) userByName.set(u.name.trim(), u.id);
  }

  // 사전: 기존 Patient rrn 맵
  const existingPatients = await prisma.patient.findMany({
    select: { id: true, ssn: true },
  });
  const patientBySsn = new Map<string, string>();
  for (const p of existingPatients) patientBySsn.set(p.ssn, p.id);

  let created = 0;
  let skipped = 0;
  let failed = 0;
  const errors: CommitError[] = [];

  // 배치 단위로 트랜잭션 (긴 트랜잭션 timeout 방지)
  for (let bs = 0; bs < items.length; bs += BATCH_SIZE) {
    const batch = items.slice(bs, bs + BATCH_SIZE);

    for (const item of batch) {
      try {
        if (!item.patientName || !item.patientRrn) {
          failed++;
          errors.push({
            fileName: item.fileName,
            patientName: item.patientName,
            reason: "근로자 성명 또는 주민번호가 없음",
          });
          continue;
        }

        const caseType = item.caseTypeCode || mapCaseType(item.caseType) || "OTHER";

        // 1. Patient upsert (rrn 중복 → 기존 사용)
        const existingPatientId = patientBySsn.get(item.patientRrn);

        // 2. duplicate mode가 skip인데 이미 존재하면 skip
        if (existingPatientId && duplicateMode === "skip") {
          skipped++;
          continue;
        }

        await prisma.$transaction(async (tx) => {
          let patientId: string;

          if (existingPatientId) {
            patientId = existingPatientId;
            // 정보 보강 (빈 필드만 채움)
            await tx.patient.update({
              where: { id: existingPatientId },
              data: {
                phone: item.patientPhone ?? undefined,
                address: item.patientAddress ?? undefined,
              },
            });
          } else {
            const p = await tx.patient.create({
              data: {
                name: item.patientName!,
                ssn: item.patientRrn!,
                phone: item.patientPhone,
                address: item.patientAddress,
              },
            });
            patientId = p.id;
            patientBySsn.set(item.patientRrn!, p.id);
          }

          // 3. 대리인 매칭 (User name 기준)
          const caseManagerId = item.agentName
            ? userByName.get(item.agentName.trim()) ?? null
            : null;

          // 4. Case 생성 (같은 patient + 같은 caseType이면 신규 생성하지 않고 skip 카운트)
          //    addCase 모드여도 동일 caseType 중복은 의미 없음
          const existingCase = await tx.case.findFirst({
            where: { patientId, caseType },
            select: { id: true },
          });

          if (existingCase) {
            // 같은 사건 이미 있음 → skip
            // (트랜잭션 안에서 외부 카운터를 직접 증감하지 않고 throw로 빠져나가 외부에서 처리)
            throw new SkipMarker("동일 caseType 사건이 이미 존재함");
          }

          // 대리인 평문 정보 (subAgent에 요약 보관)
          const subAgentSummary = item.agentName
            ? [
                item.agentName,
                item.agentBranch ? `(${item.agentBranch})` : "",
                item.agentLicenseNo ? `직무개시 ${item.agentLicenseNo}` : "",
                item.agentMobile ? `M:${item.agentMobile}` : "",
                item.agentTel ? `T:${item.agentTel}` : "",
                item.agentFax ? `F:${item.agentFax}` : "",
              ]
                .filter(Boolean)
                .join(" ")
            : null;

          const caseRecord = await tx.case.create({
            data: {
              patientId,
              caseType,
              status: "CONSULTING",
              tfName: item.tfName ?? null,
              branch: item.branchName ?? null,
              caseManagerId,
              subAgent: subAgentSummary,
              receptionDate: item.receptionDate ? new Date(item.receptionDate) : null,
              introducer: item.introducer ?? null,
              salesStaff: item.salesStaff ?? null,
              caseChannel: item.caseChannel ?? null,
              preliminaryConsult: item.preliminaryConsult ?? null,
              memo:
                Object.keys(item.rawLabels || {}).length > 0
                  ? `[자료입력서식 import]\n파일: ${item.fileName}`
                  : null,
            },
          });

          // 5. 난청이고 특별진찰/전문조사 정보가 있으면 HearingLossDetail 생성
          if (
            caseType === "HEARING_LOSS" &&
            (item.specialClinic || item.expertClinic)
          ) {
            await tx.hearingLossDetail.create({
              data: {
                caseId: caseRecord.id,
                specialClinic: item.specialClinic ?? null,
                expertClinic: item.expertClinic ?? null,
              },
            });
          }
        });

        created++;
      } catch (e) {
        if (e instanceof SkipMarker) {
          skipped++;
        } else {
          failed++;
          errors.push({
            fileName: item.fileName,
            patientName: item.patientName,
            reason: e instanceof Error ? e.message : "알 수 없는 오류",
          });
        }
      }
    }
  }

  return NextResponse.json({
    ok: true,
    total: items.length,
    created,
    skipped,
    failed,
    errors,
  });
}

// 트랜잭션 안에서 "skip"을 외부로 알리는 마커
class SkipMarker extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "SkipMarker";
  }
}
