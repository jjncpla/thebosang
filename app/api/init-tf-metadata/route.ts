import { prisma } from "@/lib/prisma"
import { TF_BY_BRANCH } from "@/lib/constants/tf"
import { BRANCH_BASE_COLORS } from "@/lib/tf-colors"
import { NextResponse } from "next/server"

/**
 * 1) `tf_metas` 테이블 생성 (없으면)
 * 2) 사용자 정리안 메모 seed (사용자가 * 표시한 TF들의 배경 설명)
 * 3) Branch 테이블에 TF_BY_BRANCH 내용 upsert (신규 지사·TF 동기화)
 *
 * GET 호출 1회 (멱등).
 */
export async function GET() {
  const steps: { step: string; ok: boolean; result?: unknown; error?: string }[] = []

  async function run(label: string, fn: () => Promise<unknown>) {
    try {
      const result = await fn()
      steps.push({ step: label, ok: true, result })
    } catch (e: unknown) {
      steps.push({ step: label, ok: false, error: e instanceof Error ? e.message : String(e) })
    }
  }

  // 1. tf_metas 테이블 DDL
  await run('CREATE TABLE tf_metas', () => prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "tf_metas" (
      "id" TEXT PRIMARY KEY,
      "tfName" TEXT NOT NULL UNIQUE,
      "memo" TEXT,
      "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // 1.5. branches 테이블에 colorBase 컬럼 추가 (없으면)
  await run('ADD COLUMN colorBase', () => prisma.$executeRaw`
    ALTER TABLE "branches" ADD COLUMN IF NOT EXISTS "colorBase" TEXT
  `)

  // 2. 메모 seed (사용자 정리안 2026-04-21)
  const seedMemos: Record<string, string> = {
    '이산대구TF': '대구달서/대구수성으로 세분화되기 전의 명칭. 통합방 메시지에서 지역만 "대구"로 표기한 건을 여기로 배정.',
    '부산TF': '부산북부/부산서부로 세분화되기 전의 명칭. 지사 소속 구분 없음.',
    '울산TF': '울산북부/울산동부/울산남부로 세분화되기 전의 명칭.',
    '더보상TF': '특정 TF가 아닌, 규칙이 없는 더보상 법인 사건 집합. 분류 불가한 더보상 건은 여기에 기재.',
    '더보상수원TF': '과거 "경수TF"로도 기록됨. 동일 TF.',
    '더보상대구TF': '과거 "대구북부TF"로도 기록됨. 동일 TF.',
    '더보상부경TF': '"이산부경TF"는 접두어 오기(본래 더보상 전용) — 자동 정정됨.',
    '이산의정부TF': '"의정부지사TF" 약칭도 동일.',
    '더보상울산TF': '삭제된 "복지TF" 건을 이관. 현재 존재하지 않는 복지TF 대체 배정지.',
    '동서해TF': '기타 분류 — 특정 지사에 속하지 않는 카테고리형 TF.',
    'Legacy': '파서가 TF명을 추출하지 못한 구식 포맷(2019~2021 메시지)을 임시로 묶은 카테고리. 향후 수동으로 정확한 TF로 이관 가능.',
    '경북TF': '통합방에서 자주 쓰이는 그룹 명칭 — 특정 지사 소속 아님.',
    '진폐TF': '진폐 전담 특수 TF — 지사 구분 없음.',
    '경서TF': '경기 서부 사건 전용(신규 카테고리).',
    '공무상재해TF': '공무상 재해 전용 카테고리. "공상TF"도 여기로 병합.',
    '플랜트TF': '플랜트 산업 전담 특수 TF.',
    '더보상포프TF': '"포항 프로젝트" 약칭 — 경북포항지사 산하 전용 TF.',
    '이산거제TF': '경남창원지사 산하. "거제TF", "게제TF"(오타)도 여기로 병합.',
    '이산원주TF': '강원동해지사 산하.',
    '이산보령TF': '대전지사 산하 — 충남 보령 지역.',
    '더보상서울북부TF': '서울북부지사 대표 TF.',
    '더보상서울북부영업TF': '서울북부지사 영업 전담.',
    '더보상서울북부상담TF': '서울북부지사 상담 전담.',
    '더보상법률원TF': '재해보상법률원 전담 TF (신규 지사).',
    '더보상어선원TF': '어선원(어선 재해) 전담 TF (신규 지사). "더보상어성원TF"(오타)도 여기로 병합.',
    '더보상대구중부TF': '대구중부지사(신설지사) 대표 TF.',
    '연구원TF': '산재연구원 전담 TF.',
  }

  let seedInserted = 0
  let seedSkipped = 0
  for (const [tfName, memo] of Object.entries(seedMemos)) {
    try {
      // 이미 있으면 스킵 (사용자가 편집한 내용 보존)
      const existing = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM "tf_metas" WHERE "tfName" = ${tfName} LIMIT 1
      `
      if (existing.length === 0) {
        const id = 'tf_' + Math.random().toString(36).slice(2, 12)
        await prisma.$executeRaw`
          INSERT INTO "tf_metas" ("id", "tfName", "memo", "createdAt", "updatedAt")
          VALUES (${id}, ${tfName}, ${memo}, NOW(), NOW())
        `
        seedInserted++
      } else {
        seedSkipped++
      }
    } catch (e: unknown) {
      steps.push({ step: `seed ${tfName}`, ok: false, error: e instanceof Error ? e.message : String(e) })
    }
  }
  steps.push({ step: 'seed memos', ok: true, result: { inserted: seedInserted, skipped: seedSkipped } })

  // 3. Branch 테이블에 TF_BY_BRANCH 내용 + colorBase upsert
  //    colorBase는 기존 값이 있으면 유지(사용자 편집 보존), 없을 때만 하드코딩 팔레트에서 seed
  let branchUpserted = 0
  const branchEntries = Object.entries(TF_BY_BRANCH)
  for (let i = 0; i < branchEntries.length; i++) {
    const [branchName, tfs] = branchEntries[i]
    const defaultColor = BRANCH_BASE_COLORS[branchName] ?? null
    try {
      const existing = await prisma.branch.findUnique({
        where: { name: branchName },
        select: { colorBase: true },
      })
      const colorToSet = existing?.colorBase ?? defaultColor

      await prisma.branch.upsert({
        where: { name: branchName },
        update: {
          assignedTFs: tfs as unknown as object,
          displayOrder: i,
          // 기존 값이 null이면 seed, 있으면 기존값 유지
          ...(existing?.colorBase ? {} : { colorBase: colorToSet }),
        },
        create: {
          name: branchName,
          assignedTFs: tfs as unknown as object,
          displayOrder: i,
          colorBase: colorToSet,
          firmType: 'TBOSANG',
          isActive: true,
        },
      })
      branchUpserted++
    } catch (e: unknown) {
      steps.push({ step: `branch upsert ${branchName}`, ok: false, error: e instanceof Error ? e.message : String(e) })
    }
  }
  steps.push({ step: 'branches upsert (with color seed)', ok: true, result: { count: branchUpserted } })

  const allOk = steps.every(s => s.ok)
  return NextResponse.json({ ok: allOk, steps })
}
