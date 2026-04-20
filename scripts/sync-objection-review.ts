/**
 * 처분검토 데이터 정합성 동기화 (1회성 배치)
 *
 * 작업 내용
 *  A) 엑셀 최초총현황 1~851행(박정호8까지)에 해당하는 ObjectionReview는 종결 처리
 *     단, ObjectionCase(기일관리)에 이미 등록된 건은 건드리지 않음
 *  B) progressStatus="이의제기 진행"인 ObjectionReview 중
 *     대응하는 ObjectionCase가 없는 것들은 생성
 *  C) approvalStatus="승인"인 ObjectionReview 중
 *     대응하는 WageReviewData가 없는 것들은 생성
 *
 * 실행
 *   DATABASE_URL="..." node --experimental-strip-types scripts/sync-objection-review.ts
 */
import { PrismaClient } from "@prisma/client";
import XLSX from "xlsx";

const prisma = new PrismaClient();

const TF_MAP: Record<string, string> = {
  "울산": "더보상울산TF",
  "울동": "더보상울동TF",
  "울산동부": "이산울산동부TF",
  "울산남부": "이산울산남부TF",
  "울산북부": "이산울산북부TF",
  "양산": "이산양산TF",
  "울산동부,구미": "이산울산동부TF",
};

function mapCaseType(raw: string | null | undefined): string {
  if (!raw) return "OTHER";
  const s = String(raw).trim();
  if (!s) return "OTHER";
  if (/유족|중피종 유족|혈액암 유족|폐암유족|진폐유족|업무상사고 유족|COPD 유족/.test(s)) return "BEREAVED";
  if (/난청/.test(s)) return "HEARING_LOSS";
  if (/진폐|간질성 폐|폐섬유화/.test(s)) return "PNEUMOCONIOSIS";
  if (/COPD/i.test(s)) return "COPD";
  if (/근골격|무릎|요추|어깨|허리|전립선 장해|장해/.test(s) && !/유족|암/.test(s)) return "MUSCULOSKELETAL";
  if (/업무상사고|출퇴근|업무상 사고|재요양/.test(s) && !/근골격/.test(s)) return "OCCUPATIONAL_ACCIDENT";
  if (/암|백혈병|갑상선|침샘|파킨슨|PTSD|과로|뇌심|정신질환/.test(s)) return "OCCUPATIONAL_CANCER";
  return "OTHER";
}

function parseDate(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const m = s.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/);
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    if (!isNaN(d.getTime())) return d;
  }
  const d2 = new Date(s);
  if (!isNaN(d2.getTime())) return d2;
  return null;
}

function makeKey(tfName: string, patientName: string, caseType: string, decisionDate: Date | null) {
  return `${tfName}|${patientName}|${caseType}|${decisionDate ? decisionDate.toISOString().slice(0, 10) : "NULL"}`;
}

