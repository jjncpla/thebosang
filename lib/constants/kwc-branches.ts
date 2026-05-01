// 근로복지공단 지사 상세 정보
// 출처: https://www.comwel.or.kr/comwel/intr/srch/srch.jsp 표본 5건 (2026-05-01 WebFetch)
//   - 부산지역본부 (article_no=5546)
//   - 서울지역본부 (article_no=5565)
//   - 부산동부지사 (article_no=5544)
//   - 세종지사 (article_no=5538)
//   - 대구북부지사 (article_no=5536)
// 기본 95개 기관 데이터는 public/data/gongdan-branches.json (주소·관할·전화·팩스만)
// 이 파일에서는 우편번호·교통편·업무내용·운영시간·부서·담당자 등 보강 정보를 제공

// ─── 타입 ────────────────────────────────────────────────────────────────────

// 부서별 담당자 (담당자명은 공단 페이지에 없음 — 사용자가 추후 입력)
export type KwcStaff = {
  position?: string;       // 직책 (예: "팀장", "주무관") — 공단 페이지에 있을 수 있음
  phone: string;           // 직통 전화번호
  task: string;            // 담당업무 (예: "소음성 난청 1차 심사")
  name?: string;           // 담당자명 — 사용자가 추후 입력 (현재는 placeholder)
};

// 지사 부서
export type KwcDepartment = {
  name: string;                 // 부서명 (예: "재활보상1부")
  fax?: string;                 // 부서 팩스 (있으면)
  responsibilities?: string[];  // 부서 담당업무 리스트
  staffs?: KwcStaff[];          // 담당자 목록
  representativeTel?: string;   // 부서 대표 전화 (있으면)
};

export type KwcSpecialUnit = {
  name: string;
  address?: string;
  tel?: string;
  fax?: string;
};

export type KwcBranchDetail = {
  postalCode?: string;        // 우편번호
  representativeTel?: string; // 대표 전화 (1588-0075 등 콜센터 번호)
  email?: string;
  hours?: string;             // 운영 시간 (예: "평일 09:00-18:00")
  directions?: string;        // 교통편 / 오시는 길
  parkingInfo?: string;       // 주차 안내
  services?: string[];        // 주요 업무 / 서비스 항목
  departments?: KwcDepartment[];     // 부서 목록 (신규)
  specialUnits?: KwcSpecialUnit[];   // 특수부서 (예: 소음성난청전담TF)
};

// ─── 데이터 ──────────────────────────────────────────────────────────────────

