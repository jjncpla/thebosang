import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// 일회성 TF 명칭 마이그레이션: 부산TF→이산부산TF, 울산TF→이산울산TF, 대구TF→이산대구TF
const RENAMES: [string, string][] = [
  ['부산TF', '이산부산TF'],
  ['울산TF', '이산울산TF'],
  ['대구TF', '이산대구TF'],
]

export async function POST() {
  const results: Record<string, number> = {}

  for (const [from, to] of RENAMES) {
    // Patient
    const patient = await (prisma as any).patient.updateMany({ where: { tfName: from }, data: { tfName: to } })
    results[`patient.${from}`] = patient.count

    // Case
    const caseR = await (prisma as any).case.updateMany({ where: { tfName: from }, data: { tfName: to } })
    results[`case.${from}`] = caseR.count

    // Consultation
    const consultation = await (prisma as any).consultation.updateMany({ where: { tfName: from }, data: { tfName: to } })
    results[`consultation.${from}`] = consultation.count

    // TfMessage
    const tfMessage = await (prisma as any).tfMessage.updateMany({ where: { tfName: from }, data: { tfName: to } })
    results[`tfMessage.${from}`] = tfMessage.count

    // ObjectionReview
    const objectionReview = await (prisma as any).objectionReview.updateMany({ where: { tfName: from }, data: { tfName: to } })
    results[`objectionReview.${from}`] = objectionReview.count

    // ObjectionCase
    const objectionCase = await (prisma as any).objectionCase.updateMany({ where: { tfName: from }, data: { tfName: to } })
    results[`objectionCase.${from}`] = objectionCase.count

    // HearingLossDetail
    const hearingLoss = await (prisma as any).hearingLossDetail.updateMany({ where: { tfName: from }, data: { tfName: to } })
    results[`hearingLossDetail.${from}`] = hearingLoss.count

    // SettlementRecord
    const settlement = await (prisma as any).settlementRecord.updateMany({ where: { tfName: from }, data: { tfName: to } })
    results[`settlementRecord.${from}`] = settlement.count

    // SpecialClinicSchedule
    const clinicSchedule = await (prisma as any).specialClinicSchedule.updateMany({ where: { tfName: from }, data: { tfName: to } })
    results[`specialClinicSchedule.${from}`] = clinicSchedule.count

    // TelegramMessage
    const telegramMsg = await (prisma as any).telegramMessage.updateMany({ where: { tfName: from }, data: { tfName: to } })
    results[`telegramMessage.${from}`] = telegramMsg.count
  }

  return NextResponse.json({ ok: true, results })
}
