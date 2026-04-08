import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import * as XLSX from 'xlsx'

const prisma = new PrismaClient()

// ── 상태 매핑 ──────────────────────────────────────
const STATUS_MAP: Record<string, string> = {
  CONSULTING: 'CONSULTING', CONTRACTED: 'CONTRACTED',
  DOC_COLLECTING: 'DOC_COLLECTING', SUBMITTED: 'SUBMITTED',
  EXAM_REQUESTED: 'EXAM_REQUESTED', EXAM_CLINIC_SELECTED: 'EXAM_CLINIC_SELECTED',
  EXAM_SCHEDULED: 'EXAM_SCHEDULED', IN_EXAM: 'IN_EXAM', EXAM_DONE: 'EXAM_DONE',
  EXPERT_REQUESTED: 'EXPERT_REQUESTED', EXPERT_DONE: 'EXPERT_DONE',
  DECISION_RECEIVED: 'DECISION_RECEIVED', REVIEWING: 'REVIEWING',
  APPROVED: 'APPROVED', REJECTED: 'REJECTED', CLOSED: 'CLOSED',
}

function parseDate(val: any): Date | null {
  if (!val) return null
  if (val instanceof Date) return val
  const s = String(val).trim()
  if (!s) return null
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d
}

function parseFloat2(val: any): number | null {
  if (val === null || val === undefined || val === '') return null
  const n = parseFloat(String(val))
  return isNaN(n) ? null : n
}

function parseStr(val: any): string | null {
  if (val === null || val === undefined) return null
  const s = String(val).trim()
  return s || null
}