async function main() {
  const xlsxPath = process.argv[2] ?? "C:\\Users\\jjakg\\AppData\\Local\\Temp\\xlsx\\work.xlsm";
  console.log("📂 xlsm:", xlsxPath);

  const wb = XLSX.readFile(xlsxPath);
  const ws = wb.Sheets["최초총현황"];
  const aoa = XLSX.utils.sheet_to_json<(string | null)[]>(ws, { header: 1, raw: false, defval: null });

  // ──────────────────────────────────────────────────────
  // A) 엑셀 aoa[2..850] (Excel rows 3..851) → 종결 처리
  // ──────────────────────────────────────────────────────
  console.log("\n=== A) 엑셀 1~851행 종결 일괄 처리 ===");
  const targetKeys = new Set<string>();
  for (let i = 2; i <= 850; i++) {
    const row = aoa[i];
    if (!row || !row.some(v => v != null && String(v).trim() !== "")) continue;
    const [approvalRaw, tfRaw, nameRaw, caseTypeRaw, decisionRaw] = row as (string | null)[];
    const patientName = nameRaw ? String(nameRaw).trim() : "";
    const approval = approvalRaw ? String(approvalRaw).trim() : "";
    const tfDisplay = tfRaw ? String(tfRaw).trim() : "";
    if (!patientName || !approval || !["승인", "불승인", "일부승인"].includes(approval)) continue;
    const tfName = TF_MAP[tfDisplay];
    if (!tfName) continue;
    const caseType = mapCaseType(caseTypeRaw);
    const decisionDate = parseDate(decisionRaw);
    targetKeys.add(makeKey(tfName, patientName, caseType, decisionDate));
  }
  console.log(`  대상 엑셀 키: ${targetKeys.size}`);

  // 대상에 해당하는 ObjectionReview id 수집
  const allReviews = await prisma.objectionReview.findMany({
    select: { id: true, tfName: true, patientName: true, caseType: true, decisionDate: true, progressStatus: true },
  });
  const reviewByKey = new Map<string, { id: string; progressStatus: string }>();
  for (const r of allReviews) reviewByKey.set(makeKey(r.tfName, r.patientName, r.caseType, r.decisionDate ?? null), { id: r.id, progressStatus: r.progressStatus });
  const hitIds: string[] = [];
  for (const k of targetKeys) {
    const v = reviewByKey.get(k);
    if (v) hitIds.push(v.id);
  }
  console.log(`  DB 매칭 ObjectionReview: ${hitIds.length}`);

  // 이의제기 기일관리에 등록된(= ObjectionCase 있는) reviewId들은 제외
  const protectedCases = await prisma.objectionCase.findMany({
    where: { reviewId: { in: hitIds } },
    select: { reviewId: true, patientName: true, tfName: true },
  });
  // reviewId 없이 caseId/name match인 보호 대상도 추가 안전장치
  const protectedReviewIds = new Set(protectedCases.map(c => c.reviewId).filter(Boolean) as string[]);
  // 이름·TF 기준으로도 매칭되는 ObjectionCase가 있는지 추가 보호
  const allObjectionCases = await prisma.objectionCase.findMany({
    select: { tfName: true, patientName: true, caseType: true, reviewId: true },
  });
  const caseNameKey = new Set(allObjectionCases.map(c => `${c.tfName}|${c.patientName}|${c.caseType}`));
  const hitReviews = allReviews.filter(r => hitIds.includes(r.id));
  const skipByName = hitReviews.filter(r => !protectedReviewIds.has(r.id) && caseNameKey.has(`${r.tfName}|${r.patientName}|${r.caseType}`));
  for (const r of skipByName) protectedReviewIds.add(r.id);

  const toClose = hitIds.filter(id => !protectedReviewIds.has(id));
  console.log(`  기일관리 보호 대상(종결 제외): ${protectedReviewIds.size}`);
  console.log(`  종결 처리 예정: ${toClose.length}`);

  const CHUNK = 500;
  let closed = 0;
  for (let i = 0; i < toClose.length; i += CHUNK) {
    const slice = toClose.slice(i, i + CHUNK);
    const res = await prisma.objectionReview.updateMany({
      where: { id: { in: slice } },
      data: { progressStatus: "종결" },
    });
    closed += res.count;
  }
  console.log(`  ✅ 종결 처리 완료: ${closed}건`);

  // ──────────────────────────────────────────────────────
  // B) 이의제기 진행 → ObjectionCase 누락분 생성
  // ──────────────────────────────────────────────────────
  console.log("\n=== B) 이의제기 진행 → 기일관리 동기화 ===");
  const objReviews = await prisma.objectionReview.findMany({
    where: { progressStatus: "이의제기 진행" },
    select: {
      id: true, caseId: true, tfName: true, patientName: true, caseType: true,
      approvalStatus: true, decisionDate: true,
    },
  });
  console.log(`  이의제기 진행 건수: ${objReviews.length}`);

  const existingCases = await prisma.objectionCase.findMany({
    select: { reviewId: true, caseId: true, tfName: true, patientName: true, caseType: true },
  });
  const existingByReview = new Set(existingCases.map(c => c.reviewId).filter(Boolean));
  const existingByNameKey = new Set(existingCases.map(c => `${c.tfName}|${c.patientName}|${c.caseType}`));

  const missing = objReviews.filter(r =>
    !existingByReview.has(r.id) &&
    !existingByNameKey.has(`${r.tfName}|${r.patientName}|${r.caseType}`)
  );
  console.log(`  기일관리 누락: ${missing.length}건`);

  let createdCases = 0;
  for (const r of missing) {
    let examClaimDeadline: Date | null = null;
    if (r.decisionDate) {
      examClaimDeadline = new Date(r.decisionDate);
      examClaimDeadline.setDate(examClaimDeadline.getDate() + 90);
    }
    await prisma.objectionCase.create({
      data: {
        reviewId: r.id,
        caseId: r.caseId,
        tfName: r.tfName,
        patientName: r.patientName,
        caseType: r.caseType,
        approvalStatus: r.approvalStatus,
        decisionDate: r.decisionDate,
        examClaimDeadline,
        progressStatus: "진행중",
      },
    });
    createdCases++;
    if (createdCases % 20 === 0) console.log(`    ... ${createdCases}/${missing.length}`);
  }
  console.log(`  ✅ ObjectionCase 생성: ${createdCases}건`);

  // ──────────────────────────────────────────────────────
  // C) 승인 → WageReviewData 누락분 생성
  // ──────────────────────────────────────────────────────
  console.log("\n=== C) 승인 → 평임 데이터 검토 동기화 ===");
  const approved = await prisma.objectionReview.findMany({
    where: { approvalStatus: "승인" },
    select: {
      id: true, caseId: true, tfName: true, patientName: true, caseType: true,
      decisionDate: true, hasInfoDisclosure: true,
    },
  });
  console.log(`  승인 ObjectionReview: ${approved.length}`);

  const existingWage = await prisma.wageReviewData.findMany({
    select: { caseId: true, tfName: true, patientName: true, caseType: true },
  });
  const wageByCaseId = new Set(existingWage.map(w => w.caseId).filter(Boolean) as string[]);
  const wageByNameKey = new Set(existingWage.map(w => `${w.tfName}|${w.patientName}|${w.caseType}`));

  const needsWage = approved.filter(r => {
    if (r.caseId && wageByCaseId.has(r.caseId)) return false;
    if (wageByNameKey.has(`${r.tfName}|${r.patientName}|${r.caseType}`)) return false;
    return true;
  });
  console.log(`  평임검토 누락: ${needsWage.length}건`);

  let createdWage = 0;
  for (const r of needsWage) {
    await prisma.wageReviewData.create({
      data: {
        caseId: r.caseId,
        tfName: r.tfName,
        patientName: r.patientName,
        caseType: r.caseType,
        decisionDate: r.decisionDate,
        hasInfoDisclosure: r.hasInfoDisclosure,
      },
    });
    createdWage++;
    if (createdWage % 20 === 0) console.log(`    ... ${createdWage}/${needsWage.length}`);
  }
  console.log(`  ✅ WageReviewData 생성: ${createdWage}건`);

  // 최종 요약
  console.log("\n=== 최종 요약 ===");
  const totalReview = await prisma.objectionReview.count();
  const closedCount = await prisma.objectionReview.count({ where: { progressStatus: "종결" } });
  const ongoingCount = await prisma.objectionReview.count({ where: { progressStatus: "이의제기 진행" } });
  const approvedCount = await prisma.objectionReview.count({ where: { approvalStatus: "승인" } });
  const totalCase = await prisma.objectionCase.count();
  const totalWage = await prisma.wageReviewData.count();
  console.log({ totalReview, closedCount, ongoingCount, approvedCount, totalCase, totalWage });

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
