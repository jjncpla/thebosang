import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "branches" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "name" TEXT NOT NULL UNIQUE,
        "shortName" TEXT,
        "address" TEXT,
        "phone" TEXT,
        "fax" TEXT,
        "region" TEXT,
        "assignedTFs" JSONB,
        "branchManagerId" TEXT,
        "firmType" TEXT NOT NULL DEFAULT 'TBOSANG',
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "displayOrder" INTEGER NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `)

    const branches = [
      // ── 부울경남권역 ──
      { name: '노무법인 더보상 울산지사',     shortName: '울산',     region: '부울경남권역', assignedTFs: '["더보상울산TF","이산울산동부TF","이산울산남부TF","이산울산북부TF"]', displayOrder: 1 },
      { name: '노무법인 더보상 울산동부지사', shortName: '울산동부', region: '부울경남권역', assignedTFs: '["더보상울동TF","이산양산TF"]', displayOrder: 2 },
      { name: '노무법인 더보상 부산경남지사', shortName: '부산경남', region: '부울경남권역', assignedTFs: '["더보상부경TF","이산부산서부TF","이산부산북부TF","이산김해TF"]', displayOrder: 3 },
      { name: '노무법인 더보상 부산중부지사', shortName: '부산중부', region: '부울경남권역', assignedTFs: '["더보상부중TF","이산부산지역본부TF"]', displayOrder: 4 },
      { name: '노무법인 더보상 경남창원지사', shortName: '경남창원', region: '부울경남권역', assignedTFs: '["더보상창원TF","이산창원TF"]', displayOrder: 5 },
      { name: '노무법인 더보상 경북포항지사', shortName: '경북포항', region: '부울경남권역', assignedTFs: '["더보상포항TF","이산포항TF"]', displayOrder: 6 },
      // ── 대구경북권역 ──
      { name: '노무법인 더보상 경북구미지사', shortName: '경북구미', region: '대구경북권역', assignedTFs: '["더보상구미TF","이산구미TF","이산문경TF"]', displayOrder: 7 },
      { name: '노무법인 더보상 대구지사',     shortName: '대구',     region: '대구경북권역', assignedTFs: '["더보상대구TF","이산대구달서TF","이산대구수성TF"]', displayOrder: 8 },
      // ── 전라권역 ──
      { name: '노무법인 더보상 전북익산지사', shortName: '전북익산', region: '전라권역', assignedTFs: '["더보상익산TF","이산전북TF","이산전주TF"]', displayOrder: 9 },
      { name: '노무법인 더보상 전남여수지사', shortName: '전남여수', region: '전라권역', assignedTFs: '["더보상여수TF","이산전남TF","이산광주TF","이산여수TF"]', displayOrder: 10 },
      { name: '노무법인 더보상 전남순천지사', shortName: '전남순천', region: '전라권역', assignedTFs: '["더보상순천TF","이산진주TF","이산순천TF"]', displayOrder: 11 },
      // ── 충청권역 ──
      { name: '노무법인 더보상 대전지사',     shortName: '대전',     region: '충청권역', assignedTFs: '["더보상대전TF","이산청주TF","이산충주TF"]', displayOrder: 12 },
      // ── 수도권역 ──
      { name: '노무법인 더보상 서울북부지사', shortName: '서울북부', region: '수도권역', assignedTFs: '["더보상직업병상담소TF"]', displayOrder: 13 },
      { name: '노무법인 더보상 경기안산지사', shortName: '경기안산', region: '수도권역', assignedTFs: '["더보상안산TF","이산영서TF","이산용인TF"]', displayOrder: 14 },
      { name: '노무법인 더보상 경기의정부지사', shortName: '경기의정부', region: '수도권역', assignedTFs: '["더보상의정부TF","이산의정부TF","이산성남TF"]', displayOrder: 15 },
      { name: '노무법인 더보상 경기수원지사', shortName: '경기수원', region: '수도권역', assignedTFs: '["더보상수원TF","이산수원TF","이산평택TF"]', displayOrder: 16 },
      { name: '노무법인 더보상 경인지사',     shortName: '경인',     region: '수도권역', assignedTFs: '["더보상경인TF","이산인천TF","이산인천북부TF"]', displayOrder: 17 },
      { name: '노무법인 더보상 서울구로지사', shortName: '서울구로', region: '수도권역', assignedTFs: '["더보상구로TF","이산부천TF"]', displayOrder: 18 },
      { name: '노무법인 더보상 강원동해지사', shortName: '강원동해', region: '수도권역', assignedTFs: '["더보상동해TF","이산영동TF"]', displayOrder: 19 },
      { name: '노무법인 더보상 산재연구원',   shortName: '산재연구원', region: '수도권역', assignedTFs: '["이산서울지역본부TF","이산서울동부TF"]', displayOrder: 20 },
      { name: '노무법인 더보상',             shortName: '본사',     region: '수도권역', assignedTFs: '["이산제주TF","이산마곡TF"]', displayOrder: 21 },
    ]

    let inserted = 0
    let skipped = 0
    for (const b of branches) {
      try {
        await prisma.$executeRawUnsafe(`
          INSERT INTO "branches" ("id", "name", "shortName", "region", "assignedTFs", "firmType", "displayOrder", "isActive", "updatedAt")
          VALUES (gen_random_uuid()::text, $1, $2, $3, $4::jsonb, 'TBOSANG', $5, true, CURRENT_TIMESTAMP)
          ON CONFLICT ("name") DO UPDATE SET
            "shortName" = $2, "region" = $3, "assignedTFs" = $4::jsonb, "displayOrder" = $5, "updatedAt" = CURRENT_TIMESTAMP
        `, b.name, b.shortName, b.region, b.assignedTFs, b.displayOrder)
        inserted++
      } catch (e: any) {
        console.error('Branch seed error:', b.name, e.message)
        skipped++
      }
    }

    return NextResponse.json({ ok: true, message: 'Branch 시드 완료', inserted, skipped, total: branches.length })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
