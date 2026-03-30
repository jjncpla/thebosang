import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

// 한글 이름 → 초성 이니셜 변환
function nameToInitials(name: string): string {
  const CHOSUNG = ['g','k','n','d','t','r','m','b','p','s','s','y','j','j','c','k','t','p','h']
  let result = ''
  for (const ch of name) {
    const code = ch.charCodeAt(0)
    if (code >= 0xAC00 && code <= 0xD7A3) {
      const idx = Math.floor((code - 0xAC00) / (21 * 28))
      result += CHOSUNG[idx] || ''
    } else if (/[a-zA-Z]/.test(ch)) {
      result += ch.toLowerCase()
    }
  }
  return result.slice(0, 3)
}

export async function GET() {
  try {
    // 외근직 전체 조회
    const contacts = await prisma.contact.findMany({
      where: { jobGrade: '외근직' },
      orderBy: [{ branch: 'asc' }, { displayOrder: 'asc' }],
    })

    const hashedPw = await bcrypt.hash('1234', 10)

    // 이메일 중복 처리를 위한 카운터
    const initialsCount: Record<string, number> = {}

    // 기존 User 이메일 목록
    const existingEmails = new Set(
      (await prisma.user.findMany({ select: { email: true } })).map(u => u.email)
    )

    const results = {
      totalContacts: contacts.length,
      userInserted: 0,
      userSkipped: 0,
      rosterInserted: 0,
      rosterSkipped: 0,
      accounts: [] as { name: string; email: string; branch: string }[],
    }

    for (const c of contacts) {
      // 이니셜 이메일 생성
      const base = nameToInitials(c.name)
      if (!initialsCount[base]) initialsCount[base] = 0
      initialsCount[base]++
      const suffix = initialsCount[base] === 1 ? '' : String(initialsCount[base])
      const email = `${base}${suffix}@thebosang.kr`

      // User 생성
      if (existingEmails.has(email)) {
        results.userSkipped++
      } else {
        try {
          await prisma.user.create({
            data: {
              email,
              name: c.name,
              password: hashedPw,
              role: 'STAFF',
            }
          })
          existingEmails.add(email)
          results.userInserted++
          results.accounts.push({ name: c.name, email, branch: c.branch })
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e)
          console.error(`User 생성 실패 ${c.name}:`, msg)
          results.userSkipped++
        }
      }

      // StaffRoster 생성 (startYear=2024, startMonth=1)
      try {
        const existingRoster = await prisma.staffRoster.findFirst({
          where: { staffName: c.name, branchName: c.branch }
        })
        if (existingRoster) {
          results.rosterSkipped++
        } else {
          await prisma.staffRoster.create({
            data: {
              staffName: c.name,
              branchName: c.branch,
              startYear: 2024,
              startMonth: 1,
            }
          })
          results.rosterInserted++
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e)
        console.error(`StaffRoster 생성 실패 ${c.name}:`, msg)
        results.rosterSkipped++
      }
    }

    return NextResponse.json({ ok: true, ...results })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
