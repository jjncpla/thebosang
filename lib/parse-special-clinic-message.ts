export interface ParsedSchedule {
  patientName: string
  tfName: string
  hospitalName: string
  clinicType: string
  examRound: number
  scheduledDate: Date | null
  isAllDay: boolean
  scheduledHour?: number
  scheduledMinute?: number
  status: "scheduled" | "done" | "cancelled" | "unknown"
  memo: string
}

export type TfOrg = '이산' | '더보상' | 'neutral'

export interface ParseOptions {
  /**
   * TF 조직명.
   * - '이산': 접두어 없는 TF명에 '이산' 자동 부여 (이산TF 전용방)
   * - '더보상': 접두어 없는 TF명에 '더보상' 자동 부여 (더보상 전용방)
   * - 'neutral': 메시지 TF명 원본 그대로 보존 (이산·더보상 혼재 통합방)
   * 기본값 '이산' (기존 호환).
   */
  tfOrg?: TfOrg
}

/** 헤더·병원명에서 떼어낼 수식어·업무 키워드 */
const HOSPITAL_SUFFIX_KEYWORDS = [
  '재특진', '특진', '난청', '산업성', '진폐',
  '일정변경', '일정', '변경', '종료', '결과',
]

function cleanHospitalName(raw: string): string {
  let s = raw.trim()
  // 헤더 토큰 중 첫 수식어 키워드 위치에서 잘라내기
  for (const kw of HOSPITAL_SUFFIX_KEYWORDS) {
    const idx = s.indexOf(kw)
    if (idx > 0) {
      s = s.slice(0, idx).trim()
    }
  }
  // 남은 수식어 제거(혹시 병원명 뒤에 붙은 게 있으면)
  s = s.replace(/\s*(재특진|특진|난청|산업성|진폐|일정변경|일정|변경|종료|결과)\s*$/g, '').trim()
  return s
}

export function parseSpecialClinicMessage(
  text: string,
  sender: string,
  msgDate: Date,
  options: ParseOptions = {}
): ParsedSchedule[] {
  const tfOrg: TfOrg = options.tfOrg ?? '이산'
  const lines = text.split('\n')
  const results: ParsedSchedule[] = []

  // ---- STEP A: 헤더 파싱 ----
  let hospitalName = ''
  let clinicType = '특진'

  for (const line of lines) {
    const headerMatch = line.match(/<\s*(.+?)\s*>/)
    if (headerMatch) {
      const headerText = headerMatch[1]
      // clinicType
      if (headerText.includes('재특진')) {
        clinicType = '재특진'
      } else if (headerText.includes('특진')) {
        clinicType = '특진'
      }
      // 병원명: 수식어 키워드 이전 텍스트 (이산 "<부산대 특진 난청>" / 더보상 "<부산의원 난청 특진 일정>" 양쪽 대응)
      hospitalName = cleanHospitalName(headerText)
      break
    }
  }

  // ---- STEP B: 줄별 파싱 ----
  let currentPatient = ''
  let currentTF = ''
  let memo = ''

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) continue

    // 헤더 줄 skip
    if (line.startsWith('<') && line.includes('>')) continue

    // 마무리 문구 skip
    if (/일정안내\s*완료|재해자\s*안내\s*완료|안내\s*완료/i.test(line)) continue

    // 환자 라인 감지 — 두 가지 포맷 지원
    //   (A) "환자명(TF명/팀)"          — 기존 이산TF 포맷
    //   (B) "환자명 / TF명 (담당자)"   — 통합방 포맷 ("/" 구분자, TF가 괄호 밖)
    //   (C) "환자명 (영문) / TF명 (담당자)" — 통합방 확장 포맷
    if (!line.startsWith('*') && !line.startsWith('<') && line.includes('TF') && /^[가-힣a-zA-Z]/.test(line)) {
      const slashIdx = line.indexOf('/')
      const firstParenIdx = line.indexOf('(')
      // 괄호가 '/' 뒤에 있거나, 괄호 내용이 TF 미포함이면 "/" 구분자 포맷으로 시도
      const useSlashFormat = slashIdx > -1 && (
        firstParenIdx === -1 ||
        firstParenIdx > slashIdx ||
        !line.slice(firstParenIdx, slashIdx).includes('TF')
      )

      if (useSlashFormat) {
        const parts = line.split('/').map(p => p.trim())
        // 환자명: 첫 파트의 '(' 이전 (영문명 괄호 제거)
        const firstPart = parts[0]
        const pIdx = firstPart.indexOf('(')
        const name = (pIdx > 0 ? firstPart.slice(0, pIdx) : firstPart).trim().replace(/\s+/g, '')
        // TF: 두 번째 이후 파트 중 TF 포함한 첫 번째 (괄호 앞까지)
        let tfFound = ''
        for (const part of parts.slice(1)) {
          const pi = part.indexOf('(')
          const candidate = (pi > 0 ? part.slice(0, pi) : part).trim()
          if (candidate.includes('TF')) { tfFound = candidate; break }
        }
        if (name && tfFound) {
          currentPatient = name
          currentTF = normalizeTfName(tfFound, tfOrg)
          memo = ''
          continue
        }
      }

      // (A) 기존 포맷: "환자명(TF명/팀)"
      if (firstParenIdx > 0) {
        currentPatient = line.slice(0, firstParenIdx).trim().replace(/\s+/g, '')
        const parenMatches = line.match(/\(([^)]+)\)/g)
        if (parenMatches) {
          for (const pm of parenMatches) {
            const inner = pm.slice(1, -1)
            if (inner.includes('TF')) {
              const tfPart = inner.split('/')[0].trim()
              currentTF = normalizeTfName(tfPart, tfOrg)
              break
            }
          }
        }
        memo = ''
        continue
      }
    }

    // 일정 라인 감지: (옵션) *로 시작 + '숫자차' + ':' 포함
    //   통합방에는 "*" 없이 "1차 종료 : ..." 바로 쓰는 경우도 있음
    const isScheduleLine = /^\*?\s*\d+\s*차/.test(line) && line.includes(':')
    if (isScheduleLine && currentPatient) {
      // 회차 추출 (별표 유무 무관)
      const roundMatch = line.match(/\*?\s*(\d+)\s*차/)
      const examRound = roundMatch ? parseInt(roundMatch[1]) : 1

      // 종료/완료 여부
      const isDone = /종료|완료/.test(line)

      // 화살표 처리
      const arrowMatch = line.match(/(?:->|→|>>)(.+)$/)
      let datePart = line
      let status: ParsedSchedule['status'] = isDone ? 'done' : 'scheduled'

      if (arrowMatch) {
        const newPart = arrowMatch[1].trim()
        if (newPart.includes('취소')) {
          status = 'cancelled'
          results.push({
            patientName: currentPatient,
            tfName: currentTF,
            hospitalName,
            clinicType,
            examRound,
            scheduledDate: null,
            isAllDay: true,
            status,
            memo: memo.trim(),
          })
          memo = ''
          continue
        } else if (newPart.includes('미정')) {
          status = 'unknown'
          results.push({
            patientName: currentPatient,
            tfName: currentTF,
            hospitalName,
            clinicType,
            examRound,
            scheduledDate: null,
            isAllDay: true,
            status,
            memo: memo.trim(),
          })
          memo = ''
          continue
        } else {
          // 변경 후 일정 사용
          datePart = newPart
        }
      }

      // 날짜 파싱
      const dateResult = parseDate(datePart, msgDate)
      // 시간 파싱
      const timeResult = parseTime(datePart)

      results.push({
        patientName: currentPatient,
        tfName: currentTF,
        hospitalName,
        clinicType,
        examRound,
        scheduledDate: dateResult,
        isAllDay: !timeResult,
        scheduledHour: timeResult?.hour,
        scheduledMinute: timeResult?.minute ?? 0,
        status,
        memo: memo.trim(),
      })
      memo = ''
      continue
    }

    // 메모성 줄 누적 (환자/일정 라인 아닌 경우)
    if (currentPatient && !line.startsWith('<')) {
      if (memo) memo += ' '
      memo += line
    }
  }

  return results
}

