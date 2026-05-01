#!/usr/bin/env node
/**
 * 일회성 백필 스크립트:
 * branchName이 null/빈 값인 모든 Consultation 레코드를 "더보상 울산지사"로 설정.
 *
 * 실행 방법:
 *   railway run node scripts/backfill-consultation-branch.mjs
 *   또는 production env에서:
 *   DATABASE_URL=... node scripts/backfill-consultation-branch.mjs
 *
 * 안전: idempotent — 이미 branchName이 채워진 레코드는 건드리지 않음.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const TARGET_BRANCH = "더보상 울산지사";

async function main() {
  // 현재 상태 점검
  const total = await prisma.consultation.count();
  const empty = await prisma.consultation.count({
    where: { OR: [{ branchName: null }, { branchName: "" }] },
  });
  const filled = total - empty;

  console.log(`Consultation 총 ${total}건 / branchName 채워진 것 ${filled}건 / 비어있는 것 ${empty}건`);

  if (empty === 0) {
    console.log("백필 대상 없음. 종료.");
    return;
  }

  console.log(`${empty}건을 "${TARGET_BRANCH}"로 업데이트...`);
  const result = await prisma.consultation.updateMany({
    where: { OR: [{ branchName: null }, { branchName: "" }] },
    data: { branchName: TARGET_BRANCH },
  });
  console.log(`완료: ${result.count}건 업데이트`);

  // 검증
  const remaining = await prisma.consultation.count({
    where: { OR: [{ branchName: null }, { branchName: "" }] },
  });
  console.log(`남은 미설정: ${remaining}건`);
}

main()
  .catch((e) => {
    console.error("ERROR:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
