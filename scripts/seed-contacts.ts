import { PrismaClient } from '@prisma/client'
import tbosangData from '../public/data/tbosang_contacts.json'
import isanData from '../public/data/isan_contacts.json'

const prisma = new PrismaClient()

async function main() {
  await prisma.contact.deleteMany()
  await prisma.isanOffice.deleteMany()

  const tbosangContacts = (tbosangData as any[]).map((e, idx) => ({
    firmType: 'TBOSANG',
    firm: e.branch,
    branch: e.branch,
    name: e.name,
    title: e.title || '',
    mobile: e.mobile || '',
    officePhone: e.officePhone || '',
    email: '',
    displayOrder: idx,
  }))
  await prisma.contact.createMany({ data: tbosangContacts })
  console.log(`더보상 ${tbosangContacts.length}명 삽입 완료`)

  const isanContacts = ((isanData as any).employees as any[]).map((e, idx) => ({
    firmType: 'ISAN',
    firm: '노무법인 이산',
    branch: e.branch || '',
    name: e.name,
    title: e.title || '',
    mobile: e.mobile || '',
    officePhone: e.directPhone || '',
    email: e.email || '',
    displayOrder: idx,
  }))
  await prisma.contact.createMany({ data: isanContacts })
  console.log(`이산 ${isanContacts.length}명 삽입 완료`)

  const offices = ((isanData as any).offices as any[]).map((o) => ({
    name: o.name,
    tel: o.tel || '',
    fax: o.fax || '',
    address: o.address || '',
  }))
  await prisma.isanOffice.createMany({ data: offices })
  console.log(`이산 지사 ${offices.length}개 삽입 완료`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