// 기관명 → 상세 정보 매핑
// 표본 5건만 채워져 있고, 나머지는 사용자가 점진적으로 채워나갈 예정
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
    departments: [
      {
        name: "경영지원부",
        fax: "0505-284-1101",
        representativeTel: "051-661-0110",
        responsibilities: ["지역본부 및 관할지사의 주요업무계획 수립", "각종 행정지원"],
        staffs: [],
      },
      {
        name: "가입지원1부",
        fax: "0505-284-3100",
        responsibilities: ["보험 적용 및 부과", "피보험자자격관리(동구·사하구·서구·중구)"],
        staffs: [],
      },
      {
        name: "가입지원2부",
        fax: "0505-351-4100",
        responsibilities: ["보험 적용 및 부과", "피보험자자격관리(남구·영도구)"],
        staffs: [],
      },
      {
        name: "재활보상1부",
        fax: "0505-296-2100",
        responsibilities: ["유족급여 및 재해상담 관련 업무"],
        staffs: [],
      },
      {
        name: "재활보상2부",
        fax: "0505-042-2200",
        responsibilities: ["요양재활", "장해 및 내일찾기서비스 관련업무"],
        staffs: [],
      },
      {
        name: "부정수급예방부",
        fax: "0505-084-2102",
        responsibilities: ["부정수급, 부당이득", "구상채권 관련 업무"],
        staffs: [],
      },
      {
        name: "송무부",
        fax: "0505-284-5100",
        responsibilities: ["행정소송 수행 및 소송비용 회수", "민사소송 수행"],
        staffs: [],
      },
      {
        name: "복지사업부",
        fax: "0505-301-6100",
        responsibilities: ["일자리안정자금 지원", "퇴직연금", "임금채권", "신용보증"],
        staffs: [],
      },
      {
        name: "산재의학센터",
        fax: "0505-067-2103",
        responsibilities: ["진료비심사", "본인부담금확인", "장해통합심사"],
        staffs: [],
      },
      {
        name: "소음성난청전담TF",
        fax: "0505-720-5911",
        responsibilities: ["부산·울산·경남지역 소음성 난청 업무"],
        staffs: [],
      },
    ],
    specialUnits: [
      {
        name: "소음성난청전담TF",
        address: "부산광역시 금정구 중앙대로1763번길 26, 3층 (46274)",
        fax: "0505-720-5911",
      },
    ],
  },

  서울지역본부: {
    postalCode: "45054",
    representativeTel: "1588-0075",
    hours: "평일 09:00-18:00 (점심시간 12:00-13:00)",
    directions: "지하철 3·4호선 충무로역 5번 출구 150m 전방",
    parkingInfo: "1시간 무료, 이후 유료",
    services: [
      "보험 적용 및 부과",
      "피보험자 자격관리",
      "산재보상·재활지원",
      "부정수급 예방 및 조사",
      "진료비·약제비 심사",
      "근로자 복지사업 (퇴직연금, 임금채권, 신용보증)",
    ],
    departments: [
      {
        name: "경영지원부",
        fax: "0505-282-1201",
        representativeTel: "02-2230-9500",
        responsibilities: ["행정지원", "인사·복무·경리"],
        staffs: [],
      },
      {
        name: "가입지원1부",
        fax: "0505-351-3101",
        representativeTel: "02-2230-9570",
        responsibilities: ["보험적용·부과", "자격관리"],
        staffs: [],
      },
      {
        name: "가입지원2부",
        fax: "0505-282-3201",
        responsibilities: ["보험적용·부과", "자격관리"],
        staffs: [],
      },
      {
        name: "재활보상1부",
        fax: "0505-353-2100",
        representativeTel: "02-2230-9409",
        responsibilities: ["유족급여", "재해조사", "진폐"],
        staffs: [],
      },
      {
        name: "재활보상2부",
        fax: "0505-139-1140",
        responsibilities: ["장해심사", "재활지원", "요양"],
        staffs: [],
      },
      {
        name: "부정수급예방부",
        fax: "0505-290-2101",
        representativeTel: "02-2230-9718",
        responsibilities: ["부정수급 조사 및 예방"],
        staffs: [],
      },
      {
        name: "산재의학센터",
        fax: "0505-099-2107",
        representativeTel: "02-2230-9586",
        responsibilities: ["진료비심사", "의학자문"],
        staffs: [],
      },
      {
        name: "송무1부",
        fax: "0505-287-5100",
        representativeTel: "02-2230-9440",
        responsibilities: ["행정소송"],
        staffs: [],
      },
      {
        name: "송무2부",
        fax: "0505-389-1101",
        representativeTel: "02-2230-9573",
        responsibilities: ["민사소송", "구상금 관리"],
        staffs: [],
      },
      {
        name: "복지사업부",
        responsibilities: ["퇴직연금", "대부사업", "임금채권"],
        staffs: [],
      },
      {
        name: "확정정산부",
        fax: "0505-044-1202",
        responsibilities: ["건설업 고용·산재보험료 정산"],
        staffs: [],
      },
    ],
  },

  부산동부지사: {
    postalCode: "46274",
    representativeTel: "1588-0075",
    hours: "평일 09:00-18:00 (점심시간 12:00-13:00)",
    directions:
      "지하철 1호선 장전역 4번 출구에서 온천천을 따라 부곡교까지 이동 후 우측 건물 사이 골목으로 약 200m (도보 10분) / 금정구청 버스정류소 하차 후 금정보건소를 지나 우측 첫 골목길로 약 100m (도보 5분)",
    services: [
      "산재보험 신청·접수",
      "보상금 지급",
      "재활지원",
      "퇴직연금·임금채권",
      "보험료 부과 및 자격관리",
    ],
    departments: [
      {
        name: "가입지원부",
        fax: "0505-296-3101",
        responsibilities: ["고용·산재보험 가입지원", "보험료 부과", "피보험자 관리"],
        staffs: [],
      },
      {
        name: "재활보상1부",
        fax: "0505-139-2101",
        responsibilities: ["산재 최초 요양급여", "유족 보상", "재해조사"],
        staffs: [],
      },
      {
        name: "재활보상2부",
        fax: "0505-067-2102",
        responsibilities: ["요양관리", "보험급여 지급", "재활·직업복귀 지원"],
        staffs: [],
      },
      {
        name: "경영복지부",
        fax: "0505-271-1101",
        responsibilities: ["퇴직연금", "임금채권", "생활안정자금 융자"],
        staffs: [],
      },
    ],
  },

  세종지사: {
    postalCode: "30116",
    representativeTel: "1588-0075",
    hours: "평일 09:00-18:00 (점심시간 12:00-13:00)",
    directions: "BRT 정부세종청사(남측) 정류장에서 AK몰 방향으로 300m 도보이동",
    services: [
      "산재요양 및 보험급여",
      "진료비심사",
      "재활서비스",
      "퇴직연금·대부·신용보증",
      "임금채권보장",
      "고용·산재보험 적용·징수·체납처분",
    ],
    departments: [
      {
        name: "가입지원부",
        fax: "0505-544-2100",
        responsibilities: ["고용·산재보험 적용", "징수", "납부독려", "체납처분"],
        staffs: [],
      },
      {
        name: "재활보상부",
        fax: "0505-732-3100",
        responsibilities: ["산재요양", "보험급여", "진료비심사", "재활서비스"],
        staffs: [],
      },
      {
        name: "경영복지부",
        fax: "0505-477-1100",
        responsibilities: ["퇴직연금", "대부·신용보증 지원", "임금채권보장"],
        staffs: [],
      },
    ],
  },

  대구북부지사: {
    postalCode: "41590",
    representativeTel: "1588-0075",
    hours: "평일 09:00-18:00 (점심시간 12:00-13:00)",
    directions:
      "지하철 3호선 북구청역 4번 출구에서 북대구세무서 방향으로 도보 10분 / 버스 101번·730번·707번 (북대구세무서 앞 하차)",
    parkingInfo: "청사내 지하 주차장 이용 가능",
    services: [
      "고용·산재보험 적용·부과",
      "피보험자관리",
      "산재요양결정 및 보험급여 지급",
      "재활서비스",
      "근로자 복지사업",
      "퇴직연금사업",
    ],
    departments: [
      {
        name: "가입지원부",
        fax: "0505-173-1200, 0505-167-3100, 0505-191-4100",
        responsibilities: ["고용·산재보험 적용·부과", "피보험자관리"],
        staffs: [],
      },
      {
        name: "재활보상부",
        fax: "0505-173-2100, 0505-845-2101",
        responsibilities: ["산재요양결정", "보험급여 지급", "재활서비스사업"],
        staffs: [],
      },
      {
        name: "경영복지부",
        fax: "0505-284-1100",
        representativeTel: "053-607-4599",
        responsibilities: ["근로자 복지사업", "퇴직연금사업"],
        staffs: [],
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
