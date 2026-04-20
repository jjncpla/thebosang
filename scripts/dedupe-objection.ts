/**
 * 처분검토·기일관리·평임검토 3개 테이블 중복 제거
 *
 * 규칙
 *  1) ObjectionCase.caseType 한글 라벨 → enum 코드로 정규화 (매칭 대상 통일)
 *  2) 각 테이블에서 (tfName, patientName, caseType) 중복 그룹 찾기
 *  3) winner 선택:
 *     - ObjectionReview: caseId 있는 레코드 우선, 없으면 updatedAt desc
 *     - ObjectionCase:   reviewId 또는 caseId 있는 레코드 우선, 없으면 updatedAt desc
 *     - WageReviewData:  caseId 있는 레코드 우선, 없으면 updatedAt desc
 *  4) winner 필드 중 NULL/빈값 → loser의 같은 필드 값으로 채움 (병합)
 *  5) loser를 가리키는 FK를 winner로 재연결 후 loser 삭제
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ─── caseType 정규화 ─────────────────────────────
function normalizeCaseType(raw: string): string {
  const s = (raw ?? "").trim();
  if (!s) return "OTHER";
  // 이미 enum
  if (/^[A-Z_]+$/.test(s)) return s;
  if (/유족|중피종 유족|혈액암 유족|폐암유족|진폐유족|업무상사고 유족|COPD 유족|폐섬유화 유족/.test(s)) return "BEREAVED";
  if (/난청/.test(s)) return "HEARING_LOSS";
  if (/진폐|간질성 폐|폐섬유화/.test(s)) return "PNEUMOCONIOSIS";
  if (/COPD/i.test(s)) return "COPD";
  if (/근골격|무릎|요추|어깨|허리|장해|안구|관절/.test(s) && !/암/.test(s)) return "MUSCULOSKELETAL";
  if (/업무상|출퇴근|재요양/.test(s) && !/근골격/.test(s)) return "OCCUPATIONAL_ACCIDENT";
  if (/암|백혈병|갑상선|침샘|파킨슨|PTSD|과로|뇌심|정신|난미장/.test(s)) return "OCCUPATIONAL_CANCER";
  if (/평균임금|평정|적용사업장|요양비/.test(s)) return "OTHER";
  return "OTHER";
}

// ─── 병합: winner의 null/빈 필드를 loser에서 채움 ─────────────
function mergeData<T extends Record<string, unknown>>(winner: T, losers: T[]): Partial<T> {
  const patch: Record<string, unknown> = {};
  const isEmpty = (v: unknown) => v === null || v === undefined || v === "";
  const skip = new Set(["id", "createdAt", "updatedAt"]);
  for (const key of Object.keys(winner)) {
    if (skip.has(key)) continue;
    const w = winner[key];
    if (!isEmpty(w)) continue;
    for (const l of losers) {
      if (!isEmpty(l[key])) {
        patch[key] = l[key];
        break;
      }
    }
  }
  return patch as Partial<T>;
}

async function main() {
  // ─────────────────────────────────────────────────────
  // STEP 1: ObjectionCase.caseType 정규화
  // ─────────────────────────────────────────────────────
  console.log("=== STEP 1: ObjectionCase.caseType 정규화 ===");
  const allCases = await prisma.objectionCase.findMany({ select: { id: true, caseType: true } });
  let normalizedCount = 0;
  for (const c of allCases) {
    const nt = normalizeCaseType(c.caseType);
    if (nt !== c.caseType) {
      await prisma.objectionCase.update({ where: { id: c.id }, data: { caseType: nt } });
      normalizedCount++;
    }
  }
  console.log(`  ✅ 정규화: ${normalizedCount}건`);

  // 마찬가지로 WageReviewData.caseType도 정규화
  console.log("=== STEP 1b: WageReviewData.caseType 정규화 ===");
  const allWage = await prisma.wageReviewData.findMany({ select: { id: true, caseType: true } });
  let wageNormalized = 0;
  for (const w of allWage) {
    const nt = normalizeCaseType(w.caseType);
    if (nt !== w.caseType) {
      await prisma.wageReviewData.update({ where: { id: w.id }, data: { caseType: nt } });
      wageNormalized++;
    }
  }
  console.log(`  ✅ WageReviewData 정규화: ${wageNormalized}건`);

  // ─────────────────────────────────────────────────────
  // STEP 2: ObjectionReview 중복 제거
  // ─────────────────────────────────────────────────────
  console.log("\n=== STEP 2: ObjectionReview 중복 제거 ===");
  const reviewGroups = await prisma.$queryRaw<{ tfName: string; patientName: string; caseType: string }[]>`
    SELECT "tfName", "patientName", "caseType"
    FROM "ObjectionReview"
    GROUP BY "tfName", "patientName", "caseType"
    HAVING COUNT(*) > 1
  `;
  console.log(`  중복 그룹: ${reviewGroups.length}`);

  let reviewDeleted = 0;
  for (const g of reviewGroups) {
    const rows = await prisma.objectionReview.findMany({
      where: { tfName: g.tfName, patientName: g.patientName, caseType: g.caseType },
      orderBy: [{ caseId: { sort: "desc", nulls: "last" } }, { updatedAt: "desc" }],
    });
    const [winner, ...losers] = rows;
    if (!winner || losers.length === 0) continue;

    // 병합 패치
    const patch = mergeData(winner as Record<string, unknown>, losers as Record<string, unknown>[]);
    if (Object.keys(patch).length > 0) {
      await prisma.objectionReview.update({ where: { id: winner.id }, data: patch });
    }

    // FK 재연결 (ObjectionCase.reviewId)
    for (const l of losers) {
      await prisma.objectionCase.updateMany({ where: { reviewId: l.id }, data: { reviewId: winner.id } });
    }

    // 삭제
    await prisma.objectionReview.deleteMany({ where: { id: { in: losers.map(l => l.id) } } });
    reviewDeleted += losers.length;
  }
  console.log(`  ✅ 삭제: ${reviewDeleted}건`);

  // ─────────────────────────────────────────────────────
  // STEP 3: ObjectionCase 중복 제거
  // ─────────────────────────────────────────────────────
  console.log("\n=== STEP 3: ObjectionCase 중복 제거 ===");
  const caseGroups = await prisma.$queryRaw<{ tfName: string; patientName: string; caseType: string }[]>`
    SELECT "tfName", "patientName", "caseType"
    FROM "ObjectionCase"
    GROUP BY "tfName", "patientName", "caseType"
    HAVING COUNT(*) > 1
  `;
  console.log(`  중복 그룹: ${caseGroups.length}`);

  let caseDeleted = 0;
  for (const g of caseGroups) {
    // ObjectionCase는 linked 우선순위: reviewId or caseId 있으면 우선
    const rows = await prisma.objectionCase.findMany({
      where: { tfName: g.tfName, patientName: g.patientName, caseType: g.caseType },
    });
    // 정렬: (reviewId/caseId 중 하나라도 있으면 우선) → updatedAt desc
    rows.sort((a, b) => {
      const aLinked = (a.reviewId || a.caseId) ? 1 : 0;
      const bLinked = (b.reviewId || b.caseId) ? 1 : 0;
      if (aLinked !== bLinked) return bLinked - aLinked;
      return b.updatedAt.getTime() - a.updatedAt.getTime();
    });
    const [winner, ...losers] = rows;
    if (!winner || losers.length === 0) continue;

    const patch = mergeData(winner as Record<string, unknown>, losers as Record<string, unknown>[]);
    if (Object.keys(patch).length > 0) {
      await prisma.objectionCase.update({ where: { id: winner.id }, data: patch });
    }
    await prisma.objectionCase.deleteMany({ where: { id: { in: losers.map(l => l.id) } } });
    caseDeleted += losers.length;
  }
  console.log(`  ✅ 삭제: ${caseDeleted}건`);

  // ─────────────────────────────────────────────────────
  // STEP 4: WageReviewData 중복 제거
  // ─────────────────────────────────────────────────────
  console.log("\n=== STEP 4: WageReviewData 중복 제거 ===");
  const wageGroups = await prisma.$queryRaw<{ tfName: string; patientName: string; caseType: string }[]>`
    SELECT "tfName", "patientName", "caseType"
    FROM "WageReviewData"
    GROUP BY "tfName", "patientName", "caseType"
    HAVING COUNT(*) > 1
  `;
  console.log(`  중복 그룹: ${wageGroups.length}`);

  let wageDeleted = 0;
  for (const g of wageGroups) {
    const rows = await prisma.wageReviewData.findMany({
      where: { tfName: g.tfName, patientName: g.patientName, caseType: g.caseType },
      orderBy: [{ caseId: { sort: "desc", nulls: "last" } }, { updatedAt: "desc" }],
    });
    const [winner, ...losers] = rows;
    if (!winner || losers.length === 0) continue;

    const patch = mergeData(winner as Record<string, unknown>, losers as Record<string, unknown>[]);
    if (Object.keys(patch).length > 0) {
      await prisma.wageReviewData.update({ where: { id: winner.id }, data: patch });
    }
    await prisma.wageReviewData.deleteMany({ where: { id: { in: losers.map(l => l.id) } } });
    wageDeleted += losers.length;
  }
  console.log(`  ✅ 삭제: ${wageDeleted}건`);

  // ─────────────────────────────────────────────────────
  // 최종 확인
  // ─────────────────────────────────────────────────────
  console.log("\n=== 최종 중복 잔여 확인 ===");
  const [revDup, caseDup, wageDup] = await Promise.all([
    prisma.$queryRaw<{ cnt: bigint }[]>`SELECT COUNT(*) AS cnt FROM (SELECT 1 FROM "ObjectionReview" GROUP BY "tfName","patientName","caseType" HAVING COUNT(*)>1) d`,
    prisma.$queryRaw<{ cnt: bigint }[]>`SELECT COUNT(*) AS cnt FROM (SELECT 1 FROM "ObjectionCase" GROUP BY "tfName","patientName","caseType" HAVING COUNT(*)>1) d`,
    prisma.$queryRaw<{ cnt: bigint }[]>`SELECT COUNT(*) AS cnt FROM (SELECT 1 FROM "WageReviewData" GROUP BY "tfName","patientName","caseType" HAVING COUNT(*)>1) d`,
  ]);
  console.log({
    reviewDupRemaining: Number(revDup[0]?.cnt ?? 0n),
    caseDupRemaining: Number(caseDup[0]?.cnt ?? 0n),
    wageDupRemaining: Number(wageDup[0]?.cnt ?? 0n),
  });

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
