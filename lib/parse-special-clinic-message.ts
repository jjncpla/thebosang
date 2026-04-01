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

export function parseSpecialClinicMessage(
  text: string,
  sender: string,
  msgDate: Date
): ParsedSchedule[] {
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
      // 병원명: "난청" 이전 텍스트
      const hospMatch = headerText.match(/^(.+?)\s*난청/)
      if (hospMatch) {
        hospitalName = hospMatch[1].trim()
      }
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

    // 환자 라인 감지
    if (!line.startsWith('*') && !line.startsWith('<') && line.includes('(') && line.includes('TF') && /^[가-힣a-zA-Z]/.test(line)) {
      // 환자명: 첫 '(' 이전 텍스트
      const nameEnd = line.indexOf('(')
      currentPatient = line.slice(0, nameEnd).trim()
      // 숫자 접미사 포함 (김병수6 등)
      currentPatient = currentPatient.replace(/\s+/g, '')

      // TF 추출: 괄호 내용 중 TF 포함 첫 번째
      const parenMatches = line.match(/\(([^)]+)\)/g)
      if (parenMatches) {
        for (const pm of parenMatches) {
          const inner = pm.slice(1, -1)
          if (inner.includes('TF')) {
            // 첫 '/' 이전
            const tfPart = inner.split('/')[0].trim()
            currentTF = tfPart
            break
          }
        }
      }
      memo = ''
      continue
    }

    // 일정 라인 감지: *로 시작, '차' 포함, ':' 포함
    const isScheduleLine = /^\*/.test(line) && line.includes('차') && line.includes(':')
    if (isScheduleLine && currentPatient) {
      // 회차 추출
      const roundMatch = line.match(/\*\s*(\d+)\s*차/)
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
