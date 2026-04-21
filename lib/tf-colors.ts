import { TF_BY_BRANCH, TF_TO_BRANCH } from '@/lib/constants/tf'

/**
 * 지사별 베이스 컬러(팔레트) — 하드코딩 fallback.
 * 실제 런타임 색상은 Branch.colorBase (DB) 우선, 없을 때만 이 값을 사용.
 * `BRANCH_BASE_COLORS` 이름으로 export해서 init API의 seed 값으로도 사용됨.
 */
export const BRANCH_BASE_COLORS: Record<string, string> = {
  '노무법인 더보상 울산지사':       '#006838', // 진녹
  '노무법인 더보상 울산동부지사':   '#29ABE2', // 하늘
  '노무법인 더보상 부산경남지사':   '#E74C3C', // 빨강
  '노무법인 더보상 부산중부지사':   '#C0392B', // 적색
  '노무법인 더보상 경남창원지사':   '#9B59B6', // 보라
  '노무법인 더보상 경북포항지사':   '#3498DB', // 파랑
  '노무법인 더보상 경북구미지사':   '#FF5722', // 주황빨강
  '노무법인 더보상 대구지사':       '#E91E63', // 핑크
  '노무법인 더보상 서울북부지사':   '#1ABC9C', // 민트
  '노무법인 더보상 강원동해지사':   '#00BCD4', // 시안
  '노무법인 더보상 경기안산지사':   '#F39C12', // 주황
  '노무법인 더보상 경기의정부지사': '#8E44AD', // 진보라
  '노무법인 더보상 대전지사':       '#4CAF50', // 초록
  '노무법인 더보상 경기수원지사':   '#16A085', // 청록
  '노무법인 더보상 경인지사':       '#2980B9', // 진파랑
  '노무법인 더보상 서울구로지사':   '#D35400', // 황갈
  '노무법인 더보상':                 '#795548', // 갈색 (본사/기타)
  '노무법인 더보상 산재연구원':      '#607D8B', // 청회색
  '노무법인 더보상 전북익산지사':   '#AD1457', // 진핑크
  '노무법인 더보상 전남여수지수':   '#FF9800', // 주황
  '노무법인 더보상 전남여수지사':   '#FF9800', // (오타 대비)
  '노무법인 더보상 전남순천지사':   '#880E4F', // 와인
  // 신규 지사
  '노무법인 더보상 재해보상법률원': '#6A1B9A', // 진보라
  '노무법인 더보상 어선원':          '#5D4037', // 진갈
  '노무법인 더보상 대구중부지사':    '#4A148C', // 딥퍼플
  '노무법인 더보상 기타':            '#78909C', // 회색청 (세분화 전/특수 그룹)
}

/** HEX 색을 밝기(Y)에 따라 더 어둡게/밝게 조정 (명도만 변경) */
function adjustLightness(hex: string, delta: number): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)))
  const nr = clamp(r + delta)
  const ng = clamp(g + delta)
  const nb = clamp(b + delta)
  return '#' + [nr, ng, nb].map(v => v.toString(16).padStart(2, '0')).join('')
}

/** TF 이름 해시 → HSL (지사 매핑 실패 시 fallback) */
function hashColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0
  const hue = Math.abs(hash) % 360
  return `hsl(${hue}, 55%, 45%)`
}

/**
 * TF 이름 → 색상.
 * @param tfName
 * @param branchColorOverride DB에서 로드한 지사별 색상 맵 (선택). 있으면 이 값 우선.
 *
 * - TF_BY_BRANCH 에 등록된 TF는 해당 지사 팔레트 기반 (지사 내 순서에 따라 명도 변형)
 * - 'Legacy' / '미분류' 은 회색
 * - 미등록 TF 는 해시 기반 고유 색상
 */
export function getTFColor(tfName: string, branchColorOverride?: Record<string, string>): string {
  if (!tfName) return '#95A5A6'
  if (tfName === 'Legacy' || tfName === '미분류') return '#95A5A6'

  const resolveBase = (branch: string): string | undefined => {
    return branchColorOverride?.[branch] ?? BRANCH_BASE_COLORS[branch]
  }

  const branch = TF_TO_BRANCH[tfName]
  if (branch) {
    const base = resolveBase(branch)
    if (base) {
      const tfs = TF_BY_BRANCH[branch] || []
      const idx = tfs.indexOf(tfName)
      // 같은 지사 내 index에 따라 -30 ~ +30 범위로 명도 조절
      const delta = (idx - (tfs.length - 1) / 2) * 20
      return adjustLightness(base, delta)
    }
  }

  // 접두어 기반 추정: "더보상XXX" / "이산XXX" → XXX 로 TF_TO_BRANCH 재시도
  for (const prefix of ['더보상', '이산']) {
    if (tfName.startsWith(prefix)) {
      const stripped = tfName.slice(prefix.length)
      const b = TF_TO_BRANCH[stripped]
      if (b) {
        const base = resolveBase(b)
        if (base) return adjustLightness(base, prefix === '더보상' ? -20 : 20)
      }
    }
  }

  return hashColor(tfName)
}

/** 레거시 하드코딩 맵 호환용 export (다른 곳에서 쓰이는지 확인 후 제거 가능) */
export const TF_COLORS: Record<string, string> = {}
