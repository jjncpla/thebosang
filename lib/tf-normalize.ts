import { ALL_TF_LIST } from '@/lib/constants/tf'

/**
 * TF 이름 정규화 — 단일 진실의 원천은 TF_BY_BRANCH (lib/constants/tf.ts).
 *
 * 통합방 메시지에서 유입되는 다양한 TF 표기를 canonical 형태로 통일한다.
 * - 이미 표준이면 그대로
 * - 접두어 없는 지역명은 이산XXX 기본 부여
 * - 더보상 약칭(울동·부중·부경·...)은 더보상XXXTF 로 매핑
 * - 담당자·직급·님이 붙은 형태는 TF 부분만 남김
 * - 매칭 실패 시 원본 유지 (수동 정리 여지 남김)
 */

const STANDARD_SET = new Set(ALL_TF_LIST)

/** 명시적 alias — 약칭·별칭·오타 → 표준명 */
const EXPLICIT_ALIAS: Record<string, string> = {
  // 더보상 약칭
  '울동TF': '더보상울동TF',
  '부중TF': '더보상부중TF',
  '부경TF': '더보상부경TF',
  // 표기 변형 (이산 접두어 누락)
  '울산동부TF': '이산울산동부TF',
  '울산남부TF': '이산울산남부TF',
  '울산북부TF': '이산울산북부TF',
  '부산북부TF': '이산부산북부TF',
  '부산서부TF': '이산부산서부TF',
  '부산지역본부TF': '이산부산지역본부TF',
  '대구달서TF': '이산대구달서TF',
  '대구수성TF': '이산대구수성TF',
  '서울지역본부TF': '이산서울지역본부TF',
  '서울동부TF': '이산서울동부TF',
  '인천북부TF': '이산인천북부TF',
  '직업병상담소TF': '더보상직업병상담소TF',
  // 흔한 오타
  '율동TF': '더보상울동TF',
  '이상인천TF': '이산인천TF',
  '더보싱익산TF': '더보상익산TF',
  '이상평택TF': '이산평택TF',
}

/** 특수·Legacy TF — 정규화 대상에서 제외 (그대로 유지) */
const KEEP_AS_IS = new Set([
  'Legacy', '미분류',
  '경북TF', '진폐TF',  // 통합방에서 자주 쓰이는 특수 그룹 TF
])

/** 담당자·직급·변형 표기를 모두 제거하여 정규화된 TF 부분만 반환 */
function stripHandlerSuffix(raw: string): string {
  let s = raw.trim()

  // 감싸는 괄호 제거: "(전북TF)" → "전북TF"
  if (s.startsWith('(') && s.endsWith(')')) s = s.slice(1, -1).trim()
  // 앞에만 붙은 여는 괄호: "(마곡TF" → "마곡TF"
  s = s.replace(/^\(+/, '').trim()

  // 구분자 뒤 버림: /, (, &, ,
  const slashIdx = s.indexOf('/')
  if (slashIdx > -1) s = s.slice(0, slashIdx).trim()
  const parenIdx = s.indexOf('(')
  if (parenIdx > -1) s = s.slice(0, parenIdx).trim()
  const ampIdx = s.indexOf('&')
  if (ampIdx > -1) s = s.slice(0, ampIdx).trim()
  const commaIdx = s.indexOf(',')
  if (commaIdx > -1) s = s.slice(0, commaIdx).trim()

  // 언더스코어를 공백으로 치환 (후처리에서 공백 제거됨)
  s = s.replace(/_+/g, ' ')

  // "...TF" 로 끝나는 가장 긴 접두부만 남김 — 그 뒤는 모두 담당자/직급/부가정보
  //   예: "평택TF) 강병훈 과장님"   → "평택TF"
  //       "대구수성TF ) 이광희"     → "대구수성TF"
  //       "울산TF-북"                → "울산TF" (하이픈 뒤 변형 제거)
  //       "더보상 여수TF"            → "더보상 여수TF" (공백 유지, 후처리에서 제거)
  const m = s.match(/^(.*?TF)(?![가-힣a-zA-Z0-9])/)
  if (m) s = m[1].trim()

  // 내부 공백 전부 제거: "청주 TF" → "청주TF", "더보상 여수TF" → "더보상여수TF"
  s = s.replace(/\s+/g, '')

  return s
}

/**
 * TF 이름을 canonical 형태로 변환.
 * 표준 목록(ALL_TF_LIST)에 맞추되, 매칭 실패 시 원본 유지.
 */
export function canonicalizeTfName(raw: string | null | undefined): string {
  if (!raw) return ''
  let s = raw.trim()
  if (!s) return ''

  if (KEEP_AS_IS.has(s)) return s

  // 담당자·괄호 등 꼬리 정리
  s = stripHandlerSuffix(s)
  if (!s) return raw.trim()

  // 정리 후 특수 TF 재확인
  if (KEEP_AS_IS.has(s)) return s

  // 이미 표준이면 그대로
  if (STANDARD_SET.has(s)) return s

  // 명시적 alias
  if (EXPLICIT_ALIAS[s]) return EXPLICIT_ALIAS[s]

  // 접두어 없는 지역명 → 이산 기본 부여 시도 (이산 버전이 표준에 존재할 때만)
  // 더보상 자동 매핑은 하지 않음 (약칭은 EXPLICIT_ALIAS로만 지원) — 모호한 지역명이 더보상 팀으로 오매핑되는 것 방지
  if (!s.startsWith('이산') && !s.startsWith('더보상')) {
    const withIsan = '이산' + s
    if (STANDARD_SET.has(withIsan)) return withIsan
  }

  // 매칭 실패: 원본 유지
  return s
}

/**
 * TF명이 정규화 표준인지 판별.
 * 기준: TF_BY_BRANCH에 명시된 이름(ALL_TF_LIST)에 정확히 일치해야 함.
 * → `이산XXX` 또는 `더보상XXX` 접두어가 정확히 하나 붙은 형태만 canonical.
 *
 * Legacy / 경북TF / 진폐TF 같은 KEEP_AS_IS는 canonicalize 단계에선 보존되지만
 * 이 함수는 false 반환 → 사용자 정리 대상(unclassified) 목록에 포함됨.
 */
export function isCanonicalTf(name: string): boolean {
  return STANDARD_SET.has(name)
}
