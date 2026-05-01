// 근로복지공단 지사 상세 정보
// 출처: https://www.comwel.or.kr/comwel/intr/srch/srch.jsp?board_no=107 (2026-05-01 WebFetch 일괄 추출)
//   board_no=107 게시판 7페이지에서 추출된 68개 지역본부·지사·특수형태근로종사자센터
//   누락: 공단본부, 산재심사위원회, 6개 업무상질병판정위원회, 11개 병원,
//         재활공학연구소, 직업환경연구원, 근로복지연구원, 인재개발원, 고객센터
//         (이들은 별도 게시판 또는 별도 페이지로 관리됨 — 사용자가 추후 보강)
//
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

// 표준 운영시간 (대부분의 지사 공통)
const STD_HOURS = "평일 09:00-18:00 (점심시간 12:00-13:00)";

// 기관명 → 상세 정보 매핑
export const KWC_BRANCH_DETAILS: Record<string, KwcBranchDetail> = {
  // ─── 서울권 ────────────────────────────────────────────────────────────
  서울지역본부: {
    postalCode: "45054",
    representativeTel: "1588-0075",
    hours: STD_HOURS,
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
      { name: "경영지원부", fax: "0505-282-1201", representativeTel: "02-2230-9500", responsibilities: ["행정지원", "인사·복무·경리"], staffs: [] },
      { name: "가입지원1부", fax: "0505-351-3101", representativeTel: "02-2230-9570", responsibilities: ["보험적용·부과", "자격관리"], staffs: [] },
      { name: "가입지원2부", fax: "0505-282-3201", responsibilities: ["보험적용·부과", "자격관리"], staffs: [] },
      { name: "재활보상1부", fax: "0505-353-2100", representativeTel: "02-2230-9409", responsibilities: ["유족급여", "재해조사", "진폐"], staffs: [] },
      { name: "재활보상2부", fax: "0505-139-1140", responsibilities: ["장해심사", "재활지원", "요양"], staffs: [] },
      { name: "부정수급예방부", fax: "0505-290-2101", representativeTel: "02-2230-9718", responsibilities: ["부정수급 조사 및 예방"], staffs: [] },
      { name: "산재의학센터", fax: "0505-099-2107", representativeTel: "02-2230-9586", responsibilities: ["진료비심사", "의학자문"], staffs: [] },
      { name: "송무1부", fax: "0505-287-5100", representativeTel: "02-2230-9440", responsibilities: ["행정소송"], staffs: [] },
      { name: "송무2부", fax: "0505-389-1101", representativeTel: "02-2230-9573", responsibilities: ["민사소송", "구상금 관리"], staffs: [] },
      { name: "복지사업부", responsibilities: ["퇴직연금", "대부사업", "임금채권"], staffs: [] },
      { name: "확정정산부", fax: "0505-044-1202", responsibilities: ["건설업 고용·산재보험료 정산"], staffs: [] },
    ],
  },

  서울특수형태근로종사자센터: {
    postalCode: "03143",
    representativeTel: "1588-0075",
    hours: STD_HOURS,
    directions: "안국역 6번 출구 또는 광화문역 2번 출구",
    services: ["특수형태근로자 업무", "예술인고용보험", "노무제공 직종 가입지원"],
    departments: [
      { name: "예술인가입부", fax: "0505-290-3203", responsibilities: ["예술인고용보험 가입/부과/자격관리"], staffs: [] },
      { name: "특고가입1부", fax: "0505-290-3102", responsibilities: ["특수형태근로자 가입지원", "미가입재해 조사"], staffs: [] },
      { name: "특고가입2부", fax: "0505-175-1203", responsibilities: ["특수형태근로종사자 가입/부과/자격관리"], staffs: [] },
      { name: "특고가입3부", fax: "0505-175-1204", responsibilities: ["특수형태근로종사자 가입지원"], staffs: [] },
    ],
  },

  서울강남지사: {
    postalCode: "06193",
    representativeTel: "1588-0075",
    hours: STD_HOURS,
    directions: "지하철 2호선 및 분당선 선릉역 1번 출구 약 150m 전방 1층 수협은행 건물 내",
    parkingInfo: "건물 내 30분 무료 주차",
    services: ["산재보상", "요양재활", "보험급여지급", "진료비심사", "가입납부", "근로자복지", "퇴직연금", "임금채권", "신용보증"],
    departments: [
      { name: "경영복지부", fax: "0505-084-1103", representativeTel: "02-3459-7112", responsibilities: ["퇴직연금", "임금채권", "신용보증", "근로자대부", "경영지원", "일자리안정자금"], staffs: [] },
      { name: "가입지원1부", fax: "0505-310-3101", representativeTel: "02-3459-7133", responsibilities: ["고용·산재보험 가입", "부과", "피보험자격관리", "건설사업장 관리"], staffs: [] },
      { name: "가입지원2부", fax: "0505-282-3200", representativeTel: "02-3459-7134", responsibilities: ["고용·산재보험 가입", "부과", "피보험자격관리", "근로자정보입력"], staffs: [] },
      { name: "재활보상부", fax: "0505-099-2102", representativeTel: "02-3459-7135", responsibilities: ["산재요양결정", "보험급여지급", "진료비심사", "재활서비스", "재해조사", "장해급여"], staffs: [] },
    ],
  },

  서울동부지사: {
    postalCode: "05510",
    representativeTel: "1588-0075",
    hours: STD_HOURS,
    directions: "2호선 잠실역 7번 출구 약 80m 전방 월드타워빌딩",
    parkingInfo: "30분 무료, 이후 10분당 500원 (2시간 초과 시 10분당 1,000원)",
    departments: [
      { name: "가입지원부", fax: "0505-303-3100", responsibilities: ["사업장 고용·산재보험 가입·부과고지", "보험료 부과 확정정산", "피보험자 자격관리"], staffs: [] },
      { name: "재활보상1부", fax: "0505-284-2101", responsibilities: ["재해조사", "유족급여", "진폐", "휴업급여", "구상권 행사 결정"], staffs: [] },
      { name: "재활보상2부", fax: "0505-738-0011", responsibilities: ["산재요양결정", "보험급여지급", "진료비심사", "재활서비스", "장해급여 지급결정"], staffs: [] },
      { name: "경영복지부", fax: "0505-847-1100", responsibilities: ["대지급금 지급", "임금채권보장", "퇴직연금", "복지대부", "신용보증"], staffs: [] },
    ],
  },

  서울서부지사: {
    postalCode: "04108",
    representativeTel: "1588-0075",
    hours: STD_HOURS,
    directions: "지하철 2호선 신촌역 6번 출구 150m 거구장빌딩",
    parkingInfo: "30분 무료 (이후 유료)",
    services: ["가입납부", "산재보상", "재활", "근로복지", "임금채권보장"],
    departments: [
      { name: "경영복지부", fax: "0505-381-1101", representativeTel: "02-2077-0150", responsibilities: ["대부사업", "임금채권보장사업", "퇴직연금"], staffs: [] },
      { name: "재활보상부", fax: "0505-338-2100", representativeTel: "02-2077-0300", responsibilities: ["산업재해 승인", "최초요양결정", "보험급여지급"], staffs: [] },
      { name: "가입지원부", fax: "0505-331-3100", representativeTel: "02-2077-0229", responsibilities: ["산재·고용보험 가입", "보험관계 변경", "피보험자격관리"], staffs: [] },
    ],
  },

  서울남부지사: {
    postalCode: "07254",
    representativeTel: "1588-0075",
    hours: STD_HOURS,
    directions: "지하철 2·9호선 당산역 10번 출구 → 마을버스 03번 / 1호선 신길역 2번 출구 도보 10분 / 5호선 신길역 3번 출구",
    parkingInfo: "차량 5부제 운영 중 (미세먼지 비상저감 시 2부제)",
    services: ["가입 업무", "보상 업무", "재활 지원", "퇴직연금", "대부사업", "도산/간이대지급금"],
    departments: [
      { name: "가입지원1부", fax: "0505-296-3100", representativeTel: "02-2165-3150", responsibilities: ["보험적용 및 부과", "피보험자관리", "건설업종 및 일반업종 적용"], staffs: [] },
      { name: "가입지원2부", fax: "0505-505-4100", representativeTel: "02-2165-3129", responsibilities: ["영등포구 보험적용 및 부과", "근로자 고용신고", "피보험자 자격관리"], staffs: [] },
      { name: "경영복지부", fax: "0505-332-1101", representativeTel: "02-2165-3104", responsibilities: ["퇴직연금", "임금채권", "신용보증", "융자사업"], staffs: [] },
      { name: "재활보상1부", fax: "0505-273-2101", representativeTel: "02-2165-3260", responsibilities: ["재해조사", "장해통합심사지원", "유족급여"], staffs: [] },
      { name: "재활보상2부", fax: "0505-246-1200", representativeTel: "02-2165-3121", responsibilities: ["요양재활", "장해심사", "산재 및 진폐 장학사업"], staffs: [] },
    ],
  },

  서울북부지사: {
    postalCode: "02098",
    representativeTel: "1588-0075",
    hours: STD_HOURS,
    directions: "경의중앙선·7호선 상봉역(1, 8번 출구) 도보 2분, 시내버스 202·260·262·270·272 등",
    services: ["산재보상", "요양재활", "가입납부", "근로자복지", "재활서비스"],
    departments: [
      { name: "경영복지부", fax: "0505-377-1101", representativeTel: "02-944-8222", responsibilities: ["대부사업", "신용보증", "임금채권보장", "퇴직연금"], staffs: [] },
      { name: "가입지원부", fax: "0505-310-3100", representativeTel: "02-944-8177", responsibilities: ["고용산재보험 가입", "보험료 부과", "피보험자격관리"], staffs: [] },
      { name: "재활보상1부", fax: "0505-335-2100", representativeTel: "02-944-8255", responsibilities: ["재해상담", "최초요양신청", "유족급여"], staffs: [] },
      { name: "재활보상2부", fax: "0505-150-2110", representativeTel: "02-944-8277", responsibilities: ["요양재활", "보험급여지급", "진료비심사"], staffs: [] },
    ],
  },

  서울관악지사: {
    postalCode: "07071",
    representativeTel: "1588-0075",
    hours: STD_HOURS,
    directions: "보라매공원 동문 / 보라매병원 맞은편, 경전철 신림선 보라매병원역 2번 출구 도보 90m",
    parkingInfo: "최초 10분 무료, 이후 10분당 500원",
    services: ["산재보험", "고용보험", "근로자복지", "퇴직연금", "임금채권", "요양재활"],
    departments: [
      { name: "경영복지부", fax: "0505-329-1101", representativeTel: "02-2109-2312", responsibilities: ["퇴직연금", "임금채권", "근로자대부", "생활안정자금"], staffs: [] },
      { name: "가입지원1부", fax: "0505-290-3100", representativeTel: "02-2109-2220", responsibilities: ["산재·고용보험 가입", "보험료 부과", "피보험자 관리"], staffs: [] },
      { name: "가입지원2부", fax: "0505-284-4101", representativeTel: "02-2109-2206", responsibilities: ["산재·고용보험 가입", "보험료 부과", "피보험자 관리"], staffs: [] },
      { name: "재활보상1부", fax: "0505-215-2101", representativeTel: "02-2109-2205", responsibilities: ["재해조사", "산재요양결정"], staffs: [] },
      { name: "재활보상2부", fax: "0505-084-2103", representativeTel: "02-2109-2216", responsibilities: ["보험급여지급", "요양관리", "재활서비스"], staffs: [] },
    ],
  },

  서울서초지사: {
    postalCode: "06720",
    representativeTel: "1588-0075",
    hours: STD_HOURS,
    directions: "남부터미널역 3번 출구 30m (지하통로 출구 국제전자센터로 연결)",
    parkingInfo: "40분 무료 주차, 이후 10분당 1,000원",
    departments: [
      { name: "경영복지부", fax: "0505-560-1100", representativeTel: "02-6250-7272", responsibilities: ["지사경영관리", "대부사업", "임금채권보장", "퇴직연금"], staffs: [] },
      { name: "가입지원부", fax: "0505-289-2101", representativeTel: "02-6250-7232", responsibilities: ["고용·산재보험 가입", "보험료부과", "피보험자관리"], staffs: [] },
      { name: "재활보상부", fax: "0505-340-3100", representativeTel: "02-6250-7249", responsibilities: ["산재요양결정", "보험급여지급", "진료비심사", "재활서비스"], staffs: [] },
    ],
  },

  서울성동지사: {
    postalCode: "04782",
    representativeTel: "1588-0075",
    hours: STD_HOURS,
    directions: "지하철 2호선 뚝섬역 5번 출구에서 164m 이동 후 횡단",
    parkingInfo: "30분 무료 (이후 유료)",
    services: ["산재보상", "요양 및 재활", "가입납부", "근로자복지"],
    departments: [
      { name: "경영복지부", fax: "0505-139-1100", responsibilities: ["행정지원", "복지", "퇴직연금", "근로자 융자"], staffs: [] },
      { name: "재활보상부", fax: "0505-351-3100", responsibilities: ["산재요양결정", "보험급여지급", "진료비심사", "재활서비스"], staffs: [] },
      { name: "가입지원부", fax: "0505-351-2100", responsibilities: ["사업장 가입지원", "보험료부과", "피보험자관리"], staffs: [] },
    ],
  },

  // ─── 경기북부 ──────────────────────────────────────────────────────────
  의정부지사: {
    postalCode: "11754",
    representativeTel: "1588-0075",
    hours: STD_HOURS,
    directions: "의정부 경전철 경기도청북부청사역 1번 출구 도보 10분, 효자역 1번 출구 도보 7분",
    parkingInfo: "방문고객 무료 (지상주차장)",
    services: ["고용산재보험 가입 및 부과", "피보험자격관리", "최초요양급여", "유족요양급여", "요양관리 및 재활", "장해급여", "퇴직연금", "생활안정자금 대부"],
    departments: [
      { name: "가입지원부", fax: "0505-847-3100", representativeTel: "031-828-3120", responsibilities: ["일반업종 고용산재보험 가입·부과", "건설업종 고용산재보험 가입·부과", "피보험자격관리"], staffs: [] },
      { name: "재활보상1부", fax: "0505-511-2101", representativeTel: "031-828-3082", responsibilities: ["최초요양급여", "유족요양급여", "재해조사"], staffs: [] },
      { name: "재활보상2부", fax: "0505-738-0013", representativeTel: "031-828-3113", responsibilities: ["요양관리", "재활 및 장해급여", "간병급여"], staffs: [] },
      { name: "경영복지부", fax: "0505-445-1100", representativeTel: "031-828-3029", responsibilities: ["퇴직연금", "생활안정자금 대부", "신용보증지원", "행정지원"], staffs: [] },
    ],
  },

  남양주지사: {
    postalCode: "12284",
    representativeTel: "1588-0075",
    hours: STD_HOURS,
    directions: "경의중앙선 도농역 2번 출구 도보 10분",
    parkingInfo: "1시간 무료 (건물 지하1·2층)",
    services: ["고용·산재보험 적용 및 두루누리 지원사업", "보험료부과 징수", "근로자관리", "최초요양", "휴업급여", "요양관리·지급", "대지급금", "퇴직연금", "대부"],
    departments: [
      { name: "가입지원부", fax: "0505-284-3110", representativeTel: "031-524-7051", staffs: [] },
      { name: "재활보상부", fax: "0505-084-2110", representativeTel: "031-524-7121", staffs: [] },
      { name: "경영복지부", fax: "0505-139-1105", representativeTel: "031-524-7002", staffs: [] },
    ],
  },

  // ─── 부산권 ────────────────────────────────────────────────────────────
  부산지역본부: {
    postalCode: "48731",
    representativeTel: "1588-0075",
    hours: STD_HOURS,
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
      { name: "경영지원부", fax: "0505-284-1101", representativeTel: "051-661-0110", responsibilities: ["지역본부 및 관할지사의 주요업무계획 수립", "각종 행정지원"], staffs: [] },
      { name: "가입지원1부", fax: "0505-284-3100", responsibilities: ["보험 적용 및 부과", "피보험자자격관리(동구·사하구·서구·중구)"], staffs: [] },
      { name: "가입지원2부", fax: "0505-351-4100", responsibilities: ["보험 적용 및 부과", "피보험자자격관리(남구·영도구)"], staffs: [] },
      { name: "재활보상1부", fax: "0505-296-2100", responsibilities: ["유족급여 및 재해상담"], staffs: [] },
      { name: "재활보상2부", fax: "0505-042-2200", responsibilities: ["요양재활", "장해 및 내일찾기서비스"], staffs: [] },
      { name: "부정수급예방부", fax: "0505-084-2102", responsibilities: ["부정수급, 부당이득", "구상채권"], staffs: [] },
      { name: "송무부", fax: "0505-284-5100", responsibilities: ["행정소송 수행 및 소송비용 회수", "민사소송"], staffs: [] },
      { name: "복지사업부", fax: "0505-301-6100", responsibilities: ["일자리안정자금 지원", "퇴직연금", "임금채권", "신용보증"], staffs: [] },
      { name: "산재의학센터", fax: "0505-067-2103", responsibilities: ["진료비심사", "본인부담금확인", "장해통합심사"], staffs: [] },
      { name: "소음성난청전담TF", fax: "0505-720-5911", responsibilities: ["부산·울산·경남지역 소음성 난청 업무"], staffs: [] },
    ],
    specialUnits: [
      { name: "소음성난청전담TF", address: "부산광역시 금정구 중앙대로1763번길 26, 3층 (46274)", fax: "0505-720-5911" },
    ],
  },

  부산특수형태근로종사자센터: {
    postalCode: "48731",
    representativeTel: "1588-0075",
    hours: STD_HOURS,
    services: ["특수형태근로종사자 가입 지원", "플랫폼 관련 업무", "미가입 신고 접수"],
    departments: [
      { name: "특고가입1부", fax: "0505-132-1102", responsibilities: ["부산시 및 경상남도 특수형태근로종사자 가입지원", "센터 내 주무 관리업무 총괄", "특별민원 및 심층상담"], staffs: [] },
      { name: "특고가입2부", fax: "0505-173-1103", responsibilities: ["대구·울산·경북 특수형태근로종사자 가입지원", "플랫폼 인성데이터 퀵서비스·대리운전 업무"], staffs: [] },
    ],
  },

  부산동부지사: {
    postalCode: "46274",
    representativeTel: "1588-0075",
    hours: STD_HOURS,
    directions: "지하철 1호선 장전역 4번 출구에서 온천천을 따라 부곡교까지 이동 후 우측 건물 사이 골목으로 약 200m (도보 10분) / 금정구청 버스정류소 하차 후 금정보건소를 지나 우측 첫 골목길로 약 100m (도보 5분)",
    services: ["산재보험 신청·접수", "보상금 지급", "재활지원", "퇴직연금·임금채권", "보험료 부과 및 자격관리"],
    departments: [
      { name: "가입지원부", fax: "0505-296-3101", responsibilities: ["고용·산재보험 가입지원", "보험료 부과", "피보험자 관리"], staffs: [] },
      { name: "재활보상1부", fax: "0505-139-2101", responsibilities: ["산재 최초 요양급여", "유족 보상", "재해조사"], staffs: [] },
      { name: "재활보상2부", fax: "0505-067-2102", responsibilities: ["요양관리", "보험급여 지급", "재활·직업복귀 지원"], staffs: [] },
      { name: "경영복지부", fax: "0505-271-1101", responsibilities: ["퇴직연금", "임금채권", "생활안정자금 융자"], staffs: [] },
    ],
  },

  부산북부지사: {
    postalCode: "46548",
    representativeTel: "1588-0075",
    hours: STD_HOURS,
    directions: "부산지하철 덕천역(2·3호선 환승) 12번 출구",
    parkingInfo: "건물 1층 자주식 주차장 이용 가능 (협소하므로 대중교통 권장)",
    services: ["산재요양결정", "보험급여지급", "진료비심사", "재활서비스", "고용보험가입", "산재보험적용", "근로자복지융자", "퇴직연금"],
    departments: [
      { name: "재활보상부", fax: "0505-284-2100", representativeTel: "051-320-8104", responsibilities: ["산재요양결정", "보험급여지급", "재해조사", "장해급여지급"], staffs: [] },
      { name: "가입지원부", fax: "0505-255-3100", representativeTel: "051-320-8106", responsibilities: ["고용산재보험 적용·부과", "피보험자자격관리", "보험가입조사"], staffs: [] },
      { name: "경영복지부", fax: "0505-282-1101", representativeTel: "051-320-8150", responsibilities: ["근로자생활안정자금 융자", "대지급금 지급", "퇴직연금"], staffs: [] },
    ],
  },

  부산중부지사: {
    postalCode: "47244",
    representativeTel: "1588-0075",
    hours: STD_HOURS,
    directions: "지하철 1호선 부전역 또는 2호선 서면역 하차 (서면지하상가 6번 출구) / 버스 20·31·33·54·62·77·86·87·110-1·141·129-1 부전시장 하차",
    parkingInfo: "건물 지하주차장 이용 가능 (주차장이 협소하여 대중교통 이용 권장)",
    services: ["퇴직연금", "체당금 지급", "생활안정자금 대부", "직업훈련생계비 대부", "사업장 가입", "보험료 부과", "근로자 취득 및 상실", "재해상담", "산재요양결정", "보험급여지급", "진료비심사", "재활서비스"],
    departments: [
      { name: "가입지원부", fax: "0505-289-2100", staffs: [] },
      { name: "경영복지부", fax: "0505-235-1100", staffs: [] },
      { name: "재활보상부", fax: "0505-282-3100", staffs: [] },
    ],
  },

  // ─── 경남권 ────────────────────────────────────────────────────────────
  창원지사: {
    postalCode: "51439",
    representativeTel: "1588-0075",
    hours: STD_HOURS,
    directions: "좌석버스 700·704·707·752, 일반버스 58·97·101·110·111·114·122·150·211·214·505·507·552 경남도청에서 하차",
    parkingInfo: "1층 민원인 주차장 이용 가능",
    services: ["근로자 복지 및 신용보증", "대지급금", "퇴직연금", "고용산재보험 적용 및 부과", "산재보상", "요양 및 재활"],
    departments: [
      { name: "경영복지부", fax: "0505-833-1100", staffs: [] },
      { name: "가입지원부", fax: "0505-506-1200", staffs: [] },
      { name: "재활보상1부", fax: "0505-679-2101", staffs: [] },
      { name: "재활보상2부", fax: "0505-099-2201", staffs: [] },
    ],
  },

  울산남부지사: {
    postalCode: "44661",
    representativeTel: "1588-0075",
    hours: STD_HOURS,
    directions: "법원앞 신호등 사거리에서 공업탑 방향으로 약 100m",
    parkingInfo: "지하주차장 있으나 혼잡하므로 건물 외 주차 권장",
    services: ["산재보상", "요양 및 재활", "가입납부", "근로자복지"],
    departments: [
      { name: "경영복지부", fax: "0505-805-1100", responsibilities: ["문서접수", "퇴직연금", "융자 업무", "대지급금 지급"], staffs: [] },
      { name: "가입지원부", fax: "0505-680-3100", responsibilities: ["보험 적용 및 부과", "피보험자 자격관리", "고용정보관리"], staffs: [] },
      { name: "재활보상1부", fax: "0505-543-2100", responsibilities: ["재해상담", "재해조사", "유족급여"], staffs: [] },
      { name: "재활보상2부", fax: "0505-084-2201", responsibilities: ["요양 및 재활", "장해업무", "장해급여"], staffs: [] },
    ],
  },

  울산중부지사: {
    postalCode: "44547",
    representativeTel: "1588-0075",
    hours: STD_HOURS,
    directions: "버스 KCC스위첸 하차 (438·712·728·순환31)",
    parkingInfo: "자가용 이용 시 주차장은 건물 뒤편",
    services: ["산재보상", "요양재활", "가입납부", "근로자복지"],
    departments: [
      { name: "가입지원부", fax: "0505-720-5920", responsibilities: ["보험가입조사", "보험적용 및 부과", "피보험자 자격관리", "근로자 고용신고"], staffs: [] },
      { name: "경영복지부", fax: "0505-720-5910", responsibilities: ["임금채권", "경영지원 및 복지", "퇴직연금", "생활안정자금 융자"], staffs: [] },
      { name: "재활보상부", fax: "0505-720-5930", responsibilities: ["진료비·약제비", "유족급여", "장해급여", "재해조사", "요양관리"], staffs: [] },
    ],
  },

  김해지사: {
    postalCode: "50935",
    representativeTel: "1588-0075",
    hours: STD_HOURS,
    directions: "버스 2·2-1·4·7·82·123·124·1004, 경전철 인제대역 하차",
    parkingInfo: "건물 지하 1층",
    services: ["산재보상", "요양 및 재활", "가입납부", "근로자복지", "임금채권", "퇴직연금"],
    departments: [
      { name: "가입지원부", fax: "0505-290-3108, 0505-290-3109", representativeTel: "055-723-8020", responsibilities: ["적용부과업무", "피보험자관리", "보험가입조사"], staffs: [] },
      { name: "경영복지부", fax: "0505-173-1102", representativeTel: "055-723-8011", responsibilities: ["임금채권", "퇴직연금", "생활안정자금 대부"], staffs: [] },
      { name: "재활보상부", fax: "0505-290-2109", representativeTel: "055-723-8065", responsibilities: ["재해조사", "요양관리", "장해급여"], staffs: [] },
    ],
  },

  양산지사: {
    postalCode: "50635",
    representativeTel: "1588-0075",
    hours: STD_HOURS,
    directions: "고속도로 남양산IC 인근, 양산고용노동청 옆 / 지하철 1호선 명륜역 → 버스 1300·1500 → 양산시 도시통합관제센터 하차",
    parkingInfo: "청사 전면 지상 주차장",
    services: ["산재보상", "요양재활", "가입납부", "근로자복지", "퇴직연금"],
    departments: [
      { name: "경영복지부", fax: "0505-720-1101", representativeTel: "055-380-8460", responsibilities: ["퇴직연금 관리", "대부사업", "임금채권보장", "근로자 생활안정자금"], staffs: [] },
      { name: "가입지원부", fax: "0505-396-3100", representativeTel: "055-380-8304", responsibilities: ["고용·산재보험 가입", "보험료 부과고지", "피보험자 자격관리"], staffs: [] },
      { name: "재활보상부", fax: "0505-381-2101", representativeTel: "055-380-8429", responsibilities: ["재해상담", "요양재활", "장해급여", "유족급여"], staffs: [] },
    ],
  },

  진주지사: {
    postalCode: "52725",
    representativeTel: "1588-0075",
    hours: STD_HOURS,
    directions: "경상국립대학교 출발(아이비타워 정류장): 128·130·131·133·134·135·141·142·145 / 시외버스터미널 출발: 340·341·342·343",
    services: ["고용·산재보험 적용 및 부과", "자격관리", "산재요양결정", "보험급여지급", "진료비심사 및 재활서비스", "간이대지급금", "도산대지급금", "퇴직연금"],
    departments: [
      { name: "가입지원부", fax: "0505-883-3100", representativeTel: "055-760-0110", responsibilities: ["고용·산재보험 적용 및 부과", "자격관리", "보험료 신고 및 납부"], staffs: [] },
      { name: "재활보상부", fax: "0505-579-2100", representativeTel: "055-760-0160", responsibilities: ["산재요양결정", "보험급여지급", "진료비심사 및 재활서비스"], staffs: [] },
      { name: "경영복지부", fax: "0505-690-1100", representativeTel: "055-760-0150", responsibilities: ["간이대지급금", "도산대지급금", "퇴직연금", "각종 대부사업"], staffs: [] },
    ],
  },

  통영지사: {
    postalCode: "53015",
    representativeTel: "1588-0075",
    hours: STD_HOURS,
    directions: "시외버스터미널에서 경찰서 방향으로 도보 10분 / 시내버스 101·104·105·141·200·240·300·301·400·409 한선아파트 하차",
    services: ["고용·산재보험 적용징수", "산재요양결정", "보험급여지급", "진료비심사 및 재활서비스", "근로자생활안정자금 대부", "퇴직연금업무"],
    departments: [
      { name: "가입지원부", fax: "0505-312-3100", responsibilities: ["고용·산재보험 적용징수", "피보험자 자격관리", "보험료 부과"], staffs: [] },
      { name: "경영복지부", fax: "0505-866-1100", responsibilities: ["지사관리업무", "퇴직연금", "근로자복지 대부사업"], staffs: [] },
      { name: "재활보상부", fax: "0505-720-2100", responsibilities: ["산재요양결정", "보험급여지급", "진료비심사 및 재활서비스"], staffs: [] },
    ],
  },

  // ─── 대구·경북권 ──────────────────────────────────────────────────────
  대구지역본부: {
    postalCode: "41948",
    representativeTel: "1588-0075",
    hours: STD_HOURS,
    directions: "지하철 2호선 경대병원역 4번 출구",
    parkingInfo: "청사 내 지하주차장 이용 가능 (협소하므로 대중교통 권장)",
    services: [
      "고용보험 및 산재보험 적용·부과",
      "피보험자 관리",
      "산업재해 보상 및 재활",
      "임금채권·체당금 지급",
      "근로자 융자 및 복지사업",
      "퇴직연금 사업",
    ],
    departments: [
      { name: "경영지원부", fax: "0505-299-1100", representativeTel: "053-601-7200", staffs: [] },
      { name: "가입지원1부", fax: "0505-290-3101", representativeTel: "053-601-7470", staffs: [] },
      { name: "가입지원2부", fax: "0505-257-4100", representativeTel: "053-601-7470", staffs: [] },
      { name: "재활보상1부", fax: "0505-232-2100", representativeTel: "053-601-7270", staffs: [] },
      { name: "재활보상2부", fax: "0505-073-1260", representativeTel: "053-601-7580", staffs: [] },
      { name: "부정수급예방부", fax: "0505-099-2110", representativeTel: "053-601-7340", staffs: [] },
      { name: "송무부", fax: "0505-289-5101", representativeTel: "053-601-7350", staffs: [] },
      { name: "복지사업부", fax: "0505-289-6100", representativeTel: "053-601-7300", staffs: [] },
      { name: "산재의학센터", fax: "0505-099-2109", representativeTel: "053-601-7120", staffs: [] },
      { name: "소음성난청전담TF", fax: "0505-738-0020", representativeTel: "053-601-7251", responsibilities: ["대구·경북지역 소음성 난청 업무"], staffs: [] },
    ],
  },

  대구북부지사: {
    postalCode: "41590",
    representativeTel: "1588-0075",
    hours: STD_HOURS,
    directions: "지하철 3호선 북구청역 4번 출구에서 북대구세무서 방향으로 도보 10분 / 버스 101·730·707 (북대구세무서 앞 하차)",
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
      { name: "가입지원부", fax: "0505-173-1200, 0505-167-3100, 0505-191-4100", responsibilities: ["고용·산재보험 적용·부과", "피보험자관리"], staffs: [] },
      { name: "재활보상부", fax: "0505-173-2100, 0505-845-2101", responsibilities: ["산재요양결정", "보험급여 지급", "재활서비스사업"], staffs: [] },
      { name: "경영복지부", fax: "0505-284-1100", representativeTel: "053-607-4599", responsibilities: ["근로자 복지사업", "퇴직연금사업"], staffs: [] },
    ],
  },

  대구서부지사: {
    postalCode: "42645",
    representativeTel: "1588-0075",
    hours: STD_HOURS,
    directions: "지하철 2호선 감삼역 3번 출구(70m) / 버스 156·250·356·425·503·509·527·달서4·성서2",
    parkingInfo: "건물 지하 주차장(승용차) / 건물 뒤편 야외 주차장(SUV·트럭)",
    services: ["산재보상", "요양 및 재활", "가입납부", "근로자복지", "임금채권"],
    departments: [
      { name: "가입지원부", fax: "0505-173-3100", representativeTel: "053-609-5400", responsibilities: ["고용/산재보험 가입지원", "보험료 신고 및 납부", "피보험자 자격관리"], staffs: [] },
      { name: "재활보상부", fax: "0505-215-2100", representativeTel: "053-609-5500", responsibilities: ["최초요양급여 신청", "보험급여 청구", "재활서비스"], staffs: [] },
      { name: "경영복지부", fax: "0505-718-1100", representativeTel: "053-609-5310", responsibilities: ["근로자생활안정자금융자", "퇴직연금", "임금채권"], staffs: [] },
    ],
  },

  포항지사: {
    postalCode: "37685",
    representativeTel: "1588-0075",
    hours: STD_HOURS,
    directions: "시내버스 216·700·111·306 포항시청 앞 하차 후 도보 2분",
    parkingInfo: "협소함, 만차 시 포항시청 주차장 이용 (1시간 무료)",
    services: ["산재고용보험 가입 및 부과", "산재보상 및 요양", "퇴직연금", "생활안정자금 대부"],
    departments: [
      { name: "가입지원부", fax: "0505-315-3100", representativeTel: "054-288-5280", responsibilities: ["보험적용 및 부과", "피보험자 자격관리", "보험가입조사"], staffs: [] },
      { name: "경영복지부", fax: "0505-139-1106", representativeTel: "054-288-5250", responsibilities: ["퇴직연금", "생활안정자금 대부", "간이대지급금"], staffs: [] },
      { name: "재활보상부", fax: "0505-173-2102", representativeTel: "054-288-5180", responsibilities: ["산재요양결정", "보험급여지급", "장해심사"], staffs: [] },
    ],
  },

  구미지사: {
    postalCode: "39281",
    representativeTel: "1588-0075",
    hours: STD_HOURS,
    directions: "일반버스 23·140·161·180·182·190·194·410·411·460-7·461·882, 좌석버스 160·187·188·891 구미시청 후문 하차 후 동아백화점 방향 도보 3분",
    parkingInfo: "청사 전면 지상 주차장",
    services: ["산재요양결정", "보험급여지급", "진료비심사", "재활서비스", "고용·산재보험 적용", "부과고지", "피보험자관리", "근로자생활안정자금융자", "직업훈련생계비융자", "퇴직연금"],
    departments: [
      { name: "재활보상부", fax: "0505-150-2100", responsibilities: ["산재요양결정", "보험급여지급", "진료비심사 및 재활서비스"], staffs: [] },
      { name: "가입지원부", fax: "0505-284-3101", responsibilities: ["고용·산재보험 적용", "부과고지", "피보험자관리"], staffs: [] },
      { name: "경영복지부", fax: "0505-381-1100", representativeTel: "054-479-9119", responsibilities: ["근로자생활안정자금융자", "직업훈련생계비융자", "퇴직연금사업"], staffs: [] },
    ],
  },

  경산지사: {
    postalCode: "38621",
    representativeTel: "1588-0075",
    hours: STD_HOURS,
    directions: "경산네거리와 경산오거리 중간 (구 정형외과 건너편 KDB산업은행건물)",
    parkingInfo: "건물 뒷편",
    services: ["고용보험 및 산재보험 적용 및 부과", "고용보험 피보험자 관리", "산업재해 보상 및 재활", "대지급금 지급", "근로자 융자", "근로자 복지", "퇴직연금 사업"],
    departments: [
      { name: "가입지원부", fax: "0505-055-2101", representativeTel: "053-819-2201", responsibilities: ["고용·산재보험 적용 및 부과", "피보험자 자격관리", "보험가입조사"], staffs: [] },
      { name: "경영복지부", fax: "0505-432-1100", representativeTel: "053-819-2111", responsibilities: ["대부사업", "퇴직연금", "임금채권보장", "일자리안정자금"], staffs: [] },
      { name: "재활보상부", fax: "0505-073-3100", representativeTel: "053-819-2121", responsibilities: ["산재요양결정", "보험급여 지급", "진료비심사", "재활서비스"], staffs: [] },
    ],
  },

  영주지사: {
    postalCode: "36102",
    representativeTel: "1588-0075",
    hours: STD_HOURS,
    directions: "그랜드컨벤션웨딩 옆",
    parkingInfo: "건물 지하주차장 무료 이용 가능",
    services: ["생활안정자금 융자사업", "퇴직연금사업", "임금채권보장사업", "고용·산재보험 가입 및 부과", "피보험자격관리", "산재요양결정", "보험급여지급", "장해심사 및 재활서비스"],
    departments: [
      { name: "경영복지부", fax: "0505-834-1100", representativeTel: "054-639-0160", responsibilities: ["생활안정자금 융자사업", "퇴직연금사업", "임금채권보장사업"], staffs: [] },
      { name: "가입지원부", fax: "0505-620-3100", representativeTel: "054-639-0130", responsibilities: ["고용·산재보험 가입 및 부과", "피보험자격관리", "두루누리사회보험"], staffs: [] },
      { name: "재활보상부", fax: "0505-521-2100", representativeTel: "054-639-0230", responsibilities: ["산재요양결정", "보험급여지급", "장해심사 및 재활서비스"], staffs: [] },
    ],
  },

  안동지사: {
    postalCode: "36711",
    representativeTel: "1588-0075",
    hours: STD_HOURS,
    directions: "버스 110·111·113·212·412·413·512·610·순환2-1 (우정프라자 또는 안동여성병원 정류장 하차)",
    parkingInfo: "건물 지하 및 옥외 주차장 무료 이용",
    services: ["고용·산재보험 적용 및 징수", "산재요양 및 재활", "보험급여 지급", "융자사업", "임금채권보장"],
    departments: [
      { name: "가입지원부", fax: "0505-377-3100", responsibilities: ["보험가입조사", "보험적용 및 부과", "근로자 고용신고", "피보험자 자격관리"], staffs: [] },
      { name: "재활보상부", fax: "0505-381-2100", responsibilities: ["산재요양결정", "보험급여지급", "진료비심사", "재활서비스"], staffs: [] },
      { name: "경영복지부", fax: "0505-836-1100", responsibilities: ["융자사업", "임금채권보장", "퇴직연금"], staffs: [] },
    ],
  },

  // ─── 경인권 ────────────────────────────────────────────────────────────
  경인지역본부: {
    postalCode: "21556",
    representativeTel: "1588-0075",
    hours: STD_HOURS,
    directions: "인천지하철 1호선 예술회관역 2번 출구",
    parkingInfo: "청사 주차타워(지하 1층) 이용 가능 (전기자동차 및 대형차량 입차불가)",
    services: ["산재보상", "요양 및 재활", "가입납부", "근로자복지", "부정수급예방"],
    departments: [
      { name: "경영지원부", fax: "0505-175-1101", representativeTel: "032-451-9199", responsibilities: ["행정지원", "예산 및 회계", "인사 서무", "윤리경영"], staffs: [] },
      { name: "가입지원1부", fax: "0505-058-4100", representativeTel: "032-451-9499", responsibilities: ["보험적용 및 부과", "확정정산"], staffs: [] },
      { name: "재활보상1부", fax: "0505-084-2100", representativeTel: "032-451-9349", responsibilities: ["재해조사", "유족급여", "진폐요양"], staffs: [] },
      { name: "산재의학센터", fax: "0505-065-2201", representativeTel: "032-451-9364", responsibilities: ["진료비심사", "의학자문", "장해통합심사"], staffs: [] },
    ],
  },

  경인특수형태근로종사자센터: {
    postalCode: "21344",
    representativeTel: "1588-0075",
    hours: STD_HOURS,
    services: ["노무제공자 사용 사업장 적용 및 부과", "보험가입조사", "사무대행기관 수임 및 해지"],
    departments: [
      { name: "특고가입1부", fax: "0505-134-1102", responsibilities: ["노무제공자 사용 사업장 적용 및 부과 (수원·화성·용인·이천·여주·성남·하남·경기 광주·양평·의왕·평택·오산·안성·군포·과천)"], staffs: [] },
      { name: "특고가입2부", fax: "0505-175-1103", responsibilities: ["노무제공자 사용 사업장 적용 및 부과 (인천·부천·김포·광명·안양·고양·파주·안산·시흥)"], staffs: [] },
    ],
  },

  인천북부지사: {
    postalCode: "21417",
    representativeTel: "1588-0075",
    hours: STD_HOURS,
    directions: "도보: 송내 남부역에서 근로복지공단 인천병원 방향 약 15분 / 버스: 송내 남부역에서 8·30·14-1·16-1·103·103-1",
    parkingInfo: "청사 내 주차 가능",
    services: ["산재보험 가입 및 탈퇴", "보험료 부과", "피보험자 자격관리", "재해조사", "요양재활지원", "장해보상", "복지업무", "퇴직연금"],
    departments: [
      { name: "경영복지부", fax: "0505-801-1100", representativeTel: "032-540-4521", responsibilities: ["복지업무", "퇴직연금", "지사지원업무"], staffs: [] },
      { name: "가입지원부", fax: "0505-870-3100, 0505-864-4100", representativeTel: "032-540-4560", responsibilities: ["산재·고용보험 가입 및 탈퇴", "보험료부과", "피보험자 자격관리"], staffs: [] },
      { name: "재활보상1부", fax: "0505-600-2101", representativeTel: "032-540-4760", responsibilities: ["재해조사", "평균임금 산정"], staffs: [] },
      { name: "재활보상2부", fax: "0505-067-2200", representativeTel: "032-540-4660", responsibilities: ["요양재활지원", "장해보상", "원직장복귀지원"], staffs: [] },
    ],
  },

  수원지사: {
    postalCode: "16313",
    representativeTel: "1588-0075",
    hours: STD_HOURS,
    directions: "1호선 화서역 하차 후 KT&G 방향 지하차도 출구 / 버스 16-2·19·37 (수원상공회의소 하차)",
    parkingInfo: "건물 주차장 이용 가능 (1시간 무료)",
    services: ["대지급금(도산·간이)", "퇴직연금", "근로자 대부", "민사채권관리", "고용 및 산재보험 가입", "재해조사", "최초요양결정", "유족급여", "요양관리", "휴업급여", "장해심사"],
    departments: [
      { name: "가입지원부", fax: "0505-073-1281, 0505-376-3100, 0505-073-1206, 0505-732-4100", representativeTel: "031-231-4250", staffs: [] },
      { name: "재활보상1부", fax: "0505-377-2100, 0505-073-1250", representativeTel: "031-231-4277", staffs: [] },
      { name: "재활보상2부", fax: "0505-738-0015, 0505-847-2101", representativeTel: "031-231-4400", staffs: [] },
      { name: "경영복지부", fax: "0505-550-1100, 0505-720-5908", representativeTel: "031-231-4200", staffs: [] },
    ],
  },

  화성지사: {
    postalCode: "18302",
    representativeTel: "1588-0075",
    hours: STD_HOURS,
    directions: "버스 30-1·34-1·50·7790·8000 (동일하이빌·화성고용센터 하차)",
    parkingInfo: "청사 지하1~5층 지하주차장 이용 가능 (협소하므로 대중교통 이용 권장)",
    services: ["간이대지급금", "퇴직연금", "대부", "최초요양", "요양·재활관리", "보험급여지급", "적용 및 두루누리 지원사업", "보험료부과 징수", "근로자 정보관리"],
    departments: [
      { name: "경영복지부", fax: "0505-139-1103", responsibilities: ["퇴직연금", "간이·도산대지급금", "체불청산사업주 융자지원", "산재 근로자 생활안정자금 대부"], staffs: [] },
      { name: "재활보상1부", fax: "0505-290-2110", responsibilities: ["최초요양(근골격계질환 제외)", "유족급여 지급결정", "재해조사", "진료비·약제비"], staffs: [] },
      { name: "재활보상2부", fax: "0505-738-0016", responsibilities: ["요양관리", "재활서비스", "최초요양(근골격계질환)", "장해통합심사", "장해급여 지급결정"], staffs: [] },
      { name: "가입지원부", fax: "0505-310-3110", responsibilities: ["화성시 소재 사업장 보험료부과 및 징수", "근로자 고용신고", "건설업 적용·부과", "피보험자 자격관리"], staffs: [] },
    ],
  },

  용인지사: {
    postalCode: "16972",
    representativeTel: "1588-0075",
    hours: STD_HOURS,
    directions: "지하철: 수인분당선 신갈역 3번 출구(약 650m) / 기흥역 7번 출구(약 750m) / 버스: 기흥구청정류장(약 280m), 구갈공원정류장(약 200m)",
    parkingInfo: "건물 내 주차장 사용 가능 (협소하여 대중교통 이용 권장)",
    services: ["고용보험 및 산재보험 적용", "보험료 부과", "요양결정 및 급여 지급", "근로자 생활안정자금 융자", "퇴직연금 사업"],
    departments: [
      { name: "가입지원부", fax: "0505-296-3110", responsibilities: ["보험적용 및 부과", "피보험자 자격관리", "건설업 가입조사"], staffs: [] },
      { name: "경영복지부", fax: "0505-099-1103", representativeTel: "031-547-3703", responsibilities: ["대지급금 지급", "퇴직연금 사업", "근로자 생활안정자금 융자"], staffs: [] },
      { name: "재활보상1부", fax: "0505-173-2110", representativeTel: "031-547-3776", responsibilities: ["최초 요양결정", "유족급여 및 장의비 지급"], staffs: [] },
      { name: "재활보상2부", fax: "0505-738-0017", representativeTel: "031-547-3781", responsibilities: ["요양관리 및 재활서비스", "장해급여 지급", "원직복귀지원"], staffs: [] },
    ],
  },

  평택지사: {
    postalCode: "17774",
    representativeTel: "1588-0075",
    hours: STD_HOURS,
    directions: "전철: 송탄역(환승 1311·88·99) → 송탄출장소 / 버스: 송탄출장소(1311·1522·6396·M5438·5·11-2·88·99) / 자가용: 서정관광특구공영주차장",
    parkingInfo: "서정관광특구공영주차장(평택시 관광특구로 27) 또는 노상공영주차장",
    services: ["산재보상", "요양 및 재활", "가입납부", "근로자복지"],
    departments: [
      { name: "경영복지부", fax: "0505-890-1101", representativeTel: "1644-3648", responsibilities: ["대지급금", "퇴직연금", "근로자생활안정자금 융자"], staffs: [] },
      { name: "재활보상1부", fax: "0505-721-2100", representativeTel: "1644-8973", responsibilities: ["업무상 재해 접수 및 승인", "유족급여 지급"], staffs: [] },
      { name: "재활보상2부", fax: "0505-738-0018", responsibilities: ["요양관리 및 보험급여 지급", "산재근로자 재활서비스 지원"], staffs: [] },
      { name: "가입지원부", fax: "0505-314-3100", responsibilities: ["산재·고용보험 가입 및 피보험자 관리", "확인청구"], staffs: [] },
    ],
  },

  부천지사: {
    postalCode: "14623",
    representativeTel: "1588-0075",
    hours: STD_HOURS,
    directions: "지하철 1호선 송내역 하차 후 북광장에서 도보 10분",
    parkingInfo: "건물 후문 주차타워 이용(무료), SUV 등은 인근 공영주차장 이용(유료)",
    services: ["산재보험 가입 및 탈퇴", "보험료 부과 및 납부", "산재보상", "재활 및 요양관리", "근로자 대부", "퇴직연금", "임금채권보장"],
    departments: [
      { name: "가입지원부", fax: "0505-289-3100", representativeTel: "032-650-0290", responsibilities: ["산재·고용보험 가입 및 탈퇴", "보험료 부과", "피보험자 자격관리"], staffs: [] },
      { name: "경영복지부", fax: "0505-590-1100", representativeTel: "032-650-0357", responsibilities: ["간이·도산 대지급금", "퇴직연금", "근로자 생활안정자금 대부", "임금채권보장"], staffs: [] },
      { name: "재활보상1부", fax: "0505-331-2100", representativeTel: "032-650-0308", responsibilities: ["재해조사", "평균임금 산정", "유족급여 및 장의비"], staffs: [] },
      { name: "재활보상2부", fax: "0505-173-2101", representativeTel: "032-650-0310", responsibilities: ["요양관리 및 재활", "장해급여 지급", "재활서비스"], staffs: [] },
    ],
  },

  안양지사: {
    postalCode: "14006",
    representativeTel: "1588-0075",
    hours: STD_HOURS,
    directions: "지하철 1호선 안양역 하차 도보 약 5분 / 버스 1·1-2·11·12·2·20·3·5·8·8-2·80·81·88·9·9-3 등",
    parkingInfo: "교보생명 빌딩 뒤 1층 고객주차장",
    services: ["산재보상", "요양 및 재활", "가입납부", "근로자복지"],
    departments: [
      { name: "가입지원부", fax: "0505-381-3101", responsibilities: ["안양시·의왕시 적용·부과·자격관리"], staffs: [] },
      { name: "경영복지부", fax: "0505-540-1101", representativeTel: "031-463-0550", responsibilities: ["근로자 대부사업", "퇴직연금사업", "신용보증"], staffs: [] },
      { name: "재활보상1부", fax: "0505-393-2100", representativeTel: "031-463-0549", responsibilities: ["재해조사", "최초요양결정", "유족급여"], staffs: [] },
      { name: "재활보상2부", fax: "0505-351-2101", representativeTel: "031-463-0505", responsibilities: ["요양관리", "장해급여", "직업재활"], staffs: [] },
    ],
  },

  파주지사: {
    postalCode: "10896",
    representativeTel: "1588-0075",
    hours: STD_HOURS,
    directions: "지하철 경의중앙선 운정역 1번 출구 도보 800m / 버스 56·66·92·92-1·1500·3400·5600·7101·G7426·G7625·090",
    parkingInfo: "B1~B4층 주차 가능",
    services: ["대지급금", "퇴직연금", "대부사업", "보험료부과징수", "최초요양", "요양관리", "보험급여지급"],
    departments: [
      { name: "경영복지부", fax: "0505-720-5899", representativeTel: "031-934-1211", responsibilities: ["도산대지급금", "퇴직연금", "대부사업", "임금채권"], staffs: [] },
      { name: "가입지원부", fax: "0505-720-5903", representativeTel: "031-934-1220", responsibilities: ["보험적용", "두루누리지원", "보험료부과징수", "근로자정보관리"], staffs: [] },
      { name: "재활보상부", fax: "0505-720-5904", representativeTel: "031-934-1240", responsibilities: ["최초요양", "요양관리", "요양재활", "보험급여지급"], staffs: [] },
    ],
  },

  안산지사: {
    postalCode: "15532",
    representativeTel: "1588-0075",
    hours: STD_HOURS,
    directions: "지하철 4호선 상록수역 1번 출구에서 한대앞역 방향으로 500m 직진 후 반월농협 건물",
    parkingInfo: "정문 맞은편 공용주차장 또는 건물 지하2층 주차장",
    services: ["산재보상", "요양 및 재활", "가입 및 부과", "근로자복지", "생활안정자금대출", "퇴직연금", "임금채권보장"],
    departments: [
      { name: "경영복지부", fax: "0505-073-1100", representativeTel: "031-481-4110", responsibilities: ["지사 서무 및 경리", "생활안정자금대출", "퇴직연금", "임금채권보장사업"], staffs: [] },
      { name: "가입지원부", fax: "0505-377-3101", representativeTel: "031-481-4160", responsibilities: ["사업장 고용·산재보험 가입", "보험료 부과", "피보험자 자격관리"], staffs: [] },
      { name: "재활보상1부", fax: "0505-338-1200", representativeTel: "031-481-4199", responsibilities: ["요양 결정", "유족급여", "진폐 결정"], staffs: [] },
      { name: "재활보상2부", fax: "0505-300-2101", representativeTel: "031-481-4179", responsibilities: ["보험급여 지급", "진료비 심사", "재활서비스"], staffs: [] },
    ],
  },

  고양지사: {
    postalCode: "10410",
    representativeTel: "1588-0075",
    hours: STD_HOURS,
    directions: "지하철 3호선 마두역 5번 출구 700m",
    parkingInfo: "지상 1층 및 지하 2~3층 주차장 사용 가능 (1시간 이내 무료)",
    services: ["산재보상", "요양 및 재활", "가입납부", "근로자복지", "대부사업", "임금채권보장사업", "퇴직연금"],
    departments: [
      { name: "경영복지부", fax: "0505-414-1100", representativeTel: "031-931-0911", responsibilities: ["대부사업", "임금채권보장사업", "퇴직연금", "근로자 생활안정자금 융자"], staffs: [] },
      { name: "가입지원부", fax: "0505-130-3100", representativeTel: "031-931-0920", responsibilities: ["가입지원", "피보험자 관리", "보험료 부과", "건설업종 관리"], staffs: [] },
      { name: "재활보상부", fax: "0505-099-2100", representativeTel: "031-931-0960", responsibilities: ["산재요양결정", "보험급여지급", "진료비 심사", "재활서비스", "출퇴근재해 보상"], staffs: [] },
    ],
  },

  성남지사: {
    postalCode: "13426",
    representativeTel: "1588-0075",
    hours: STD_HOURS,
    directions: "야탑역 1번 출구 (버스 250·103·380·누리1) 또는 수인분당선 8호선 모란역 6번 출구 (버스 200·240)",
    parkingInfo: "고객용 지하주차장 B2·B3층 무료 제공",
    services: ["산재보험 가입·부과·자격관리", "고용보험 가입·부과·자격관리", "산재요양결정 및 보험급여지급", "요양관리 및 재활서비스", "근로자 융자사업", "퇴직연금사업"],
    departments: [
      { name: "경영복지부", fax: "0505-733-1100", responsibilities: ["경영관리", "근로자 융자사업", "퇴직연금사업", "체당금 지급"], staffs: [] },
      { name: "가입지원1부", fax: "0505-361-3100", responsibilities: ["고용·산재보험 가입·부과·자격관리"], staffs: [] },
      { name: "가입지원2부", fax: "0505-720-4100", responsibilities: ["고용·산재보험 가입·부과·자격관리"], staffs: [] },
      { name: "재활보상1부", fax: "0505-363-2100", responsibilities: ["산재요양결정", "보험급여지급", "재해조사"], staffs: [] },
      { name: "재활보상2부", fax: "0505-296-2101", responsibilities: ["요양관리", "보험급여지급", "진료비심사", "재활서비스"], staffs: [] },
    ],
  },

  // ─── 광주·전남·전북·제주권 ─────────────────────────────────────────
  광주지역본부: {
    postalCode: "61925",
    representativeTel: "1588-0075",
    hours: STD_HOURS,
    directions: "본관: 지하철 양동시장역 1번 출구에서 403m / 별관: 금남로5가역 4번 출구에서 482m",
    parkingInfo: "1시간 무료",
    services: ["산재보험 가입 및 소멸", "보험료 부과", "피보험자 자격관리", "산재보상", "진폐보상", "복지사업", "퇴직연금", "임금채권보장"],
    departments: [
      { name: "경영지원부", fax: "0505-488-1100", representativeTel: "062-608-0380", responsibilities: ["행정지원", "경리업무", "예산 및 계약관리"], staffs: [] },
      { name: "복지사업부", fax: "0505-284-6100", representativeTel: "062-608-0391", responsibilities: ["임금채권보장", "퇴직연금", "신용보증", "생활안정자금융자"], staffs: [] },
      { name: "재활보상1부", fax: "0505-139-2100", representativeTel: "062-608-0130", responsibilities: ["최초요양급여", "휴업급여", "유족급여", "장례비"], staffs: [] },
      { name: "재활보상2부", fax: "0505-067-2201", representativeTel: "062-608-0180", responsibilities: ["장해통합심사", "산재창업지원", "요양재활", "내일찾기"], staffs: [] },
      { name: "진폐보상부", fax: "0505-284-2203", representativeTel: "062-608-0129", responsibilities: ["진폐요양", "진폐보상", "진폐장해판정"], staffs: [] },
      { name: "부정수급예방부", fax: "0505-099-2101", representativeTel: "062-608-0371", responsibilities: ["부정수급조사", "구상금회수", "부당이득금관리"], staffs: [] },
      { name: "산재의학센터", fax: "0505-065-2210", representativeTel: "062-608-0190", responsibilities: ["진료비·약제비심사", "장해통합심사", "의학자문"], staffs: [] },
      { name: "가입지원1부", fax: "0505-150-3100", representativeTel: "062-608-0247", responsibilities: ["보험가입성립소멸", "보험료부과", "피보험자자격관리"], staffs: [] },
      { name: "가입지원2부", fax: "0505-130-4100", representativeTel: "062-608-0230", responsibilities: ["보험적용부과", "피보험자관리", "고용신고"], staffs: [] },
      { name: "송무부", fax: "0505-284-5101", representativeTel: "062-608-0339", responsibilities: ["소송업무", "법률자문"], staffs: [] },
    ],
  },

  전주지사: {
    postalCode: "55013",
    representativeTel: "1588-0075",
    hours: STD_HOURS,
    directions: "인후동 전자랜드 21사거리에서 전주역 방향으로 300m 직진 후 좌측 고용노동부종합청사 5층",
    services: ["산재보험", "고용보험", "요양 및 재활", "임금채권보장", "퇴직연금", "근로자복지"],
    departments: [
      { name: "가입지원1부", fax: "0505-282-3105", representativeTel: "063-240-8120", responsibilities: ["산재보험 및 고용보험 적용", "피보험자 자격관리", "사업개시 업무"], staffs: [] },
      { name: "가입지원2부", fax: "0505-867-4100, 0505-290-4104", representativeTel: "063-240-8120", responsibilities: ["보험료 부과", "근로자 고용신고", "피보험자 자격관리"], staffs: [] },
      { name: "재활보상1부", fax: "0505-650-2101", representativeTel: "063-240-8160", responsibilities: ["산재요양결정", "휴업급여", "재해조사"], staffs: [] },
      { name: "재활보상2부", fax: "0505-167-2102", representativeTel: "063-240-8170", responsibilities: ["요양재활", "장해급여", "재요양"], staffs: [] },
      { name: "경영복지부", fax: "0505-825-1101", representativeTel: "063-240-8111", responsibilities: ["대부사업", "임금채권보장", "퇴직연금"], staffs: [] },
    ],
  },

  익산지사: {
    postalCode: "54552",
    representativeTel: "1588-0075",
    hours: STD_HOURS,
    directions: "익산시 어양동 전자랜드 21 사거리에서 광주지방고용노동청 익산지청 방향으로 약 300m 직진",
    parkingInfo: "청사 앞 28대, 청사 뒤 30대",
    services: ["산재보상", "요양 및 재활", "가입납부", "근로자복지"],
    departments: [
      { name: "경영복지부", fax: "0505-455-1100", responsibilities: ["임금채권", "복지", "신용보증", "퇴직연금"], staffs: [] },
      { name: "가입지원부", fax: "0505-865-3100", responsibilities: ["고용보험", "산재보험 적용", "징수"], staffs: [] },
      { name: "재활보상부", fax: "0505-570-2100", responsibilities: ["산재요양결정", "보험급여지급", "진료비심사", "재활서비스"], staffs: [] },
    ],
  },

  군산지사: {
    postalCode: "54026",
    representativeTel: "1588-0075",
    hours: STD_HOURS,
    directions: "군산도시가스건물 1층(재활보상부), 2층(가입지원부), 3층(경영복지부)",
    parkingInfo: "빌딩 뒷편 고객용 주차장",
    services: ["근로자 대부사업", "퇴직연금", "산재요양결정", "보험급여지급", "고용산재가입지원"],
    departments: [
      { name: "경영복지부", fax: "0505-838-1100", responsibilities: ["근로자 대부사업", "퇴직연금", "임금채권", "경영지원"], staffs: [] },
      { name: "재활보상부", fax: "0505-167-2100", responsibilities: ["산재요양결정", "보험급여지급", "진료비심사", "재활서비스"], staffs: [] },
      { name: "가입지원부", fax: "0505-289-3101", responsibilities: ["고용산재가입지원", "피보험자관리", "보험료부과"], staffs: [] },
    ],
  },

  목포지사: {
    postalCode: "58730",
    representativeTel: "1588-0075",
    hours: STD_HOURS,
    directions: "목포역 옆 목포KT빌딩",
    parkingInfo: "KT빌딩 지하3층 또는 야외 주차장 이용 가능",
    services: ["고용·산재보험 적용 및 징수", "피보험자 자격관리", "산재요양결정", "보험급여지급", "재활서비스", "대부사업", "임금채권보장사업", "퇴직연금사업"],
    departments: [
      { name: "가입지원부", fax: "0505-221-1200", responsibilities: ["고용·산재보험 적용 및 징수", "피보험자 자격관리", "고용정보 관리"], staffs: [] },
      { name: "재활보상부", fax: "0505-252-2100", responsibilities: ["산재요양결정", "보험급여지급", "재활서비스"], staffs: [] },
      { name: "경영복지부", fax: "0505-842-1100", responsibilities: ["지사 서무·경리", "대부사업", "임금채권보장사업", "퇴직연금사업"], staffs: [] },
    ],
  },

  여수지사: {
    postalCode: "59700",
    representativeTel: "1588-0075",
    hours: STD_HOURS,
    directions: "여수 문수동 KT 옆 건물 (여수해양경찰서 부근)",
    services: ["산재 및 고용보험 업무", "각종 대부사업", "임금채권보장사업", "산재요양결정", "보험급여지급", "진료비심사 및 재활서비스"],
    departments: [
      { name: "가입지원부", fax: "0505-073-1202", representativeTel: "061-680-0219", responsibilities: ["보험가입조사", "보험적용 및 부과", "근로자 고용신고", "피보험자 자격관리"], staffs: [] },
      { name: "경영복지부", fax: "0505-731-1100", representativeTel: "061-680-0150", responsibilities: ["대부사업", "임금채권보장", "퇴직연금", "생활안정자금 융자"], staffs: [] },
      { name: "재활보상부", fax: "0505-510-2100", representativeTel: "061-680-0259", responsibilities: ["산재요양결정", "보험급여지급", "진료비심사", "재활서비스"], staffs: [] },
    ],
  },

  광산지사: {
    postalCode: "62363",
    representativeTel: "1588-0075",
    hours: STD_HOURS,
    directions: "하남80M도로 KT우산빌딩 1층·10층 / 버스: 금호46·송암68 (광산우산동주민센터 하차)",
    parkingInfo: "KT우산빌딩 후문 앞 공영주차장 또는 우산동 주민센터 옆 공영주차장 이용 (주차이용권 30분 제공)",
    services: ["산재요양결정", "보험급여지급", "진료비심사", "재활서비스", "대부사업", "임금채권보장", "퇴직연금", "보험적용 및 징수"],
    departments: [
      { name: "가입지원부", fax: "0505-290-4108", responsibilities: ["고용·산재보험 적용 및 징수", "보험가입조사", "근로자 고용신고", "피보험자 자격관리"], staffs: [] },
      { name: "경영복지부", fax: "0505-050-1102", responsibilities: ["대부사업", "임금채권보장사업", "퇴직연금사업"], staffs: [] },
      { name: "재활보상부", fax: "0505-139-3100", responsibilities: ["산재요양결정", "보험급여지급", "진료비심사 및 재활서비스"], staffs: [] },
    ],
  },

  순천지사: {
    postalCode: "57934",
    representativeTel: "1588-0075",
    hours: STD_HOURS,
    directions: "순천농협 파머스마켓 봉화점(조례 호수공원) 건너편 성보메디컬타워 5층",
    parkingInfo: "지사 앞편 및 지하 주차장 개방",
    services: ["고용·산재보험 적용 및 부과", "근로자 고용신고", "산재보상", "요양관리", "임금채권", "퇴직연금"],
    departments: [
      { name: "가입지원부", fax: "0505-289-4103", representativeTel: "061-805-0250", responsibilities: ["고용·산재보험 적용 및 부과", "근로자 고용신고", "피보험자 자격관리"], staffs: [] },
      { name: "경영복지부", fax: "0505-838-4100", representativeTel: "061-805-0202", responsibilities: ["임금채권", "복지 지원", "퇴직연금"], staffs: [] },
      { name: "재활보상부", fax: "0505-348-1203", representativeTel: "061-805-0290", responsibilities: ["산재보상", "재해조사", "요양관리", "장해급여 지급결정"], staffs: [] },
    ],
  },

  제주지사: {
    postalCode: "63225",
    representativeTel: "1588-0075",
    hours: STD_HOURS,
    directions: "연삼로 제주은행(선관위) 사거리에서 남쪽 한라산(한마음병원) 방향으로 50m",
    parkingInfo: "청사내 주차장 무료 개방",
    services: ["고용보험 및 산재보험 관리", "산재요양결정 및 보험급여 지급", "재활서비스", "경영복지 및 근로자 대부사업"],
    departments: [
      { name: "가입지원부", fax: "0505-871-3100", representativeTel: "064-754-6730", responsibilities: ["보험적용 및 부과", "근로자 고용신고", "피보험자 자격관리"], staffs: [] },
      { name: "재활보상부", fax: "0505-572-2100", representativeTel: "064-754-6712", responsibilities: ["산재요양결정", "보험급여 지급", "재활서비스"], staffs: [] },
      { name: "경영복지부", fax: "0505-434-1100", representativeTel: "064-754-6708", responsibilities: ["경영복지업무", "대부사업", "임금채권보장"], staffs: [] },
    ],
  },

  // ─── 대전·충남·충북·세종권 ─────────────────────────────────────────
  대전지역본부: {
    postalCode: "35209",
    representativeTel: "1588-0075",
    hours: STD_HOURS,
    directions: "지하철 1호선 정부종합청사역 4번 출구 도보 10분",
    parkingInfo: "1시간 무료 (이후 유료)",
    services: ["산재보상", "요양 및 재활", "가입납부", "근로자복지", "부정수급예방"],
    departments: [
      { name: "경영지원부", fax: "0505-235-1101", representativeTel: "042-870-9200", responsibilities: ["행정지원업무", "인사", "서무", "경리"], staffs: [] },
      { name: "재활보상1부", fax: "0505-233-2100", representativeTel: "042-870-9550", responsibilities: ["재해조사", "유족급여", "진폐"], staffs: [] },
      { name: "가입지원1부", fax: "0505-197-3100", representativeTel: "042-870-9300", responsibilities: ["보험적용", "피보험자자격관리", "확정정산"], staffs: [] },
      { name: "복지사업부", fax: "0505-290-6100", representativeTel: "042-870-9230", responsibilities: ["대부사업", "임금채권보장", "퇴직연금"], staffs: [] },
    ],
  },

  대전동부지사: {
    postalCode: "34675",
    representativeTel: "1588-0075",
    hours: STD_HOURS,
    directions: "지하철 판암역 4번 출구에서 도보 4분",
    parkingInfo: "건물 지하 주차 가능 / 판암역 환승주차장 1시간 무료",
    services: ["산재보상", "요양관리", "재활", "보험가입", "근로자융자", "퇴직연금"],
    departments: [
      { name: "가입지원부", fax: "0505-720-5901", representativeTel: "042-722-4130", responsibilities: ["보험료 부과 및 징수", "근로자 고용신고", "피보험자 자격관리", "건설업 적용"], staffs: [] },
      { name: "경영복지부", fax: "0505-720-5898", representativeTel: "042-722-4110", responsibilities: ["근로자 융자사업", "퇴직연금사업", "임금채권 관련 업무"], staffs: [] },
      { name: "재활보상부", fax: "0505-720-5902", representativeTel: "042-722-4170", responsibilities: ["최초요양", "요양관리", "재활", "장해급여 지급결정"], staffs: [] },
    ],
  },

  대전특수형태근로종사자센터: {
    postalCode: "35209",
    representativeTel: "1588-0075",
    hours: STD_HOURS,
    services: ["노무제공자 가입지원", "가입·부과·자격관리", "MO 서비스"],
    departments: [
      { name: "특고가입1부", fax: "0505-139-1102", responsibilities: ["대전·충북·충남·세종 소재 사업장 특수형태근로종사자 가입지원", "노무제공자 가입·부과·자격관리"], staffs: [] },
      { name: "특고가입2부", fax: "0505-250-1103", responsibilities: ["광주·전북·전남·제주 소재 사업장 특수형태근로종사자 가입지원", "노무제공자 가입·부과·자격관리"], staffs: [] },
    ],
  },

  청주지사: {
    postalCode: "28481",
    representativeTel: "1588-0075",
    hours: STD_HOURS,
    directions: "본관: 가입지원부·경영복지부 - 내덕동 첼로병원 건물 뒷편 / 별관: 재활보상1·2부 - 덕벌초등학교 맞은편 새마을금고 건물 4층",
    parkingInfo: "본관 및 별관 지하주차장 (주차공간 부족 시 인근 주택가 도로 이용)",
    services: ["고용·산재보험 적용 및 부과", "피보험자 관리", "산재보상 및 재활", "경영지원", "복지사업", "퇴직연금"],
    departments: [
      { name: "가입지원부", fax: "0505-304-3100", responsibilities: ["고용·산재보험 적용·부과", "피보험자 자격관리"], staffs: [] },
      { name: "경영복지부", fax: "0505-845-1101", responsibilities: ["복지사업", "퇴직연금", "행정지원"], staffs: [] },
      { name: "재활보상1부", fax: "0505-720-2101", responsibilities: ["산재요양결정", "재해조사"], staffs: [] },
      { name: "재활보상2부", fax: "0505-738-0012", responsibilities: ["보험급여지급", "장해급여"], staffs: [] },
    ],
  },

  천안지사: {
    postalCode: "31169",
    representativeTel: "1588-0075",
    hours: STD_HOURS,
    directions: "Y-CITY 앞 충남북부상공회의소 건물 7층(가입지원부·재활보상부), 8층(경영복지부)",
    parkingInfo: "지하1·2·3층, 야외주차장 이용 가능",
    services: ["보험가입 및 보험료부과", "피보험자 자격관리", "재해상담", "요양재활", "복지", "퇴직연금"],
    departments: [
      { name: "가입지원부", fax: "0505-299-3100", representativeTel: "041-629-5130", responsibilities: ["보험가입 및 보험료부과", "피보험자 자격관리"], staffs: [] },
      { name: "경영복지부", fax: "0505-838-1101", representativeTel: "041-629-5171", responsibilities: ["복지", "임금채권", "퇴직연금", "행정지원"], staffs: [] },
      { name: "재활보상부", fax: "0505-650-2100", representativeTel: "041-629-5150", responsibilities: ["재해상담", "출퇴근재해", "요양재활"], staffs: [] },
    ],
  },

  충주지사: {
    postalCode: "27427",
    representativeTel: "1588-0075",
    hours: STD_HOURS,
    directions: "시내버스 170·171·172 충주농협 앞 정거장 하차",
    parkingInfo: "청사 주차공간 32대 (장애인 2대) / 차량 2부제 참여 차량에 한하여 주차 가능",
    services: ["고용산재보험 적용 및 부과", "퇴직연금", "산재보상", "산재요양결정", "보험급여지급", "생활안정자금 대부"],
    departments: [
      { name: "가입지원부", fax: "0505-308-3100", representativeTel: "043-840-0322", responsibilities: ["고용산재보험 적용 및 부과", "피보험자 자격관리", "근로자 고용신고"], staffs: [] },
      { name: "재활보상부", fax: "0505-679-2100", representativeTel: "043-840-0370", responsibilities: ["산재요양결정", "보험급여지급", "진료비심사", "재활서비스"], staffs: [] },
      { name: "경영복지부", fax: "0505-847-1101", representativeTel: "043-840-0360", responsibilities: ["퇴직연금", "생활안정자금 대부", "대지급금 지급", "임금채권"], staffs: [] },
    ],
  },

  보령지사: {
    postalCode: "33433",
    representativeTel: "1588-0075",
    hours: STD_HOURS,
    directions: "동대동 한내사거리",
    parkingInfo: "청사 및 인근 공영주차장 가능",
    services: ["산재 요양 결정", "보험급여 지급", "진료비 심사", "재활 서비스", "고용·산재보험 적용 및 징수", "피보험자 관리", "융자", "임금채권보장", "퇴직연금"],
    departments: [
      { name: "재활보상부", fax: "0505-262-2100", representativeTel: "041-939-2320", responsibilities: ["산재 요양 결정", "보험급여 지급", "진료비·약제비 심사", "재활 서비스"], staffs: [] },
      { name: "가입지원부", fax: "0505-252-3100", representativeTel: "041-939-2220", responsibilities: ["고용·산재보험 적용", "보험료 징수", "피보험자 자격관리"], staffs: [] },
      { name: "경영복지부", fax: "0505-765-1100", representativeTel: "041-939-2260", responsibilities: ["근로자 융자", "임금채권보장", "퇴직연금"], staffs: [] },
    ],
  },

  서산지사: {
    postalCode: "31998",
    representativeTel: "1588-0075",
    hours: STD_HOURS,
    directions: "버스 100·110·162 - 석남사거리 정류장 하차",
    parkingInfo: "지하1층 주차장, 청사 옆 지상 주차장",
    services: ["사업장 보험료부과 및 징수", "근로자 자격관리", "재해조사", "요양 및 재활업무", "도산 및 간이대지급금", "퇴직연금", "생활안정자금 융자"],
    departments: [
      { name: "가입지원부", fax: "0505-290-3110", responsibilities: ["보험료부과 징수", "근로자관리", "건설업 적용"], staffs: [] },
      { name: "재활보상부", fax: "0505-139-2110", responsibilities: ["재해조사", "요양관리", "요양급여 지급"], staffs: [] },
      { name: "경영복지부", fax: "0505-287-1101", representativeTel: "041-419-8104", responsibilities: ["도산 및 간이대지급금", "퇴직연금", "생활안정자금 융자"], staffs: [] },
    ],
  },

  세종지사: {
    postalCode: "30116",
    representativeTel: "1588-0075",
    hours: STD_HOURS,
    directions: "BRT 정부세종청사(남측) 정류장에서 AK몰 방향으로 300m 도보 이동",
    services: [
      "산재요양 및 보험급여",
      "진료비심사",
      "재활서비스",
      "퇴직연금·대부·신용보증",
      "임금채권보장",
      "고용·산재보험 적용·징수·체납처분",
    ],
    departments: [
      { name: "가입지원부", fax: "0505-544-2100", responsibilities: ["고용·산재보험 적용", "징수", "납부독려", "체납처분"], staffs: [] },
      { name: "재활보상부", fax: "0505-732-3100", responsibilities: ["산재요양", "보험급여", "진료비심사", "재활서비스"], staffs: [] },
      { name: "경영복지부", fax: "0505-477-1100", responsibilities: ["퇴직연금", "대부·신용보증 지원", "임금채권보장"], staffs: [] },
    ],
  },

  // ─── 강원권 ────────────────────────────────────────────────────────────
  강원지역본부: {
    postalCode: "26387",
    representativeTel: "1588-0075",
    hours: STD_HOURS,
    directions: "원주시청 앞 / 고용노동부 원주지청 옆 위치",
    parkingInfo: "개방형 주차장 운영 (무료, 평일 18:00~08:00 / 토·일·공휴일 종일개방)",
    services: ["산재보상", "요양 및 재활", "가입납부", "근로자복지"],
    departments: [
      { name: "경영지원부", fax: "0505-132-1101", representativeTel: "033-749-2362", responsibilities: ["행정지원", "경리", "서무", "인사"], staffs: [] },
      { name: "가입지원부", fax: "0505-067-3100", representativeTel: "033-749-2397", responsibilities: ["고용·산재보험 적용", "징수", "자격관리", "보험가입조사"], staffs: [] },
      { name: "재활보상부", fax: "0505-067-2100", representativeTel: "033-749-2351", responsibilities: ["산재요양결정", "보험급여지급", "재활서비스", "재해조사"], staffs: [] },
      { name: "복지사업부", fax: "0505-175-1100", representativeTel: "033-749-2315", responsibilities: ["임금채권보장", "신용보증", "퇴직연금", "융자사업"], staffs: [] },
      { name: "진폐보상부", fax: "0505-284-2102", representativeTel: "033-749-6701", responsibilities: ["진폐평균임금결정", "진폐요양", "유족위로금", "장해업무"], staffs: [] },
    ],
  },

  춘천지사: {
    postalCode: "24415",
    representativeTel: "1588-0075",
    hours: STD_HOURS,
    directions: "버스 2·3·15·200·400 춘천고용복지센터 정류소 하차 후 우리소아과 방향 도보 3분",
    parkingInfo: "무료 (주차 장소가 협소하니 가급적 대중교통 이용 권장)",
    services: ["산재보상", "요양 및 재활", "가입납부", "근로자복지"],
    departments: [
      { name: "경영복지부", fax: "0505-084-1102", representativeTel: "033-240-6119", responsibilities: ["경영지원", "신용보증", "대부업무", "퇴직연금", "생활안정자금 융자"], staffs: [] },
      { name: "재활보상부", fax: "0505-674-2100", representativeTel: "033-240-6190", responsibilities: ["산재요양결정", "보험급여지급", "진료비심사", "재활서비스", "재해조사"], staffs: [] },
      { name: "가입지원부", fax: "0505-306-3100", representativeTel: "033-240-6111", responsibilities: ["고용보험 적용", "산재보험 부과", "피보험자격관리", "보험료 부과"], staffs: [] },
    ],
  },

  강릉지사: {
    postalCode: "25492",
    representativeTel: "1588-0075",
    hours: STD_HOURS,
    directions: "버스 206·207·223·229·230 강릉역 하차 후 경찰서 방향 200m 한국빌딩 3·4층",
    parkingInfo: "주차장이 협소하므로 대중교통 이용 권장",
    services: ["고용·산재보험 적용", "보험료 부과 및 징수", "산재요양 결정", "보험급여 지급", "진료비 심사", "재활서비스", "퇴직연금 가입", "근로자 대부", "임금채권 보장금 지급"],
    departments: [
      { name: "가입지원부", fax: "0505-055-3100, 0505-055-4100, 0505-139-1104", representativeTel: "033-640-9118", responsibilities: ["보험 적용 및 부과", "근로자 고용신고", "피보험자 자격관리"], staffs: [] },
      { name: "재활보상부", fax: "0505-065-2100", representativeTel: "033-640-9172", responsibilities: ["산재요양 결정", "보험급여 지급", "진료비·약제비 심사", "재활서비스"], staffs: [] },
      { name: "경영복지부", fax: "0505-173-1100", representativeTel: "033-640-9104", responsibilities: ["퇴직연금 가입", "생활안정자금 대부", "임금채권 보장금 지급"], staffs: [] },
    ],
  },

  태백지사: {
    postalCode: "26008",
    representativeTel: "1588-0075",
    hours: STD_HOURS,
    directions: "태백시 황지로 181 1층 K2매장 (국민은행 앞 일방통행도로로 100m 직진)",
    parkingInfo: "건물 뒷편 주차공간 (협소하여 대중교통 권장)",
    services: ["산재보상", "요양재활", "가입납부", "근로자복지"],
    departments: [
      { name: "재활보상부", fax: "0505-721-2101", responsibilities: ["업무상 재해/질병 보상", "장해 보상", "진폐 보상", "요양·재활 서비스"], staffs: [] },
      { name: "가입지원부", fax: "0505-309-3100", responsibilities: ["고용·산재보험 적용 및 부과", "피보험자격관리"], staffs: [] },
      { name: "경영복지부", fax: "0505-861-1101", responsibilities: ["생활안정자금 대부", "직업훈련생계비 대부", "퇴직연금"], staffs: [] },
    ],
  },

  영월지사: {
    postalCode: "26233",
    representativeTel: "1588-0075",
    hours: STD_HOURS,
    directions: "영월터미널에서 300m, 영월경찰서 뒤, 영월우체국 옆",
    parkingInfo: "청사 내 주차장 이용 가능",
    services: ["산재요양결정", "보험급여지급", "진료비심사", "재활서비스", "가입 및 부과", "임금채권보장사업", "퇴직연금 사업"],
    departments: [
      { name: "경영복지부", fax: "0505-810-1100", representativeTel: "033-371-6120", responsibilities: ["대부사업", "임금채권보장사업", "퇴직연금 사업"], staffs: [] },
      { name: "재활보상부", fax: "0505-520-2100", representativeTel: "033-371-6160", responsibilities: ["산재요양결정", "보험급여지급", "진료비심사", "진폐업무"], staffs: [] },
      { name: "가입지원부", fax: "0505-499-3100", representativeTel: "033-371-6140", responsibilities: ["고용보험 가입", "산재보험 가입", "피보험자 자격관리"], staffs: [] },
    ],
  },
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
