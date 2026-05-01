// 근로복지공단 지사 상세 정보
// 출처: https://www.comwel.or.kr/comwel/intr/srch/srch.jsp 부산지역본부 표본 (2026-05-01 WebFetch)
// 기본 95개 기관 데이터는 public/data/gongdan-branches.json (주소·관할·전화·팩스만)
// 이 파일에서는 우편번호·교통편·업무내용·운영시간 등 보강 정보를 제공
// → 기관명을 키로 매칭, 사용자가 추후 수동 채우는 placeholder 구조

export type KwcBranchDetail = {
  postalCode?: string;        // 우편번호
  representativeTel?: string; // 대표 전화 (1588-0075 등 콜센터 번호)
  email?: string;
  hours?: string;             // 운영 시간 (예: "평일 09:00-18:00")
  directions?: string;        // 교통편 / 오시는 길
  parkingInfo?: string;       // 주차 안내
  services?: string[];        // 주요 업무 / 서비스 항목
  specialUnits?: Array<{      // 특수부서 (예: 소음성난청전담TF)
    name: string;
    address?: string;
    tel?: string;
  }>;
};

// 기관명 → 상세 정보 매핑
// (현재는 부산지역본부만 채워져 있고, 나머지는 사용자가 점진적으로 채워나갈 예정)
export const KWC_BRANCH_DETAILS: Record<string, KwcBranchDetail> = {
  부산지역본부: {
    postalCode: "48731",
    representativeTel: "1588-0075",
    hours: "평일 09:00-18:00 (점심시간 12:00-13:00)",
    directions: "부산지하철 1호선 초량역 10번 출구 도보 5분",
    parkingInfo: "건물 지하주차장 이용 가능 (협소하여 대중교통 권장)",
    services: [
      "보험 적용 및 부과",
      "피보험자 자격관리",
      "산재보상·재활지원",
      "부정수급 예방 및 조사",
      "진료비·약제비 심사",
      "근로자 복지사업 (퇴직연금, 임금채권, 신용보증)",
      "일자리안정자금 지원",
    ],
    specialUnits: [
      {
        name: "소음성난청전담TF",
        address: "부산광역시 금정구 중앙대로1763번길 26, 3층 (46274)",
      },
    ],
  },

  // ─── placeholder (사용자 추후 수동 입력) ──────────────────────────────────
  // 아래 항목은 운영시간·콜센터·주요 업무 공통값
  // 추후 각 지사별 교통편·우편번호 추가 가능
};

// 모든 지사에 공통 적용되는 기본값 (개별 지사 정보가 없을 때 fallback)
export const KWC_DEFAULT_DETAIL: KwcBranchDetail = {
  representativeTel: "1588-0075",
  hours: "평일 09:00-18:00 (점심시간 12:00-13:00, 주말·공휴일 휴무)",
  services: [
    "산재보험 신청·접수",
    "보상금 지급",
    "재활지원·재요양",
    "장해 등급 결정",
    "유족급여 지급",
    "진료비·약제비 심사",
    "고용보험 업무 (실업급여 등)",
    "특수형태근로종사자 산재보험 업무",
  ],
};
