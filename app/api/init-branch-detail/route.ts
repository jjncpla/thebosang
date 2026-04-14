import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    // 1) 컬럼 추가
    await prisma.$executeRawUnsafe(`ALTER TABLE "branches" ADD COLUMN IF NOT EXISTS "bizNumber" TEXT;`)
    await prisma.$executeRawUnsafe(`ALTER TABLE "branches" ADD COLUMN IF NOT EXISTS "bankAccount" TEXT;`)

    // 2) 기존 지사 상세 데이터 업데이트
    const updates = [
      { name: '노무법인 더보상', bizNumber: '788-86-02058', phone: '02-576-1568', fax: '02-576-1566', bankAccount: '농협 301-0277-6796-81 노무법인 더보상', address: '서울특별시 서초구 마방로2길 82, 5층 (양재동, 태성빌딩)' },
      { name: '노무법인 더보상 서울북부지사', bizNumber: '364-85-01249', phone: '02-433-1568', fax: '02-434-1568', bankAccount: '농협 301-0277-7435-71 노무법인 더보상 서울북부지사', address: '서울특별시 중랑구 사가정로49길 65 (면목동)' },
      { name: '노무법인 더보상 경기안산지사', bizNumber: '617-85-48997', phone: '031-407-1568', fax: '031-408-1568', bankAccount: '농협 301-0278-3327-61 노무법인 더보상 경기안산지사', address: '경기도 안산시 상록구 구룡로86 (일동)' },
      { name: '노무법인 더보상 부산경남지사', bizNumber: '391-85-01751', phone: '051-246-1568', fax: '051-256-1568', bankAccount: '농협 301-0283-6499-01 노무법인 더보상 부산경남지사', address: '부산광역시 동구 중앙대로 193, 5층 (초량동, 마린리더스타워)' },
      { name: '노무법인 더보상 전북익산지사', bizNumber: '759-85-01729', phone: '063-835-1568', fax: '063-836-1568', bankAccount: '농협 301-0291-9350-41 노무법인 더보상 전북익산지사', address: '전라북도 익산시 무왕로 968, 3층 (신동)' },
      { name: '노무법인 더보상 경북구미지사', bizNumber: '464-85-01933', phone: '054-456-1568', fax: '054-458-1568', bankAccount: '농협 301-0291-9311-01 노무법인 더보상 경북구미지사', address: '경상북도 구미시 신시로 73, 2층 (형곡동)' },
      { name: '노무법인 더보상 경기의정부지사', bizNumber: '167-85-01895', phone: '031-847-1568', fax: '031-846-1564', bankAccount: '농협 301-0297-5526-11 노무법인 더보상 경기의정부지사', address: '경기도 의정부시 천보로 257 (금오동, ACT빌딩)' },
      { name: '노무법인 더보상 강원동해지사', bizNumber: '628-85-02083', phone: '033-534-1568', fax: '033-535-1568', bankAccount: '농협 301-0311-9036-51 노무법인 더보상(강원동해지사)', address: '강원도 동해시 천곡로 71, 3층 (천곡동, 흥국생명빌딩)' },
      { name: '노무법인 더보상 울산지사', bizNumber: '474-85-02093', phone: '052-281-1568', fax: '052-282-1568', bankAccount: '농협 301-0311-9055-11 노무법인 더보상(울산지사)', address: '울산광역시 중구 번영로 580, SkyM빌딩 3층 302호' },
      { name: '노무법인 더보상 전남여수지사', bizNumber: '583-85-02136', phone: '061-681-1568', fax: '061-683-1568', bankAccount: '농협 301-0323-5406-91 노무법인 더보상 전남여수지사', address: '전라남도 여수시 학동1길 14, 2층 (학동)' },
      { name: '노무법인 더보상 대구지사', bizNumber: '394-85-02287', phone: '053-311-1568', fax: '053-313-1568', bankAccount: '농협 301-0323-5373-41 노무법인 더보상 대구지사', address: '대구광역시 북구 학정로 551-20, 3층 (학정동)' },
      { name: '노무법인 더보상 부산중부지사', bizNumber: '149-85-02260', phone: '051-555-1568', fax: '051-719-4811', bankAccount: '농협 301-0332-0368-51 노무법인 더보상 부산중부지사', address: '부산광역시 동래구 충렬대로 259, 1층 (낙민동, 도운메디컬빌딩)' },
      { name: '노무법인 더보상 경기수원지사', bizNumber: '861-85-02297', phone: '031-258-1568', fax: '0303-3445-1568', bankAccount: '농협 301-0336-1217-91 노무법인 더보상 경기수원지사', address: '경기도 수원시 팔달구 정조로775, 1층 (팔달로3가)' },
      { name: '노무법인 더보상 산재연구원', bizNumber: '347-85-02447', phone: '02-557-1568', fax: '02-558-1568', bankAccount: '농협 301-0338-8211-61 노무법인 더보상 산재연구원', address: '서울특별시 서초구 강남대로12길 23-40, 4층 (양재동, 이플하우스)' },
      { name: '노무법인 더보상 울산동부지사', bizNumber: '639-85-02273', phone: '052-252-1568', fax: '0303-3443-1568', bankAccount: '농협 301-0338-8191-71 노무법인 더보상 울산동부지사', address: '울산광역시 동구 방어진순환도로 787, 1층 (전하동)' },
      { name: '노무법인 더보상 대전지사', bizNumber: '488-85-02845', phone: '042-282-1568', fax: '042-283-1568', bankAccount: '농협 301-0357-7903-61 노무법인 더보상 대전지사', address: '대전광역시 동구 옥천로 183, 2층 (판암동)' },
      { name: '노무법인 더보상 경인지사', bizNumber: '593-85-02472', phone: '032-501-1568', fax: '032-502-1568', bankAccount: '농협 301-0357-7889-91 노무법인 더보상 경인지사', address: '인천광역시 부평구 부평대로 10, 2층 (부평동)' },
      { name: '노무법인 더보상 경북포항지사', bizNumber: '749-85-02740', phone: '054-286-1568', fax: '054-275-1568', bankAccount: '농협 301-0657-7914-41 노무법인 더보상 경북포항지사', address: '경상북도 포항시 남구 포스코대로 338, 4층 (대도동, 태영빌딩)' },
      { name: '노무법인 더보상 전남순천지사', bizNumber: '257-85-02988', phone: '061-745-1568', fax: '061-746-1568', bankAccount: '농협 301-0371-9385-91 노무법인 더보상 전남순천지사', address: '전라남도 순천시 하풍동길6, 2층 (풍덕동)' },
      { name: '노무법인 더보상 경남창원지사', bizNumber: '343-85-03158', phone: '055-287-1568', fax: '055-286-1568', bankAccount: '농협 301-0373-1040-01 노무법인 더보상 경남창원지사', address: '경상남도 창원시 성산구 마디미서로 68, 2층 (상남동, 창원시 새마을회관)' },
      { name: '노무법인 더보상 서울구로지사', bizNumber: '241-85-02998', phone: '02-868-1568', fax: '0303-3441-3440', bankAccount: '농협 301-0376-5244-21 노무법인 더보상 서울구로지사', address: '서울 구로구 가마산로206 3층 (구로동)' },
    ]

    let updated = 0
    for (const u of updates) {
      try {
        await prisma.$executeRawUnsafe(`
          UPDATE "branches" SET
            "bizNumber" = $2,
            "phone" = $3,
            "fax" = $4,
            "bankAccount" = $5,
            "address" = $6,
            "updatedAt" = CURRENT_TIMESTAMP
          WHERE "name" = $1
        `, u.name, u.bizNumber, u.phone, u.fax, u.bankAccount, u.address)
        updated++
      } catch (e: any) {
        console.error('Update error:', u.name, e.message)
      }
    }

    // 3) 누락 조직 추가
    const extras = [
      { name: '더보상 직업병 상담소', shortName: '직업병상담소', region: '수도권역', bizNumber: '783-85-02186', phone: '02-435-1568', fax: '0505-365-6237', bankAccount: '농협 301-0332-0345-51 더보상 직업병 상담소', address: '서울특별시 중랑구 사가정로49길 49 (면목동)', assignedTFs: '[]', displayOrder: 22 },
      { name: '노무법인 더보상 재해보상법률원', shortName: '재해보상법률원', region: '수도권역', bizNumber: '', phone: '', fax: '02-573-1566', bankAccount: '', address: '서울특별시 서초구 마방로2길 82, 3층 (양재동, 태성빌딩)', assignedTFs: '[]', displayOrder: 23 },
      { name: '노무법인 더보상 법률원 성남센터', shortName: '법률원성남', region: '수도권역', bizNumber: '618-85-19928', phone: '031-755-1568', fax: '031-756-1568', bankAccount: '농협 301-0376-5202-71 노무법인 더보상 법률원', address: '경기도 성남시 중원구 성남대로 1149, 3층 (성남동)', assignedTFs: '[]', displayOrder: 24 },
      { name: '법무법인 더보상', shortName: '법무법인', region: '수도권역', bizNumber: '254-87-02187', phone: '02-3463-1568', fax: '02-3461-1568', bankAccount: '농협 301-3463-1568-81 법무법인 더보상', address: '서울특별시 서초구 마방로2길 82, 4층 (양재동, 태성빌딩)', assignedTFs: '[]', displayOrder: 25 },
    ]

    let inserted = 0
    for (const e of extras) {
      try {
        await prisma.$executeRawUnsafe(`
          INSERT INTO "branches" ("id", "name", "shortName", "region", "bizNumber", "phone", "fax", "bankAccount", "address", "assignedTFs", "firmType", "displayOrder", "isActive", "updatedAt")
          VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, 'TBOSANG', $10, true, CURRENT_TIMESTAMP)
          ON CONFLICT ("name") DO UPDATE SET
            "bizNumber" = $4, "phone" = $5, "fax" = $6, "bankAccount" = $7, "address" = $8, "updatedAt" = CURRENT_TIMESTAMP
        `, e.name, e.shortName, e.region, e.bizNumber, e.phone, e.fax, e.bankAccount, e.address, e.assignedTFs, e.displayOrder)
        inserted++
      } catch (err: any) {
        console.error('Insert error:', e.name, err.message)
      }
    }

    return NextResponse.json({ ok: true, updated, inserted, message: `기존 ${updated}개 업데이트 + 신규 ${inserted}개 추가` })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
