// 자료입력서식 .xls/.xlsx 다중 파일 파싱 (DB 저장 없음)
// POST multipart/form-data: files[]
// Response: { ok, parsed: ParsedIntakeForm[] }

export const maxDuration = 60;
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { parseIntakeFormBuffer, ParsedIntakeForm } from "@/lib/intake-form-parser";

const ALLOWED_ROLES = ["ADMIN", "조직관리자"];

export async function POST(req: NextRequest) {
  // 1. 권한 체크
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!ALLOWED_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 2. multipart 파싱
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch (e) {
    return NextResponse.json(
      { error: "multipart 파싱 실패", detail: e instanceof Error ? e.message : null },
      { status: 400 }
    );
  }

  const files: File[] = [];
  for (const [key, value] of formData.entries()) {
    if ((key === "files" || key === "files[]") && value instanceof File) {
      files.push(value);
    }
  }

  if (files.length === 0) {
    return NextResponse.json({ error: "업로드된 파일이 없습니다" }, { status: 400 });
  }

  // 너무 많은 파일은 제한
  if (files.length > 200) {
    return NextResponse.json(
      { error: `한 번에 최대 200개까지 업로드 가능 (현재 ${files.length}개)` },
      { status: 400 }
    );
  }

  // 3. 파일별 파싱
  const parsed: ParsedIntakeForm[] = [];
  for (const file of files) {
    try {
      const ab = await file.arrayBuffer();
      const buf = Buffer.from(ab);
      const result = parseIntakeFormBuffer(buf, file.name);
      parsed.push(result);
    } catch (e) {
      parsed.push({
        fileName: file.name,
        ok: false,
        error: e instanceof Error ? e.message : "파싱 중 오류",
        patientName: null,
        patientRrn: null,
        patientPhone: null,
        patientAddress: null,
        caseType: null,
        caseTypeCode: null,
        tfName: null,
        branchName: null,
        receptionDate: null,
        introducer: null,
        salesStaff: null,
        caseChannel: null,
        preliminaryConsult: null,
        agentName: null,
        agentBranch: null,
        agentBirthDate: null,
        agentGender: null,
        agentAddress: null,
        agentLicenseNo: null,
        agentMobile: null,
        agentTel: null,
        agentFax: null,
        specialClinic: null,
        expertClinic: null,
        rawLabels: {},
      });
    }
  }

  return NextResponse.json({
    ok: true,
    total: parsed.length,
    parsedOk: parsed.filter((p) => p.ok).length,
    parsedFail: parsed.filter((p) => !p.ok).length,
    parsed,
  });
}
