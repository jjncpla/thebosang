/**
 * transformSanJae.js — PDF 전용 변환
 *
 * 입력 data 키:
 *   victimName, birthDate, accidentDate, claimDate
 *   officeName, bankName, accountNumber
 *   claimantName, claimantPhone
 *   agentName, agentPhone
 *   disabilityClaim (boolean), preventionClaim (boolean)
 *   accountChange (boolean), accountType ('regular' | 'saving')
 *   preExistingDisability (boolean), compensationReceived (boolean)
 *   compensationDate, compensationAmount, compensationPayer
 *   transportCost
 *   diseaseName, hospitalName
 */

export function transformSanJae(data) {
  return {
    // 근로자
    worker: {
      name:  data.victimName    ?? '',
      phone: data.claimantPhone ?? '',
    },

    // 지사명
    branchName: data.officeName?.replace(/지사$/, '') ?? '',

    // 계좌 정보
    bankName:      data.bankName      ?? '',
    accountNumber: data.accountNumber ?? '',

    // 청구 유형 체크박스 (장해급여 / 예방급여)
    confirm: {
      disabilityClaim:      tick(data.disabilityClaim),
      preventionClaim:      tick(data.preventionClaim),
      preExistingDisability: tick(data.preExistingDisability),
      compensationReceived:  tick(data.compensationReceived),
    },

    // 계좌 변경 / 유형 체크박스
    account: {
      change:      tick(data.accountChange),
      typeRegular: tick(data.accountType === 'regular'),
      typeSaving:  tick(data.accountType === 'saving'),
    },

    // 보상 내역
    compensation: {
      date:   data.compensationDate   ?? '',
      amount: data.compensationAmount ?? '',
      payer:  data.compensationPayer  ?? '',
    },

    // 교통비
    transportCost: data.transportCost ?? '',

    // 상병명 / 병원명
    disease: {
      name:         data.diseaseName  ?? '',
      hospitalName: data.hospitalName ?? '',
    },

    // 청구인
    claimant: {
      name: data.claimantName ?? '',
    },

    // 대리인
    claim: {
      agentName: data.agentName  ?? '',
      phone:     data.agentPhone ?? '',
    },

    // 날짜 분해
    birthSplit:        splitDate(data.birthDate),
    accidentDateSplit: splitDate(data.accidentDate),
    claimDateSplit:    splitDate(data.claimDate),
  };
}

// ✔ 또는 빈 문자열 반환
function tick(value) {
  return value ? '✔' : '';
}

// 날짜 분해 (YYYYMMDD 또는 YYYY-MM-DD)
function splitDate(date) {
  if (!date) return {};

  if (date.length === 8) {
    return {
      y1: date[0], y2: date[1], y3: date[2], y4: date[3],
      m1: date[4], m2: date[5],
      d1: date[6], d2: date[7],
    };
  }

  const [y, m, d] = date.split('-');

  return {
    y1: y?.[0], y2: y?.[1], y3: y?.[2], y4: y?.[3],
    m1: m?.[0], m2: m?.[1],
    d1: d?.[0], d2: d?.[1],
  };
}