function normalizeTfName(name: string, tfOrg: TfOrg = '이산'): string {
  const trimmed = name.trim()
  // 이미 조직 접두어가 붙은 경우 그대로 보존
  if (trimmed.startsWith('더보상') || trimmed.startsWith('이산')) {
    return trimmed
  }
  // 통합방(neutral)은 원본 그대로 — 이산·더보상 혼재 환경에서 강제 분류 금지
  if (tfOrg === 'neutral') {
    return trimmed
  }
  return tfOrg + trimmed
}

function parseDate(text: string, msgDate: Date): Date | null {
  // 1) 4자리 연도: 2026.01.15
  let m = text.match(/(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})/)
  if (m) {
    return new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]))
  }

  // 2) 2자리 연도 (점 3개): 25.01.15.
  m = text.match(/(\d{2})\.\s*(\d{1,2})\.\s*(\d{1,2})\./)
  if (m) {
    const year = 2000 + parseInt(m[1])
    return new Date(year, parseInt(m[2]) - 1, parseInt(m[3]))
  }

  // 3) MM.DD. (괄호 앞)
  m = text.match(/(\d{1,2})\.\s*(\d{1,2})\.\s*[（(]/)
  if (m) {
    return inferYear(parseInt(m[1]), parseInt(m[2]), msgDate)
  }

  // 4) MM.DD (줄 끝 또는 공백)
  m = text.match(/(\d{1,2})\.\s*(\d{1,2})\.?\s*(?:$|\s|[（(])/)
  if (m) {
    return inferYear(parseInt(m[1]), parseInt(m[2]), msgDate)
  }

  return null
}

function inferYear(month: number, day: number, msgDate: Date): Date {
  const year = msgDate.getFullYear()
  const candidate = new Date(year, month - 1, day)
  // 3개월 이상 과거면 다음 연도
  const diff = msgDate.getTime() - candidate.getTime()
  if (diff > 90 * 24 * 60 * 60 * 1000) {
    return new Date(year + 1, month - 1, day)
  }
  return candidate
}

function parseTime(text: string): { hour: number; minute: number } | null {
  // "10 : 15", "09:30", "16:00", "10시30분"
  const m = text.match(/(\d{1,2})\s*[:\u{C2DC}]\s*(\d{0,2})(?:\s*\u{BD84})?/u)
  if (m) {
    const hour = parseInt(m[1])
    const minute = m[2] ? parseInt(m[2]) : 0
    // 유효한 시간인지 확인 (0-23)
    if (hour >= 0 && hour <= 23) {
      return { hour, minute }
    }
  }
  return null
}