function parseBool(val: any): boolean {
  const s = String(val ?? '').trim().toUpperCase()
  return s === 'Y' || s === 'TRUE' || s === '1'
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const mode = (formData.get('mode') as string) || 'verify'

    if (!file) {
      return NextResponse.json({ ok: false, error: '파일이 없습니다' }, { status: 400 })
    }

    // xlsx 파싱
    const buf = await file.arrayBuffer()
    const wb = XLSX.read(buf, { type: 'buffer', cellDates: true })

    // 데이터 시트 탐색: "변환결과" → "울산북부TF" → Chart가 아닌 첫 시트 → 첫 시트
    const sheetName = wb.SheetNames.find(n => n === '변환결과')
      ?? wb.SheetNames.find(n => n.includes('TF'))
      ?? wb.SheetNames.find(n => !n.toLowerCase().startsWith('chart'))
      ?? wb.SheetNames[0]
    const ws = wb.Sheets[sheetName]

    const allRows = XLSX.utils.sheet_to_json(ws, {
      header: 1,
      defval: null,
      raw: false,
    }) as any[][]

    if (!allRows || allRows.length === 0) {
      return NextResponse.json({
        ok: false,
        error: `시트 "${sheetName}"에서 데이터를 읽을 수 없습니다. 시트 목록: ${wb.SheetNames.join(', ')}`,
      }, { status: 400 })
    }

    // 디버그: 첫 5행의 첫 5셀을 반환 (문제 진단용)
    const debugRows = allRows.slice(0, 5).map((r, i) => ({
      rowIdx: i,
      cells: (r || []).slice(0, 5).map((v: any) => String(v ?? '(null)')),
    }))

    // 헤더 탐지 — '성명' 포함 셀이 있는 행 탐색 (전체 행에서)
    const headerRowIdx = allRows.findIndex((row: any[]) => {
      if (!row || !Array.isArray(row)) return false
      return row.some((v: any) => {
        const s = String(v ?? '').replace(/★\s*/g, '').trim()
        return s === '성명'
      })
    })

    if (headerRowIdx < 0) {
      return NextResponse.json({
        ok: false,
        error: `헤더 행(성명 컬럼)을 찾을 수 없습니다.`,
        debug: { sheetName, totalRows: allRows.length, firstRows: debugRows },
      }, { status: 400 })
    }

    const headerRow = allRows[headerRowIdx]
    if (!headerRow || !Array.isArray(headerRow)) {
      return NextResponse.json({
        ok: false,
        error: `헤더 행(index ${headerRowIdx})이 비어있습니다.`,
        debug: { sheetName, totalRows: allRows.length, firstRows: debugRows },
      }, { status: 400 })
    }

    const korHeaders: string[] = headerRow.map((v: any) =>
      String(v ?? '').replace(/★\s*/g, '').trim()
    )

    // DB필드명 행(헤더+1) 다음부터 데이터
    const dataRows = allRows.slice(headerRowIdx + 2).filter((r: any[]) =>
      r && Array.isArray(r) && r.some((v: any) => v !== null && v !== '' && v !== undefined)
    )

    if (dataRows.length === 0) {
      return NextResponse.json({
        ok: false,
        error: `데이터 행이 없습니다 (헤더 위치: ${headerRowIdx}행, 전체 행 수: ${allRows.length})`,
        debug: { sheetName, headerRowIdx, korHeaders: korHeaders.slice(0, 10), firstRows: debugRows },
      }, { status: 400 })
    }

    function col(row: any[], name: string): any {
      const idx = korHeaders.indexOf(name)
      return idx >= 0 ? row[idx] : null
    }

    // ── DB에서 User 목록 조회 ────────────────────────
    const users = await prisma.user.findMany({ select: { id: true, name: true } })
    const userMap = new Map<string, string>() // name → id
    for (const u of users) userMap.set(u.name.trim(), u.id)

    // ── DB에서 기존 Patient SSN 목록 조회 ────────────
    const existingPatients = await prisma.patient.findMany({
      select: { id: true, ssn: true }
    })
    const patientSsnMap = new Map<string, string>() // ssn → id
    for (const p of existingPatients) patientSsnMap.set(p.ssn, p.id)

    // ── 검증 결과 수집 ────────────────────────────────
    const verifyReport = {
      total: dataRows.length,
      managerMismatches: [] as Array<{ row: number; field: string; value: string }>,
      ssnDuplicates: [] as Array<{ row: number; ssn: string }>,
      missingRequired: [] as Array<{ row: number; field: string; rawValue: string }>,
      statusWarnings: [] as Array<{ row: number; value: string }>,
    }

    const importJobs: any[] = []

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i]
      const rowNum = headerRowIdx + 2 + i + 1 // 헤더 + DB필드명행 + 데이터 index + 1(엑셀 1-based)

      const name      = parseStr(col(row, '성명'))
      const ssn       = parseStr(col(row, '주민번호'))
      const phone     = parseStr(col(row, '연락처'))
      const address   = parseStr(col(row, '주소'))
      const patMemo   = parseStr(col(row, '재해자메모'))

      const caseType  = parseStr(col(row, 'caseType')) || 'HEARING_LOSS'
      const tfName    = parseStr(col(row, 'TF명'))
      const branch    = parseStr(col(row, '지사'))
      const subAgent  = parseStr(col(row, '소속/대리인'))
      const salesRoute = parseStr(col(row, '소개자'))
      const isOneStop = parseBool(col(row, '원스톱'))
      const status    = parseStr(col(row, '진행상태')) || 'CONSULTING'
      const receptionDate = parseDate(col(row, '접수일자'))
      const contractDate  = parseDate(col(row, '약정일자'))
      const kwcOfficeName = parseStr(col(row, '관할공단지사'))
      const caseMemo  = parseStr(col(row, '사건메모'))
      const closedReason = parseStr(col(row, '종결사유'))

      const salesManagerName  = parseStr(col(row, '영업담당자명'))
      const caseManagerName   = parseStr(col(row, '사건담당자명'))
      const branchManagerName = parseStr(col(row, '지사담당자명'))

      // 필수 체크
      if (!name) verifyReport.missingRequired.push({ row: rowNum, field: '성명', rawValue: String(col(row, '성명') ?? '(빈값)') })
      if (!ssn)  verifyReport.missingRequired.push({ row: rowNum, field: '주민번호', rawValue: String(col(row, '주민번호') ?? '(빈값)') })

      // 상태값 체크
      if (status && !STATUS_MAP[status]) {
        verifyReport.statusWarnings.push({ row: rowNum, value: status })
      }

      // SSN 중복 체크
      if (ssn && patientSsnMap.has(ssn)) {
        verifyReport.ssnDuplicates.push({ row: rowNum, ssn })
      }

      // 담당자 이름 매핑 체크
      const salesManagerId  = salesManagerName ? (userMap.get(salesManagerName) ?? null) : null
      const caseManagerId   = caseManagerName  ? (userMap.get(caseManagerName) ?? null) : null
      const branchManagerId = branchManagerName ? (userMap.get(branchManagerName) ?? null) : null

      if (salesManagerName && !salesManagerId) {
        verifyReport.managerMismatches.push({ row: rowNum, field: '영업담당자명', value: salesManagerName })
      }
      if (caseManagerName && !caseManagerId) {
        verifyReport.managerMismatches.push({ row: rowNum, field: '사건담당자명', value: caseManagerName })
      }
      if (branchManagerName && !branchManagerId) {
        verifyReport.managerMismatches.push({ row: rowNum, field: '지사담당자명', value: branchManagerName })
      }

      // HearingLossDetail
      const firstClinic   = parseStr(col(row, '초진병원'))
      const firstExamDate = parseDate(col(row, '초진일'))
      const firstExamRight = parseFloat2(col(row, '초진우측PTA'))
      const firstExamLeft  = parseFloat2(col(row, '초진좌측PTA'))
      const firstExamSpeech = parseFloat2(col(row, '초진어음명료도'))
      const passedInitialCriteria = parseBool(col(row, '초진기준통과'))
      const isDisabilityRegistered = parseBool(col(row, '국가장애등록'))
      const specialClinic  = parseStr(col(row, '특진병원'))
      const reSpecialClinic = parseStr(col(row, '재특진병원'))
      const exam1Date  = parseDate(col(row, '특진1차일'))
      const exam2Date  = parseDate(col(row, '특진2차일'))
      const exam3Date  = parseDate(col(row, '특진3차일'))
      const reExam1Date = parseDate(col(row, '재특진1차일'))
      const reExam2Date = parseDate(col(row, '재특진2차일'))
      const reExam3Date = parseDate(col(row, '재특진3차일'))
      const expertClinic = parseStr(col(row, '전문조사기관'))
      const expertDate   = parseDate(col(row, '전문조사일'))
      const decisionType = parseStr(col(row, '처분유형'))
      const decisionReceivedAt = parseDate(col(row, '처분일'))
      const disabilityGrade = parseStr(col(row, '장해등급'))

      // HearingLossExam INITIAL
      const hasInitialExam = [
        col(row, '기도(우)PTA'), col(row, '기도(좌)PTA'),
        col(row, '골도(우)PTA'), col(row, '골도(좌)PTA'),
        col(row, '어음명료도(우)'), col(row, '어음명료도(좌)'),
        col(row, 'ABR(우)'), col(row, 'ABR(좌)'),
        col(row, '임피던스(우)'), col(row, '임피던스(좌)'),
        col(row, 'ASSR(우)_메모'), col(row, 'ASSR(좌)_메모'),
      ].some((v) => v !== null && v !== '')

      const initialExam = hasInitialExam ? {
        examSet: 'INITIAL',
        examRound: 3,
        ptaAvgR:   parseFloat2(col(row, '기도(우)PTA')),
        ptaAvgL:   parseFloat2(col(row, '기도(좌)PTA')),
        boneAvgR:  parseFloat2(col(row, '골도(우)PTA')),
        boneAvgL:  parseFloat2(col(row, '골도(좌)PTA')),
        speechRight: parseFloat2(col(row, '어음명료도(우)')),
        speechLeft:  parseFloat2(col(row, '어음명료도(좌)')),
        abrRight:  parseFloat2(col(row, 'ABR(우)')),
        abrLeft:   parseFloat2(col(row, 'ABR(좌)')),
        impedanceRight: parseStr(col(row, '임피던스(우)')),
        impedanceLeft:  parseStr(col(row, '임피던스(좌)')),
        assrRight: parseFloat2(col(row, 'ASSR(우)_메모')),
        assrLeft:  parseFloat2(col(row, 'ASSR(좌)_메모')),
        memo: parseStr(col(row, '특진특이사항')),
      } : null

      // HearingLossExam RE
      const hasReExam = [
        col(row, '재특진기도(우)'), col(row, '재특진기도(좌)'),
        col(row, '재특진골도(우)'), col(row, '재특진골도(좌)'),
        col(row, '재특진어음(우)'), col(row, '재특진어음(좌)'),
      ].some((v) => v !== null && v !== '')

      const reExam = hasReExam ? {
        examSet: 'RE',
        examRound: 3,
        ptaAvgR:  parseFloat2(col(row, '재특진기도(우)')),
        ptaAvgL:  parseFloat2(col(row, '재특진기도(좌)')),
        boneAvgR: parseFloat2(col(row, '재특진골도(우)')),
        boneAvgL: parseFloat2(col(row, '재특진골도(좌)')),
        speechRight: parseFloat2(col(row, '재특진어음(우)')),
        speechLeft:  parseFloat2(col(row, '재특진어음(좌)')),
        abrRight: parseFloat2(col(row, '재특진ABR(우)')),
        abrLeft:  parseFloat2(col(row, '재특진ABR(좌)')),
        impedanceRight: parseStr(col(row, '재특진임피던스(우)')),
        impedanceLeft:  parseStr(col(row, '재특진임피던스(좌)')),
        memo: parseStr(col(row, '재특진특이사항')),
      } : null

      importJobs.push({
        rowNum,
        patient: { name, ssn, phone, address, memo: patMemo },
        case_: {
          caseType, status: STATUS_MAP[status] || 'CONSULTING',
          tfName, branch, subAgent, salesRoute, isOneStop,
          receptionDate, contractDate, kwcOfficeName,
          memo: caseMemo, closedReason,
          salesManagerId, caseManagerId, branchManagerId,
        },
        hld: {
          firstClinic, firstExamDate, firstExamRight, firstExamLeft,
          firstExamSpeech, passedInitialCriteria, isDisabilityRegistered,
          specialClinic, reSpecialClinic,
          specialExam1Date: exam1Date, specialExam2Date: exam2Date, specialExam3Date: exam3Date,
          reSpecialExam1Date: reExam1Date, reSpecialExam2Date: reExam2Date, reSpecialExam3Date: reExam3Date,
          expertClinic, expertDate, decisionType, decisionReceivedAt, disabilityGrade,
        },
        initialExam,
        reExam,
      })
    }

    // ── verify 모드: 검증 결과만 반환 ──────────────────
    if (mode === 'verify') {
      // 담당자 이름 중복 집계 (같은 이름이 여러 행에 반복되므로 unique로)
      const uniqueMismatches = Array.from(
        new Map(
          verifyReport.managerMismatches.map((m) => [`${m.field}:${m.value}`, m])
        ).values()
      )
      const mismatchCounts: Record<string, number> = {}
      for (const m of verifyReport.managerMismatches) {
        const key = `${m.field}:${m.value}`
        mismatchCounts[key] = (mismatchCounts[key] || 0) + 1
      }

      return NextResponse.json({
        ok: true,
        mode: 'verify',
        total: verifyReport.total,
        dbUsers: users.map((u) => u.name),
        managerMismatches: uniqueMismatches.map((m) => ({
          ...m,
          occurrences: mismatchCounts[`${m.field}:${m.value}`] || 1,
        })),
        ssnDuplicates: verifyReport.ssnDuplicates,
        missingRequired: verifyReport.missingRequired,
        statusWarnings: verifyReport.statusWarnings,
        summary: {
          managerMismatchCount:  uniqueMismatches.length,
          ssnDuplicateCount:     verifyReport.ssnDuplicates.length,
          missingRequiredCount:  verifyReport.missingRequired.length,
          statusWarningCount:    verifyReport.statusWarnings.length,
          readyToImport:
            verifyReport.missingRequired.length === 0 &&
            verifyReport.statusWarnings.length === 0,
        },
      })
    }

    // ── import 모드: 실제 DB 저장 ──────────────────────
    const results = { created: 0, updated: 0, errors: [] as any[] }

    for (const job of importJobs) {
      try {
        await prisma.$transaction(async (tx) => {
          if (!job.patient.ssn || !job.patient.name) {
            throw new Error('성명 또는 주민번호 없음')
          }

          // Patient upsert
          const patient = await tx.patient.upsert({
            where: { ssn: job.patient.ssn },
            create: {
              name:    job.patient.name,
              ssn:     job.patient.ssn,
              phone:   job.patient.phone,
              address: job.patient.address,
              memo:    job.patient.memo,
            },
            update: {
              name:  job.patient.name,
              phone: job.patient.phone ?? undefined,
              address: job.patient.address ?? undefined,
            },
          })

          const isNew = !patientSsnMap.has(job.patient.ssn)

          // Case 생성 (항상 신규 — 동일 patient라도 사건은 별개)
          // 단, 같은 caseType의 기존 사건이 있으면 skip
          const existingCase = await tx.case.findFirst({
            where: { patientId: patient.id, caseType: job.case_.caseType },
          })

          let caseRecord
          if (existingCase) {
            // 기존 사건 업데이트
            caseRecord = await tx.case.update({
              where: { id: existingCase.id },
              data: {
                status:          job.case_.status,
                tfName:          job.case_.tfName,
                branch:          job.case_.branch,
                subAgent:        job.case_.subAgent,
                salesRoute:      job.case_.salesRoute,
                isOneStop:       job.case_.isOneStop,
                receptionDate:   job.case_.receptionDate,
                contractDate:    job.case_.contractDate,
                kwcOfficeName:   job.case_.kwcOfficeName,
                memo:            job.case_.memo,
                closedReason:    job.case_.closedReason,
                salesManagerId:  job.case_.salesManagerId,
                caseManagerId:   job.case_.caseManagerId,
                branchManagerId: job.case_.branchManagerId,
              },
            })
            results.updated++
          } else {
            caseRecord = await tx.case.create({
              data: {
                patientId:       patient.id,
                caseType:        job.case_.caseType,
                status:          job.case_.status,
                tfName:          job.case_.tfName,
                branch:          job.case_.branch,
                subAgent:        job.case_.subAgent,
                salesRoute:      job.case_.salesRoute,
                isOneStop:       job.case_.isOneStop,
                receptionDate:   job.case_.receptionDate,
                contractDate:    job.case_.contractDate,
                kwcOfficeName:   job.case_.kwcOfficeName,
                memo:            job.case_.memo,
                closedReason:    job.case_.closedReason,
                salesManagerId:  job.case_.salesManagerId,
                caseManagerId:   job.case_.caseManagerId,
                branchManagerId: job.case_.branchManagerId,
              },
            })
            results.created++
          }

          // HearingLossDetail upsert
          await tx.hearingLossDetail.upsert({
            where: { caseId: caseRecord.id },
            create: {
              caseId: caseRecord.id,
              ...job.hld,
            },
            update: { ...job.hld },
          })

          // HearingLossExam — INITIAL
          if (job.initialExam) {
            const existingExam = await tx.hearingLossExam.findFirst({
              where: {
                hearingLossDetail: { caseId: caseRecord.id },
                examSet: 'INITIAL',
                examRound: 3,
              },
              include: { hearingLossDetail: true },
            })
            const hld2 = await tx.hearingLossDetail.findUnique({
              where: { caseId: caseRecord.id },
            })
            if (hld2) {
              if (existingExam) {
                await tx.hearingLossExam.update({
                  where: { id: existingExam.id },
                  data: job.initialExam,
                })
              } else {
                await tx.hearingLossExam.create({
                  data: {
                    hearingLossDetailId: hld2.id,
                    ...job.initialExam,
                  },
                })
              }
            }
          }

          // HearingLossExam — RE
          if (job.reExam) {
            const hld2 = await tx.hearingLossDetail.findUnique({
              where: { caseId: caseRecord.id },
            })
            if (hld2) {
              const existingReExam = await tx.hearingLossExam.findFirst({
                where: {
                  hearingLossDetailId: hld2.id,
                  examSet: 'RE',
                  examRound: 3,
                },
              })
              if (existingReExam) {
                await tx.hearingLossExam.update({
                  where: { id: existingReExam.id },
                  data: job.reExam,
                })
              } else {
                await tx.hearingLossExam.create({
                  data: {
                    hearingLossDetailId: hld2.id,
                    ...job.reExam,
                  },
                })
              }
            }
          }
        })
      } catch (e: any) {
        results.errors.push({
          row: job.rowNum,
          name: job.patient.name,
          ssn: job.patient.ssn,
          error: e.message,
        })
      }
    }

    return NextResponse.json({
      ok: true,
      mode: 'import',
      ...results,
      total: importJobs.length,
    })
  } catch (e: any) {
    console.error('[import-hearing-loss]', e)
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
