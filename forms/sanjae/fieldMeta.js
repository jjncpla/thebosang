export const FIELD_MAP = [
  // ── 기본 정보 ──────────────────────────────────────────────────
  { key: 'worker.name', x: 49.74, y: 59.3 },

  // ── 생년월일 ───────────────────────────────────────────────────
  { key: 'birthSplit.y1', x: 100.81, y: 60.59 },
  { key: 'birthSplit.y2', x: 106.89, y: 60.59 },
  { key: 'birthSplit.y3', x: 112.45, y: 60.59 },
  { key: 'birthSplit.y4', x: 118.8,  y: 60.59 },
  { key: 'birthSplit.m1', x: 129.65, y: 60.59 },
  { key: 'birthSplit.m2', x: 135.0,  y: 60.59 },
  { key: 'birthSplit.d1', x: 146.58, y: 60.59 },
  { key: 'birthSplit.d2', x: 153.2,  y: 60.59 },

  // ── 재해발생일 ─────────────────────────────────────────────────
  { key: 'accidentDateSplit.y1', x: 35.98, y: 71.17 },
  { key: 'accidentDateSplit.y2', x: 42.33, y: 71.17 },
  { key: 'accidentDateSplit.y3', x: 48.15, y: 71.17 },
  { key: 'accidentDateSplit.y4', x: 54.24, y: 71.17 },
  { key: 'accidentDateSplit.m1', x: 65.35, y: 71.17 },
  { key: 'accidentDateSplit.m2', x: 71.44, y: 71.17 },
  { key: 'accidentDateSplit.d1', x: 82.55, y: 71.17 },
  { key: 'accidentDateSplit.d2', x: 88.11, y: 71.17 },

  // ── 청구 유형 체크박스 ─────────────────────────────────────────
  // 스크린샷 확인: [ ] 장해급여 / [ ] 합병증 박스는 제목 중앙부(x≈260px)
  { key: 'confirm.disabilityClaim', x: 68.77, y: 32.80 },
  { key: 'confirm.preventionClaim', x: 68.77, y: 39.14 },

  // ── 계좌 변경 / 유형 체크박스 ──────────────────────────────────
  { key: 'account.change',      x: 99.18, y: 76.43 },
  { key: 'account.typeRegular', x: 40.47, y: 96.52 },
  { key: 'account.typeSaving',  x: 76.44, y: 96.52 },

  // ── 계좌 정보 ──────────────────────────────────────────────────
  { key: 'bankName',      x: 74.06, y: 83.31 },
  { key: 'accountNumber', x: 74.06, y: 89.39 },

  // ── 기왕증 / 보상 수령 체크박스 ────────────────────────────────
  // 스크린샷 확인: 기존 x=40,y=150 → 오른쪽 끝 체크박스 위치로 수정
  { key: 'confirm.preExistingDisability', x: 153.0, y: 103.14 },
  { key: 'confirm.compensationReceived',  x: 153.0, y: 111.08 },

  // ── 보상 내역 ──────────────────────────────────────────────────
  { key: 'compensation.date',   x: 29.09, y: 130.82 },
  { key: 'compensation.amount', x: 58.19, y: 130.82 },
  { key: 'compensation.payer',  x: 84.61, y: 130.82 },
  { key: 'transportCost',       x: 48.11, y: 139.80 },

  // ── 상병명 / 병원명 ────────────────────────────────────────────
  // 스크린샷 확인: y=543은 이송비 행 → 합병증 행(y≈587)으로 수정
  { key: 'disease.name',         x: 33.83,  y: 155.12 },
  { key: 'disease.hospitalName', x: 134.82, y: 155.91 },

  // ── 청구인 / 대리인 ────────────────────────────────────────────
  // 스크린샷 확인: claimant.name y=638 → 청구인 행(y≈679)으로 수정
  { key: 'claimant.name',   x: 113.0,  y: 179.44 },
  { key: 'worker.phone',    x: 161.66, y: 181.5  },
  { key: 'claim.agentName', x: 113.0,  y: 184.21 },
  { key: 'claim.phone',     x: 161.66, y: 186.27 },

  // ── 지사명 ─────────────────────────────────────────────────────
  { key: 'branchName', x: 101.6, y: 263.5 },

  // ── 작성일 ─────────────────────────────────────────────────────
  { key: 'claimDateSplit.y1', x: 135.73, y: 176.74 },
  { key: 'claimDateSplit.y2', x: 137.73, y: 176.74 },
  { key: 'claimDateSplit.y3', x: 139.73, y: 176.74 },
  { key: 'claimDateSplit.y4', x: 141.73, y: 176.74 },
  { key: 'claimDateSplit.m1', x: 153.99, y: 176.74 },
  { key: 'claimDateSplit.m2', x: 155.99, y: 176.74 },
  { key: 'claimDateSplit.d1', x: 164.84, y: 176.74 },
  { key: 'claimDateSplit.d2', x: 166.84, y: 176.74 },
];
