"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";

const PdfViewerModal = dynamic(() => import("./PdfViewerModal"), { ssr: false });

/* ═══════════════════════════════════════════════════════
   타입
═══════════════════════════════════════════════════════ */
interface InfoEntry {
  no: string;
  title: string;
  desc?: string;
  content?: string;   // 핵심 발췌 텍스트 (복사 버튼용)
  fileUrl?: string;   // PDF 경로 (예: /docs/파일명.pdf)
  cat1: string;   // 1단계 (산재직업병, 산재외, 요양휴업, ...)
  cat2?: string;  // 2단계 (난청, 진폐COPD, ...)
  cat3?: string;  // 3단계 (일반, 이의제기, 판례)
}

/* ═══════════════════════════════════════════════════════
   카테고리 메타
═══════════════════════════════════════════════════════ */
const CAT1_LIST = [
  { key: "산재직업병",  label: "1. 산재·직업병 일반" },
  { key: "산재외",      label: "2. 산재 외(특별법)" },
  { key: "요양휴업",    label: "3. 요양 및 휴업급여" },
  { key: "장해급여",    label: "4. 장해급여" },
  { key: "유족급여",    label: "5. 유족급여" },
  { key: "평균임금",    label: "6. 평균임금" },
  { key: "법적용범위",  label: "7. 법적용범위" },
  { key: "부당이득",    label: "8. 부당이득·구상권·손해배상·공제·상속 등" },
  { key: "시효제척",    label: "9. 시효 및 제척기간" },
  { key: "공단자료",    label: "10. 공단자료" },
  { key: "법인내부",    label: "11. 법인 내부자료" },
  { key: "의학근거",    label: "12. 의학적·자연과학적 근거자료" },
  { key: "기타",        label: "13. 기타" },
] as const;

const CAT2_MAP: Record<string, { key: string; label: string }[]> = {
  산재직업병: [
    { key: "난청",         label: "난청" },
    { key: "진폐COPD",     label: "진폐/COPD" },
    { key: "뇌심혈관계",   label: "뇌심혈관계" },
    { key: "폐암",         label: "폐암" },
    { key: "근골격계",     label: "근골격계" },
    { key: "안구",         label: "안구" },
    { key: "기타직업성암", label: "기타 직업성 암" },
    { key: "정신질환",     label: "정신질환" },
    { key: "업무상사고",   label: "업무상 사고" },
    { key: "출퇴근재해",   label: "출퇴근재해" },
    { key: "산재기타",     label: "기타" },
  ],
  산재외: [
    { key: "공상보훈",   label: "공상 및 보훈" },
    { key: "어선원선원", label: "어선원 및 선원" },
  ],
  요양휴업: [
    { key: "요양급여", label: "요양급여" },
    { key: "휴업급여", label: "휴업급여" },
  ],
  법적용범위: [
    { key: "근로자성",     label: "근로자성" },
    { key: "노무제공자",   label: "노무제공자" },
    { key: "외국인",       label: "외국인" },
    { key: "5인미만",      label: "5인미만" },
    { key: "고의자해범죄", label: "고의·자해·범죄행위" },
    { key: "법적용기타",   label: "기타" },
  ],
  공단자료: [
    { key: "질의회시", label: "질의회시" },
    { key: "지침",     label: "지침 (서식자료·교재·업무처리규정 등)" },
  ],
  의학근거: [
    { key: "논문",         label: "논문" },
    { key: "진료기록감정", label: "진료기록감정" },
    { key: "작업환경측정", label: "작업환경측정결과" },
    { key: "의학기타",     label: "기타" },
  ],
};

/* ═══════════════════════════════════════════════════════
   데이터 (300건)
═══════════════════════════════════════════════════════ */
const DATA: InfoEntry[] = [

  /* ─── 1. 산재·직업병 일반 > 난청 ─────────────────── */
  { cat1:"산재직업병", cat2:"난청", cat3:"이의제기", no:"이의1",   title:"위난청 SRT와 PTA" },
  { cat1:"산재직업병", cat2:"난청", cat3:"이의제기", no:"이의2",   title:"편측 중이염" },
  { cat1:"산재직업병", cat2:"난청", cat3:"이의제기", no:"이의3",   title:"노인성·수평형·장기간 소음노출중단" },
  { cat1:"산재직업병", cat2:"난청", cat3:"이의제기", no:"이의4",   title:"특수건강검진·비소음작업" },
  { cat1:"산재직업병", cat2:"난청", cat3:"이의제기", no:"이의5",   title:"과거직력 — 최근 작측 기준 처분·소음노출기간" },
  { cat1:"산재직업병", cat2:"난청", cat3:"이의제기", no:"이의6",   title:"객관직력미달 (공단 축소해석)" },
  { cat1:"산재직업병", cat2:"난청", cat3:"이의제기", no:"이의7",   title:"과거수진이력 일부승인" },
  { cat1:"산재직업병", cat2:"난청", cat3:"이의제기", no:"이의8",   title:"형틀목공" },
  { cat1:"산재직업병", cat2:"난청", cat3:"이의제기", no:"이의11",  title:"원재특진 상향" },
  { cat1:"산재직업병", cat2:"난청", cat3:"이의제기", no:"이의12",  title:"중이염·편측 승인" },
  { cat1:"산재직업병", cat2:"난청", cat3:"이의제기", no:"이의13",  title:"이소골 이상·객관직력 미달" },
  { cat1:"산재직업병", cat2:"난청", cat3:"이의제기", no:"이의14",  title:"위난청 및 소음노출수준" },
  { cat1:"산재직업병", cat2:"난청", cat3:"이의제기", no:"이의15",  title:"저음역 및 노인성" },
  { cat1:"산재직업병", cat2:"난청", cat3:"이의제기", no:"이의16",  title:"고주파역치·과거수진이력" },
  { cat1:"산재직업병", cat2:"난청", cat3:"이의제기", no:"이의17",  title:"비대칭·심도 난청·편평형·고음 급추형" },
  { cat1:"산재직업병", cat2:"난청", cat3:"이의제기", no:"이의18",  title:"편평형·위난청·중저음역 역치저하" },
  { cat1:"산재직업병", cat2:"난청", cat3:"이의제기", no:"이의19",  title:"비대칭·편평형" },
  { cat1:"산재직업병", cat2:"난청", cat3:"이의제기", no:"이의20",  title:"혼합성 난청" },
  { cat1:"산재직업병", cat2:"난청", cat3:"이의제기", no:"이의21",  title:"노인성난청·수평형" },
  { cat1:"산재직업병", cat2:"난청", cat3:"이의제기", no:"이의21b", title:"편평형·과거 특진기록" },
  { cat1:"산재직업병", cat2:"난청", cat3:"이의제기", no:"이의22",  title:"비대칭·40dB 미만" },
  { cat1:"산재직업병", cat2:"난청", cat3:"이의제기", no:"이의23",  title:"심사·재심사 유형화", desc:"마스터 이유서 전사 가이드 제안" },
  { cat1:"산재직업병", cat2:"난청", cat3:"이의제기", no:"이의24",  title:"비대칭난청·혼합성난청 (만성 중이염·외상 등)" },
  { cat1:"산재직업병", cat2:"난청", cat3:"이의제기", no:"이의25",  title:"일반건강검진 증상고정 쟁점", desc:"일검/특검 근거 부지급 case 대응 논리" },
  { cat1:"산재직업병", cat2:"난청", cat3:"이의제기", no:"이의29",  title:"혼합성 난청(골도미달) 감사원심사례", desc:"결론: 기각" },
  { cat1:"산재직업병", cat2:"난청", cat3:"이의제기", no:"이의30",  title:"기도청력역치 수치미달 & ABR 수치충족", desc:"결론: 기각" },
  { cat1:"산재직업병", cat2:"난청", cat3:"이의제기", no:"이의31",  title:"원특진(10급)/재특진(14급) 원특진 근거 상향", desc:"결론: 기각" },
  { cat1:"산재직업병", cat2:"난청", cat3:"이의제기", no:"이의33",  title:"난청-국가장애 (박병대 CASE)", desc:"결론: 기각" },
  { cat1:"산재직업병", cat2:"난청", cat3:"이의제기", no:"이의34",  title:"노인성 난청·관리직 직종 비소음 처리" },
  { cat1:"산재직업병", cat2:"난청", cat3:"이의제기", no:"이의37",  title:"대구병원 형틀목공 건축 업무 85dB 이상" },

  { cat1:"산재직업병", cat2:"난청", cat3:"판례", no:"판1",    title:"신뢰성 결여 최초특진 결과 활용 위법" },
  { cat1:"산재직업병", cat2:"난청", cat3:"판례", no:"판1끌",  title:"1차 특진 신뢰도 결하는 경우 2차 특진으로 장해등급 부여 타당 여부", desc:"결론: 타당. 공단 상고 포기 확정" },
  { cat1:"산재직업병", cat2:"난청", cat3:"판례", no:"판2",    title:"난청 무직력 상향" },
  { cat1:"산재직업병", cat2:"난청", cat3:"판례", no:"판3",    title:"저강도 소음 장기간 노출" },
  { cat1:"산재직업병", cat2:"난청", cat3:"판례", no:"판4",    title:"현재 작측을 기준으로 과거 작업평가" },
  { cat1:"산재직업병", cat2:"난청", cat3:"판례", no:"판5",    title:"광업소 소음노출중단기간 50년 — 노인성 난청 쟁점" },
  { cat1:"산재직업병", cat2:"난청", cat3:"판례", no:"판6",    title:"비대칭(편측 정상/편측 고도난청)", desc:"더보상 사건 승소 — 장해판정가이드라인과 배치" },
  { cat1:"산재직업병", cat2:"난청", cat3:"판례", no:"판7",    title:"비대칭난청(공무상재해) — 일측에 준하여 판단" },
  { cat1:"산재직업병", cat2:"난청", cat3:"판례", no:"판8",    title:"일반건강검진 '정상' 소견 쟁점·장기간 소음노출중단", desc:"일검 정상이어도 소음성난청 존재 가능 — 섣불리 무관 단정 불가" },
  { cat1:"산재직업병", cat2:"난청", cat3:"판례", no:"판9",    title:"원특진·재특진 신뢰도 관련 판례" },
  { cat1:"산재직업병", cat2:"난청", cat3:"판례", no:"판10",   title:"감각신경성 난청인데 혼합성난청(골도미달) 이유로 부지급", desc:"항상 소송에서 뒤집히는 케이스" },
  { cat1:"산재직업병", cat2:"난청", cat3:"판례", no:"판13",   title:"난청 장기간 저강도 소음 노출" },
  { cat1:"산재직업병", cat2:"난청", cat3:"판례", no:"판14",   title:"노인성 난청 자연경과적 속도 이상으로 악화" },
  { cat1:"산재직업병", cat2:"난청", cat3:"판례", no:"판15",   title:"난미장 2심" },
  { cat1:"산재직업병", cat2:"난청", cat3:"판례", no:"판16",   title:"난미장 1심" },
  { cat1:"산재직업병", cat2:"난청", cat3:"판례", no:"판17",   title:"비대칭난청 판례" },
  { cat1:"산재직업병", cat2:"난청", cat3:"판례", no:"판18",   title:"특수건강검진 결과 정상 & 이후 노인성난청 (이봉용)", desc:"원고패소 — 매우 불리한 판결" },
  { cat1:"산재직업병", cat2:"난청", cat3:"판례", no:"판28",   title:"난청 무직력 상향 항소심 확정 판결" },
  { cat1:"산재직업병", cat2:"난청", cat3:"판례", no:"판65",   title:"만성중이염과 골도청력과의 관계" },
  { cat1:"산재직업병", cat2:"난청", cat3:"판례", no:"판66",   title:"80~85dB 소음노출수준이 청력 악화에 미치는 영향" },
  { cat1:"산재직업병", cat2:"난청", cat3:"판례", no:"판67",   title:"난청 가중 장해 내지 유직력 상향 — 추가소음노출력 기간 판결" },

  { cat1:"산재직업병", cat2:"난청", cat3:"일반", no:"일1",    title:"선박기관장 — 산재" },
  { cat1:"산재직업병", cat2:"난청", cat3:"일반", no:"일4",    title:"특진/재특진 미완료자 처리방법 (공단자료, 수치미달 포함)" },
  { cat1:"산재직업병", cat2:"난청", cat3:"일반", no:"일5",    title:"소음성 난청 장해판정 가이드라인" },
  { cat1:"산재직업병", cat2:"난청", cat3:"일반", no:"일6",    title:"소음성 난청 소견서 보완 관련 근거자료" },
  { cat1:"산재직업병", cat2:"난청", cat3:"일반", no:"일7",    title:"광업소 종사자 직종 불확실한 경우 소음 측정치 추정 판례", desc:"58개 공정 소음치 평균(90.381dB)으로 근로자에게 유리 판결" },
  { cat1:"산재직업병", cat2:"난청", cat3:"일반", no:"일10",   title:"노임단가 직종 입증2" },
  { cat1:"산재직업병", cat2:"난청", cat3:"일반", no:"일12",   title:"난청 이의제기 마스터 이유서 제작 완료" },
  { cat1:"산재직업병", cat2:"난청", cat3:"일반", no:"일13",   title:"소방관(공무상재해) 사이렌 소리와 소음성 난청 의학적 인과관계" },
  { cat1:"산재직업병", cat2:"난청", cat3:"일반", no:"일13-1", title:"소방관(공무상재해) 사이렌 — 강태성 진료기록 감정" },
  { cat1:"산재직업병", cat2:"난청", cat3:"일반", no:"일16",   title:"현대삼호중공업 크레인운전 작업환경측정결과표 2010~2020" },
  { cat1:"산재직업병", cat2:"난청", cat3:"일반", no:"일17",   title:"현재 작측 과거 작업환경 적용 관련 국민신문고 민원 회신", desc:"공단 답변: '전문가 의견 등을 종합적으로 고려했음'" },
  { cat1:"산재직업병", cat2:"난청", cat3:"일반", no:"일19-1", title:"순음>ABR임에도 감각신경성 난청 신뢰도 인정 여부", desc:"위난청 감별에서는 순음청력검사 재현성이 더 중요" },
  { cat1:"산재직업병", cat2:"난청", cat3:"일반", no:"일24",   title:"건설업 근로자 직종별 건강진단 방안연구" },
  { cat1:"산재직업병", cat2:"난청", cat3:"일반", no:"일26",   title:"좌측 귀 청력이 소음에 더 민감하다는 연구논문" },
  { cat1:"산재직업병", cat2:"난청", cat3:"일반", no:"일27",   title:"건설업 직종별 소음노출수준 판단요령" },
  { cat1:"산재직업병", cat2:"난청", cat3:"일반", no:"일31",   title:"소음강도와 시간과의 상관관계 — 3dB rule" },
  { cat1:"산재직업병", cat2:"난청", cat3:"일반", no:"일33",   title:"경기도 소재 공립학교 조리실 소음수준" },

  /* ─── 1. 산재·직업병 일반 > 진폐/COPD ───────────── */
  { cat1:"산재직업병", cat2:"진폐COPD", cat3:"일반", no:"진1",  title:"진폐보상연금의 소멸시효 기산점", desc:"대법원 파기환송심: 진단일(시행령 근거)" },
  { cat1:"산재직업병", cat2:"진폐COPD", cat3:"일반", no:"진2",  title:"진폐 임의검사 판정 업무처리기준" },
  { cat1:"산재직업병", cat2:"진폐COPD", cat3:"일반", no:"진3",  title:"진폐 요양 중 자살 사망 관련" },
  { cat1:"산재직업병", cat2:"진폐COPD", cat3:"일반", no:"진5",  title:"진폐 병형소송 검토 교육자료" },
  { cat1:"산재직업병", cat2:"진폐COPD", cat3:"일반", no:"진7",  title:"전국 진폐 정밀 병원별 의무기록 발급 리스트 관리 엑셀" },
  { cat1:"산재직업병", cat2:"진폐COPD", cat3:"일반", no:"공유8",  title:"진폐법 대상 직종 주장 — 재해위로금 승인 사례" },
  { cat1:"산재직업병", cat2:"진폐COPD", cat3:"일반", no:"공유26", title:"COPD·폐암 추가상병·재요양 처리 질의회시" },
  { cat1:"산재직업병", cat2:"진폐COPD", cat3:"일반", no:"공유33", title:"광해관리공단 재해위로금 설명회 자료" },
  { cat1:"산재직업병", cat2:"진폐COPD", cat3:"일반", no:"공유66", title:"2010.11.21. 진폐지침 개정 관련 노사정 협의회 자료 일체" },
  { cat1:"산재직업병", cat2:"진폐COPD", cat3:"일반", no:"공유69", title:"진폐 보험급여 관련 이규훈 판사님 논문" },
  { cat1:"산재직업병", cat2:"진폐COPD", cat3:"일반", no:"기67",   title:"과거 진폐정밀진단 비용 휴업급여의 법적성질 히스토리" },
  { cat1:"산재직업병", cat2:"진폐COPD", cat3:"일반", no:"copd1",  title:"COPD — 용접 직업력 관련" },
  { cat1:"산재직업병", cat2:"진폐COPD", cat3:"일반", no:"copd3",  title:"섬유 COPD 승인 사례" },
  { cat1:"산재직업병", cat2:"진폐COPD", cat3:"일반", no:"copd6",  title:"만성폐쇄성폐질환 업무처리 개선방안" },
  { cat1:"산재직업병", cat2:"진폐COPD", cat3:"판례", no:"진판1",  title:"진폐유족 — 개인질환(뇌경색·심근경색)" },
  { cat1:"산재직업병", cat2:"진폐COPD", cat3:"판례", no:"진판4",  title:"청구시점 변경 관련 1~3심 정리" },
  { cat1:"산재직업병", cat2:"진폐COPD", cat3:"판례", no:"진판5",  title:"신법 사미장(임의검사) 관련 소멸시효 쟁점" },
  { cat1:"산재직업병", cat2:"진폐COPD", cat3:"판례", no:"진판6",  title:"진폐판례 모음집" },
  { cat1:"산재직업병", cat2:"진폐COPD", cat3:"판례", no:"진판8",  title:"자살 관련 업무상인과관계 — 대법원 판단기준", desc:"정신질환 등으로 자유로운 의사결정 불가 상태에서의 사망 여부 종합 판단" },
  { cat1:"산재직업병", cat2:"진폐COPD", cat3:"판례", no:"진판9",  title:"신법사미장 급수 상향 신뢰도 쟁점 (망 최용석)", desc:"원고패: 19.07.03. 진폐진단 당시 7급 검사 신뢰도 없음" },
  { cat1:"산재직업병", cat2:"진폐COPD", cat3:"판례", no:"진판18", title:"위로금 대상자 여부(직접분진 종사) 입증" },
  { cat1:"산재직업병", cat2:"진폐COPD", cat3:"판례", no:"공유72", title:"재해위로금 G유형 1심 패소 판결" },
  { cat1:"산재직업병", cat2:"진폐COPD", cat3:"판례", no:"공유76", title:"석면폐증의 증상고정과 처리 관련 (대법원 판결문)" },
  { cat1:"산재직업병", cat2:"진폐COPD", cat3:"판례", no:"copd판1",   title:"COPD — 씨미장 관련 쟁점" },
  { cat1:"산재직업병", cat2:"진폐COPD", cat3:"판례", no:"copd판1b",  title:"COPD — 공무상재해 석면폐증", desc:"분진작업 2년 → 석면폐증 → 합병증 COPD" },
  { cat1:"산재직업병", cat2:"진폐COPD", cat3:"판례", no:"copd판1-1", title:"씨미장 증상고정 판단", desc:"실질적 치료 vs 보전적 치료 여부로 증상고정 판단" },
  { cat1:"산재직업병", cat2:"진폐COPD", cat3:"판례", no:"copd판1-3", title:"c미장·시미장·씨미장 관련 쟁점 공유" },
  { cat1:"산재직업병", cat2:"진폐COPD", cat3:"이의제기", no:"진이쇄석기", title:"쇄석기 운전원의 진폐법상 분진작업 해당 여부 — 행정심판 재결서 (인용)" },
  { cat1:"산재직업병", cat2:"진폐COPD", cat3:"이의제기", no:"진이5",    title:"중복지급 불합리 재결 이후 평균임금 산정기준 문제" },
  { cat1:"산재직업병", cat2:"진폐COPD", cat3:"이의제기", no:"진이6",    title:"진폐 병형소송 검토 가이드라인 (수정 중)" },
  { cat1:"산재직업병", cat2:"진폐COPD", cat3:"이의제기", no:"진이8",    title:"진폐유족 업무관련성 판단 (코로나 부지급)" },
  { cat1:"산재직업병", cat2:"진폐COPD", cat3:"이의제기", no:"copd이2",  title:"COPD — 도장·신호수" },

  /* ─── 1. 산재·직업병 일반 > 뇌심혈관계 ─────────── */
  { cat1:"산재직업병", cat2:"뇌심혈관계", cat3:"일반",  no:"뇌4",   title:"대동맥박리의 개념 및 종류" },
  { cat1:"산재직업병", cat2:"뇌심혈관계", cat3:"판례",  no:"기35",  title:"과로 관련 판례 1" },
  { cat1:"산재직업병", cat2:"뇌심혈관계", cat3:"일반",  no:"과로1", title:"업무상과로 — 근로시간 미달 가중요인 고려" },
  { cat1:"산재직업병", cat2:"뇌심혈관계", cat3:"일반",  no:"과로2", title:"업무상과로 — 근로시간 미달 단기과로(업무량)" },

  /* ─── 1. 산재·직업병 일반 > 폐암 ───────────────── */
  { cat1:"산재직업병", cat2:"폐암", cat3:"일반",  no:"폐1",  title:"폐암 & 진폐" },
  { cat1:"산재직업병", cat2:"폐암", cat3:"일반",  no:"폐3",  title:"폐암 장해진단서 발급 시 참고자료" },
  { cat1:"산재직업병", cat2:"폐암", cat3:"일반",  no:"폐5",  title:"직업성 암 입증책임 완화·직환연 생략" },
  { cat1:"산재직업병", cat2:"폐암", cat3:"일반",  no:"폐6",  title:"택시운전자와 폐암", desc:"10년 이상 택시운전자 폐암 유병률 — 도시 매연 기여" },
  { cat1:"산재직업병", cat2:"폐암", cat3:"판례",  no:"폐판1", title:"직업성 암 판례 분석 연구 (2014년)" },
  { cat1:"산재직업병", cat2:"폐암", cat3:"일반",  no:"공유26b",title:"COPD·폐암 추가상병·재요양 처리 질의회시" },
  { cat1:"산재직업병", cat2:"폐암", cat3:"일반",  no:"기23",  title:"유족급여(특히 폐암) & 국민연금 지급 중복 문제", desc:"국민연금공단이 산재유족 청구 시 유족연금 지급 정지" },

  /* ─── 1. 산재·직업병 일반 > 근골격계 ───────────── */
  { cat1:"산재직업병", cat2:"근골격계", cat3:"일반",  no:"근기25",  title:"근골 접수 시 참고" },
  { cat1:"산재직업병", cat2:"근골격계", cat3:"일반",  no:"근기46",  title:"근골격계 이산 교육자료" },
  { cat1:"산재직업병", cat2:"근골격계", cat3:"일반",  no:"근기47",  title:"근골 접수 시 직종 참고 — 건설근로자공제회 직종 확인" },
  { cat1:"산재직업병", cat2:"근골격계", cat3:"일반",  no:"공유24",  title:"근골 평균요양기간 정리" },
  { cat1:"산재직업병", cat2:"근골격계", cat3:"일반",  no:"근골2",   title:"우리나라 최초 무릎관절염 연령별 역학 연구자료" },
  { cat1:"산재직업병", cat2:"근골격계", cat3:"일반",  no:"근골4",   title:"인공관절 진행 프로세스 교안 초안 (이산)" },

  /* ─── 1. 산재·직업병 일반 > 안구 ───────────────── */
  { cat1:"산재직업병", cat2:"안구", cat3:"일반", no:"안1", title:"울산TF·울동TF 안구 진행경과" },
  { cat1:"산재직업병", cat2:"안구", cat3:"일반", no:"안3", title:"특수상병 환자 취업치료 관련 업무처리기준", desc:"눈·코·귀·입·얼굴·비뇨기: 최초 진료계획서 승인기간까지 휴업급여 지급" },

  /* ─── 1. 산재·직업병 일반 > 기타 직업성 암 ─────── */
  { cat1:"산재직업병", cat2:"기타직업성암", cat3:"일반",  no:"기13",  title:"방광암·진폐·유족" },
  { cat1:"산재직업병", cat2:"기타직업성암", cat3:"판례",  no:"기134", title:"디스플레이(OLED) 생산업무와 백혈병 간 상당인과관계 판례 법리" },
  { cat1:"산재직업병", cat2:"기타직업성암", cat3:"판례",  no:"기141", title:"OLED 청소 작업과 유방암 (전리방사선·벤젠 노출) 업무관련성" },

  /* ─── 1. 산재·직업병 일반 > 정신질환 ───────────── */
  { cat1:"산재직업병", cat2:"정신질환", cat3:"일반", no:"공유4",  title:"정신질병 심리상담 지원", desc:"요양승인자 대상 10회 지원(상담8+검사2), 주거지 관할 공단 무방" },

  /* ─── 1. 산재·직업병 일반 > 업무상 사고 ─────────── */
  { cat1:"산재직업병", cat2:"업무상사고", cat3:"일반",  no:"공유30",  title:"법령위반으로 발생한 사고의 업무상 재해 판단기준" },
  { cat1:"산재직업병", cat2:"업무상사고", cat3:"판례",  no:"공유108", title:"대법원 91누10466 — 업무상재해 의의 및 상당인과관계 판단기준" },

  /* ─── 1. 산재·직업병 일반 > 기타(산재) ─────────── */
  { cat1:"산재직업병", cat2:"산재기타", no:"기79",  title:"파킨슨병과 망간과의 관계 (용접 관련 판례법리)" },
  { cat1:"산재직업병", cat2:"산재기타", no:"기80",  title:"파킨슨병과 LED제조공정·반도체 공정 근로자 관계" },
  { cat1:"산재직업병", cat2:"산재기타", no:"기82",  title:"직업적 요인으로써 파킨슨병 정리" },
  { cat1:"산재직업병", cat2:"산재기타", no:"공유75",title:"업무상 질병 상당인과관계 — 입증책임 주체", desc:"결론: 공단 부담 아님, 근로자가 부담" },

  /* ─── 2. 산재 외(특별법) > 공상·보훈 ───────────── */
  { cat1:"산재외", cat2:"공상보훈", cat3:"일반", no:"공재1", title:"위험직무순직공무원 판단기준" },
  { cat1:"산재외", cat2:"공상보훈", cat3:"일반", no:"공재2", title:"순직유족 및 위험직무 순직유족급여 보상" },
  { cat1:"산재외", cat2:"공상보훈", cat3:"일반", no:"공재3", title:"2021년 공무원연금실무" },
  { cat1:"산재외", cat2:"공상보훈", cat3:"일반", no:"공재4", title:"공무상재해+산재 경합시 근로복지공단 전문조사기관 판단", desc:"공무원 직력 기간은 제외하는 것으로 확인" },
  { cat1:"산재외", cat2:"공상보훈", cat3:"일반", no:"공재5", title:"공상 난청 교안" },
  { cat1:"산재외", cat2:"공상보훈", cat3:"일반", no:"공재6", title:"공무상재해와 산재 법령 비교정리" },
  { cat1:"산재외", cat2:"공상보훈", cat3:"일반", no:"기10",  title:"공무상재해 교본" },
  { cat1:"산재외", cat2:"공상보훈", cat3:"일반", no:"보훈1", title:"보훈용어행정집 및 보훈기초자료" },

  /* ─── 2. 산재 외(특별법) > 어선원·선원 ─────────── */
  { cat1:"산재외", cat2:"어선원선원", cat3:"일반", no:"어선3",  title:"산재·어재·선원 재해보상법 3단 비교" },
  { cat1:"산재외", cat2:"어선원선원", cat3:"일반", no:"기31",   title:"선원법 노무사 대리 가능 여부" },
  { cat1:"산재외", cat2:"어선원선원", cat3:"일반", no:"기44",   title:"선원공제조합 청구 관련", desc:"결론: 공제계약자(선주)가 청구" },

  /* ─── 3. 요양 및 휴업급여 > 요양급여 ───────────── */
  { cat1:"요양휴업", cat2:"요양급여", cat3:"일반", no:"기3",    title:"최초+재요양·추가상병의 판단", desc:"공단 측에서도 해석 확립 안 된 사안들이 많음" },
  { cat1:"요양휴업", cat2:"요양급여", cat3:"일반", no:"기16",   title:"중증질환 산정특례제도 질의회시" },
  { cat1:"요양휴업", cat2:"요양급여", cat3:"일반", no:"기40",   title:"합병증 예방관리 변경 관련", desc:"생활근거지사유 변경 시 주치의 소견 생략 가능" },
  { cat1:"요양휴업", cat2:"요양급여", cat3:"일반", no:"기41",   title:"최초 승인 이후 요양관리" },
  { cat1:"요양휴업", cat2:"요양급여", cat3:"일반", no:"기53",   title:"의료사고 산재처리 관련 처리기준" },
  { cat1:"요양휴업", cat2:"요양급여", cat3:"일반", no:"기63",   title:"재판정에 따른 장해등급 유지/변경과 합병증 예방관리 범위 축소" },
  { cat1:"요양휴업", cat2:"요양급여", cat3:"일반", no:"기110",  title:"간병료 지급기준" },
  { cat1:"요양휴업", cat2:"요양급여", cat3:"일반", no:"공유17", title:"보조기 지급 물품 및 청구방법·서식" },
  { cat1:"요양휴업", cat2:"요양급여", cat3:"일반", no:"공유19", title:"울산권역 내 소견서 발급 주의사항" },
  { cat1:"요양휴업", cat2:"요양급여", cat3:"일반", no:"공유23", title:"상병별 산재 요양기간 정리 (추가)" },
  { cat1:"요양휴업", cat2:"요양급여", cat3:"일반", no:"공유35", title:"보청기 산재요양비 청구지급 기준" },
  { cat1:"요양휴업", cat2:"요양급여", cat3:"판례", no:"기88",   title:"추가상병 재요양 판례법리 및 관련 지침 정리" },

  /* ─── 3. 요양 및 휴업급여 > 휴업급여 ───────────── */
  { cat1:"요양휴업", cat2:"휴업급여", cat3:"일반", no:"기17-1", title:"투잡(근로자+사업소득) 근로자 휴업급여 지급제한", desc:"핵심: B사업에 직접 노동 개입 여부에 따라 지급제한 달라짐" },
  { cat1:"요양휴업", cat2:"휴업급여", cat3:"일반", no:"기91",   title:"휴업급여 취업치료 가능여부 판단기준 — 공단 지침" },
  { cat1:"요양휴업", cat2:"휴업급여", cat3:"일반", no:"기123",  title:"재요양시 휴업급여 산정 관련 지침" },

  /* ─── 4. 장해급여 ───────────────────────────────── */
  { cat1:"장해급여", cat3:"일반", no:"기1",    title:"신경기능장해 판단" },
  { cat1:"장해급여", cat3:"일반", no:"기2",    title:"신경장해 판단척도", desc:"장해등급상 애매한 기술 — 검사 해석방법 블로그 참고" },
  { cat1:"장해급여", cat3:"일반", no:"기50",   title:"심장기능 장해등급 인정 기준" },
  { cat1:"장해급여", cat3:"일반", no:"기102",  title:"국소부위 동통 장해등급 인정기준 지침" },
  { cat1:"장해급여", cat3:"일반", no:"공유13", title:"승인 재처분 (장해등급 정정청구)", desc:"승인 제척 놓쳐도 당황 말 것 — 재처분 가능" },
  { cat1:"장해급여", cat3:"일반", no:"공유38", title:"1990년대 장해연금 분기별 지급 관련" },
  { cat1:"장해급여", cat3:"일반", no:"공유54", title:"장해등급 재판정 지침 (2024.5. 개정안)" },
  { cat1:"장해급여", cat3:"일반", no:"공유84", title:"장해등급 결정원칙 (조정·준용·가중)" },
  { cat1:"장해급여", cat3:"일반", no:"공유86", title:"장해급여표 변동연혁" },
  { cat1:"장해급여", cat3:"일반", no:"장결1",  title:"CRPS를 파생장해로 보는지 여부 — 공단 내부 질의회시", desc:"결론: 파생장해 아님 — 조정 원칙 적용" },
  { cat1:"장해급여", cat3:"이의제기", no:"장이1", title:"사고 이후 발목 12급→CRPS 9급→부당이득 결정 사례" },

  /* ─── 5. 유족급여 ───────────────────────────────── */
  { cat1:"유족급여", cat3:"일반", no:"기30",   title:"유족급여 — 회사 보상 초과 수령 시 연금 수급권 박탈 여부", desc:"결론: 박탈 X" },
  { cat1:"유족급여", cat3:"일반", no:"공유34", title:"미지급보험급여 후순위자 인계 관련 ★대외비★", desc:"상속법리에 따라 선순위자 사망 시 후순위자 상속" },
  { cat1:"유족급여", cat3:"일반", no:"공유51", title:"근로자 사망 시 청구인 변경", desc:"별지 제21호서식 청구인 지위승계신청서 제출" },
  { cat1:"유족급여", cat3:"일반", no:"공유55", title:"유족보상연금·일시금 선택 관련", desc:"2004.01.29. 개정 전까지 연금/일시금 선택 가능" },
  { cat1:"유족급여", cat3:"일반", no:"공유56", title:"미지급 보험급여 수급권자 관련" },
  { cat1:"유족급여", cat3:"일반", no:"공유80", title:"촌수 계산방법", desc:"공무상재해 유족순위가 민법 기준 — 촌수 이해 필요" },
  { cat1:"유족급여", cat3:"일반", no:"공유95", title:"유족사건 사무위임계약 시 수급권자 확인" },

  /* ─── 6. 평균임금 ───────────────────────────────── */
  { cat1:"평균임금", cat3:"일반", no:"기18",    title:"일용근로소득 지급명세서", desc:"지급명세서상 비과세소득은 통상임금 해당 X" },
  { cat1:"평균임금", cat3:"일반", no:"기26",    title:"평균임금 관련 쟁점 연혁 정리" },
  { cat1:"평균임금", cat3:"일반", no:"기34",    title:"노임단가 검색용" },
  { cat1:"평균임금", cat3:"일반", no:"기34-2",  title:"건설업 직종별 노임단가 (2010~2024년 매반기)" },
  { cat1:"평균임금", cat3:"일반", no:"기107",   title:"사업자 근무이력의 직업력 산정 관련 공단 내부 해석" },
  { cat1:"평균임금", cat3:"일반", no:"기135",   title:"직업병에 걸린 근로자의 평균임금 산정 관련 업무지침 제2008-39호" },
  { cat1:"평균임금", cat3:"일반", no:"공유42",  title:"재요양 시 장해급여 산정 평균임금 기산점", desc:"결론: 재요양 시점으로부터 기산" },
  { cat1:"평균임금", cat3:"일반", no:"공유67",  title:"동종근로자 임금 산정 시 근속년수 미반영의 경우", desc:"근속년수 반영한 동종으로 재산정 가능" },
  { cat1:"평균임금", cat3:"일반", no:"공유67-1",title:"동종근로자 임금 — 근속년수 미반영 다툼 전략", desc:"공단 담당자 재량 해석에 대해 평균임금 산정자료 정공 필요" },
  { cat1:"평균임금", cat3:"일반", no:"공유79",  title:"2005년 이전 제조업·수산업 하도급 — 원청을 적용사업장으로 지정" },
  { cat1:"평균임금", cat3:"일반", no:"평일7-1", title:"적용사업장 변경 (김봉갑 원고 승소) — 판결문" },
  { cat1:"평균임금", cat3:"일반", no:"평일16",  title:"산재 특례 임금 산정 방법" },
  { cat1:"평균임금", cat3:"일반", no:"평일18",  title:"진폐 관련 보험급여의 평균임금 산정 기준시점" },
  { cat1:"평균임금", cat3:"일반", no:"평일19",  title:"총 경력년수 관련 최초단계 적용 사례" },
  { cat1:"평균임금", cat3:"일반", no:"평일21",  title:"진폐 일용 근로자 통상근로계수 미적용과 근기법 평균임금 규정 배제 여부" },
  { cat1:"평균임금", cat3:"일반", no:"평일22",  title:"2025 건설업 노임단가 — 통상근로계수 적용값, 가동일수 20일 기준 평임" },
  { cat1:"평균임금", cat3:"일반", no:"평일23",  title:"건설일용근로자의 건설노임단가 적용" },
  { cat1:"평균임금", cat3:"일반", no:"평일31-1",title:"건설 일용 근로자 직업병 특례임금 원청기준 규모로 변경 가능 여부" },
  { cat1:"평균임금", cat3:"일반", no:"평일33",  title:"상용직 직권간주대상자의 통상근로계수 주장 논리" },
  { cat1:"평균임금", cat3:"일반", no:"평일34",  title:"직업병 특례 평균임금 업종의 구분기준" },
  { cat1:"평균임금", cat3:"판례", no:"평판1",   title:"적용사업장 변경 관련 판례" },
  { cat1:"평균임금", cat3:"판례", no:"평판2",   title:"청구시점 변경(청평) 1심 패소 판례" },
  { cat1:"평균임금", cat3:"판례", no:"평판3",   title:"청구시점 변경(청평) 대법원 파기환송심 ★대외비★" },
  { cat1:"평균임금", cat3:"판례", no:"평판5",   title:"직업병 이환자 평균임금 — 적용사업장 판단기준", desc:"상당인과관계가 있는 사업장 中 하나를 꼽아야 함 (대법원)" },
  { cat1:"평균임금", cat3:"판례", no:"평판5-1", title:"위 5번 판결의 파기재판" },
  { cat1:"평균임금", cat3:"판례", no:"평판39",  title:"COPD 적사변 — 현중 32년9개월 vs 마지막 사업장 6년6개월" },
  { cat1:"평균임금", cat3:"이의제기", no:"평이1-1", title:"이직확인서의 실임금성 (감사원)" },

  /* ─── 7. 법적용범위 ─────────────────────────────── */
  { cat1:"법적용범위", cat2:"근로자성",   no:"기93",   title:"근기법상 근로자성 판단 (택시운전기사)" },
  { cat1:"법적용범위", cat2:"근로자성",   no:"기121",  title:"근로자성 판단과 관련한 판례 법리" },
  { cat1:"법적용범위", cat2:"근로자성",   no:"공유40",  title:"사업주 명의대여와 근로자성" },
  { cat1:"법적용범위", cat2:"노무제공자", no:"기19",   title:"노무제공자 관련" },
  { cat1:"법적용범위", cat2:"노무제공자", no:"기70-1", title:"노무제공자에 대한 이해 2" },
  { cat1:"법적용범위", cat2:"노무제공자", no:"기125",  title:"노무제공자의 고용보험료·산재보험료 반환거부처분 쟁점" },
  { cat1:"법적용범위", cat2:"노무제공자", no:"노무1",  title:"노무제공자 관련 입법 연혁" },
  { cat1:"법적용범위", cat2:"노무제공자", no:"노무2",  title:"2023.07.01. 이전 화물차주에 대한 공단 지침" },
  { cat1:"법적용범위", cat2:"노무제공자", no:"노무3",  title:"23.07.01. 이전·이후 지침간의 해석" },
  { cat1:"법적용범위", cat2:"노무제공자", no:"노무4",  title:"2023.07.01. 이후 노무제공자 법령 개정 및 실무사항 (영업 문답서 포함)" },
  { cat1:"법적용범위", cat2:"노무제공자", no:"노무6",  title:"노무제공자 교육자료 (24.09.06. 수정안)" },
  { cat1:"법적용범위", cat2:"외국인",     no:"공유50",  title:"귀화 근로자 직력 조회 방법" },
  { cat1:"법적용범위", cat2:"5인미만",    no:"기32",   title:"과거 5인미만 산재적용제외 관련 입증방법" },
  { cat1:"법적용범위", cat2:"고의자해범죄", no:"기124", title:"자해행위(자살)과 '자유로운 의사결정 불가 상태' 판단" },
  { cat1:"법적용범위", cat2:"법적용기타",  no:"기29",  title:"법적용제외 규정의 소급적용 관련", desc:"결론: 소급적용 불가" },
  { cat1:"법적용범위", cat2:"법적용기타",  no:"공유2",  title:"화물운송차주 산재보험 적용 관련" },
  { cat1:"법적용범위", cat2:"법적용기타",  no:"공유3",  title:"파견 근로자에 대한 사용자 책임", desc:"근기법·산재법상 책임은 파견사업주" },

  /* ─── 8. 부당이득·구상권·손해배상·공제·상속 ──────── */
  { cat1:"부당이득", no:"기33-1", title:"다른 보상·배상과의 관계 — 실손보험 관련" },
  { cat1:"부당이득", no:"기72",   title:"부당이득 관련 판례" },
  { cat1:"부당이득", no:"공유28", title:"부당이득징수 관련 판단기준" },
  { cat1:"부당이득", no:"공유27-2",title:"산재법상 요양급여·국민건강보험법상 급여 중복지급·부당이득 관련" },
  { cat1:"부당이득", no:"민사1",  title:"손해배상의 이해 — 민사 손배 기본정리 및 관련 판례" },
  { cat1:"부당이득", no:"민사2",  title:"상속관련" },
  { cat1:"부당이득", no:"민사1b", title:"손배강의안" },

  /* ─── 9. 시효 및 제척기간 ──────────────────────── */
  { cat1:"시효제척", no:"기14",   title:"송무현황 — 망 박숙진 (진폐 위로금 소멸시효·수급권자)" },
  { cat1:"시효제척", no:"기36",   title:"사미장 소멸시효 도과 — 사실상 장애상태 해소" },
  { cat1:"시효제척", no:"기37",   title:"심사·재심사 청구의 소멸시효 중단 효력", desc:"기각·각하는 시효중단 효력 없음 (민법 제170조)" },
  { cat1:"시효제척", no:"기45",   title:"장해연금·위로금 소멸시효 쟁점 (국장님 퀴즈)" },
  { cat1:"시효제척", no:"공유27", title:"재요양 후 장해급여 청구권 소멸시효 행정해석", desc:"재요양 시점 기준으로 잔존장해에 대한 소멸시효 판단" },
  { cat1:"시효제척", no:"공유41", title:"진폐위로금의 소멸시효 기산점", desc:"장해급여·유족급여 지급 결정시부터 기산" },
  { cat1:"시효제척", no:"공유59", title:"대법원 2018두47264 — 사회보장수급권 특수성·소멸시효 기산점" },
  { cat1:"시효제척", no:"공유62", title:"대법원 2015다232316 — 소멸시효 중단과 확인소송", desc:"이행소송 대신 간단한 확인소송으로 시효중단 가능" },
  { cat1:"시효제척", no:"공유65", title:"위로금 소멸시효 기산점 — 진단일 아닌 지급결정시 (대법원)" },
  { cat1:"시효제척", no:"공유68", title:"진폐보상연금의 소멸시효 기산점 관련" },
  { cat1:"시효제척", no:"공유71", title:"보험금 소멸시효 기산점 변경 관련 판례법리" },
  { cat1:"시효제척", no:"공유83", title:"최초청구 없이 소멸시효 도과 시 재요양 성립 여부", desc:"판결: 2020구단52453" },
  { cat1:"시효제척", no:"copd판2", title:"COPD 소멸시효 기산점 — 산재법 시행령 제25조3항 해석" },

  /* ─── 10. 공단자료 > 질의회시 ──────────────────── */
  { cat1:"공단자료", cat2:"질의회시", no:"기24",  title:"공단 질의회시 방법 및 서식", desc:"서식 없음, 자유양식, YES/NO 답변 요청" },
  { cat1:"공단자료", cat2:"질의회시", no:"기107b",title:"사업자 근무이력 직업력 산정 관련 공단 내부 해석" },
  { cat1:"공단자료", cat2:"질의회시", no:"기132", title:"공단통계 이용안내" },
  { cat1:"공단자료", cat2:"질의회시", no:"공유90",title:"업무상질병판정위원회 지역별 승인률" },

  /* ─── 10. 공단자료 > 지침 ──────────────────────── */
  { cat1:"공단자료", cat2:"지침", no:"지침1",  title:"소음성 난청 업무처리기준 개선 전문 (2021.12.23. 시행)", fileUrl:"/docs/소음성_난청_업무처리기준_2021.pdf" },
  { cat1:"공단자료", cat2:"지침", no:"기84",   title:"산재보험료율 (2024 기준)" },
  { cat1:"공단자료", cat2:"지침", no:"기85",   title:"장해등급 심사에 관한 규정 전문 (개정 24.06.11.)" },
  { cat1:"공단자료", cat2:"지침", no:"기103",  title:"공단 2025 부과실무" },
  { cat1:"공단자료", cat2:"지침", no:"기111",  title:"산재 심사업무처리규정" },
  { cat1:"공단자료", cat2:"지침", no:"기117",  title:"공단 내부 교육영상자료 (보상PART)" },
  { cat1:"공단자료", cat2:"지침", no:"기126",  title:"2025 업무상질병 여부에 관한 자문 업무처리요령" },
  { cat1:"공단자료", cat2:"지침", no:"기129",  title:"2025년 요양업무처리규정" },
  { cat1:"공단자료", cat2:"지침", no:"기142",  title:"업무상질병 여부에 관한 자문 업무처리 요령 (2013.04.)" },
  { cat1:"공단자료", cat2:"지침", no:"공유20", title:"2024 산재보상 변동사항 정리" },
  { cat1:"공단자료", cat2:"지침", no:"공유118",title:"건설업 관련 법개정 연혁 및 제도지침" },
  { cat1:"공단자료", cat2:"지침", no:"공유131",title:"2025년도 산재보험심사결정사례집" },

  /* ─── 11. 법인 내부자료 ─────────────────────────── */
  { cat1:"법인내부", no:"공유11",  title:"직력 기간 산정 한셀" },
  { cat1:"법인내부", no:"공유45",  title:"기장노인복지관 어버이날 행사 (영업 참고)" },
  { cat1:"법인내부", no:"공유81",  title:"노무사회-근로복지공단 간담회" },
  { cat1:"법인내부", no:"공유85",  title:"240603 회의록 각주 자료" },
  { cat1:"법인내부", no:"공유97",  title:"2024년 보수교육 교재" },
  { cat1:"법인내부", no:"공유128", title:"접수 교육 자료" },
  { cat1:"법인내부", no:"여수12",  title:"직력 합산 (전남여수 공유)" },

  /* ─── 12. 의학적·자연과학적 근거자료 > 논문 ─────── */
  { cat1:"의학근거", cat2:"논문", no:"공유1",    title:"건설업 직종 설명 및 호흡성 분진 노출량 참고자료" },
  { cat1:"의학근거", cat2:"논문", no:"공유16",   title:"추간판탈출 관련 의학적 정의 및 영향요인" },
  { cat1:"의학근거", cat2:"논문", no:"공유123b", title:"고정 야간근무·교대근무가 건강에 미치는 영향" },
  { cat1:"의학근거", cat2:"논문", no:"난일26",   title:"좌측 귀 청력이 소음에 더 민감하다는 연구논문" },
  { cat1:"의학근거", cat2:"논문", no:"난일31",   title:"소음강도와 시간과의 상관관계 — 3dB rule" },
  { cat1:"의학근거", cat2:"논문", no:"근골2",    title:"우리나라 최초 무릎관절염 연령별 역학 연구자료" },

  /* ─── 12. 의학적·자연과학적 근거자료 > 진료기록감정 */
  { cat1:"의학근거", cat2:"진료기록감정", no:"감정3",  title:"85dB 미달 장기간 소음노출" },
  { cat1:"의학근거", cat2:"진료기록감정", no:"감정5",  title:"간헐적 소음이 청력소실 유발 어렵다는 감정 — 소음노출 공백은 고려사항 아님" },
  { cat1:"의학근거", cat2:"진료기록감정", no:"감정6",  title:"삼출성 중이염에 따른 감각신경성 난청" },
  { cat1:"의학근거", cat2:"진료기록감정", no:"근골감1",title:"29년 철도청소 노동자(여성) 무릎관절염 업무관련성 판단 (윤선자)" },
  { cat1:"의학근거", cat2:"진료기록감정", no:"근골감15",title:"업무부담작업 부인과 관련된 진료기록 감정 (박경자)" },

  /* ─── 12. 의학적·자연과학적 근거자료 > 작업환경측정 */
  { cat1:"의학근거", cat2:"작업환경측정", no:"공유84b",  title:"진체 직종별 소음 노출 수준 정리_240202", desc:"난청" },
  { cat1:"의학근거", cat2:"작업환경측정", no:"난일16",   title:"현대삼호중공업 크레인운전 작업환경측정결과표 2010~2020", desc:"난청" },
  { cat1:"의학근거", cat2:"작업환경측정", no:"난일24",   title:"건설업 근로자 직종별 건강진단 방안연구", desc:"난청" },
  { cat1:"의학근거", cat2:"작업환경측정", no:"난일27",   title:"건설업 직종별 소음노출수준 판단요령", desc:"난청" },
  { cat1:"의학근거", cat2:"작업환경측정", no:"난일33",   title:"경기도 소재 공립학교 조리실 소음수준", desc:"난청" },

  /* ─── 12. 의학적·자연과학적 근거자료 > 기타 ─────── */
  { cat1:"의학근거", cat2:"의학기타", no:"기5",  title:"의학용어 정리" },
  { cat1:"의학근거", cat2:"의학기타", no:"기7",  title:"의학용어 (추가)" },

  /* ─── 13. 기타 ──────────────────────────────────── */
  { cat1:"기타", no:"공유5",   title:"기초생활수급자 관련 사항" },
  { cat1:"기타", no:"공유31",  title:"산업재해발생현황" },
  { cat1:"기타", no:"공유32",  title:"산업안전보건연구원 GPT" },
  { cat1:"기타", no:"공유36",  title:"중대재해처벌법 관련 기초 이해자료 및 판결" },
  { cat1:"기타", no:"공유40b", title:"중대재해 감축 로드맵" },
  { cat1:"기타", no:"공유44",  title:"2024 고용장려금 지원제도 정리" },
  { cat1:"기타", no:"공유70",  title:"보험금 청구와 관련된 부검의 중요성" },
  { cat1:"기타", no:"공유77",  title:"소송진행경과별 소송용어" },
  { cat1:"기타", no:"공유94",  title:"공공데이터 포털 사용 방법" },
  { cat1:"기타", no:"공유102", title:"자동차보험 개선 보도자료" },
  { cat1:"기타", no:"공유119", title:"251226 개정 노동조합법 해석지침안 행정예고" },
  { cat1:"기타", no:"공유121", title:"2024년 산업재해현황분석 (고용노동부)" },
  { cat1:"기타", no:"공유122", title:"2025년 3분기(누적) 산업재해현황 (고용노동부)" },
  { cat1:"기타", no:"공유123", title:"2026년 고용노동부 업무보고" },
  { cat1:"기타", no:"기57",    title:"안전보건관리체계구축 관련 자료" },
  { cat1:"기타", no:"기60",    title:"반려의 성질 판결" },
  { cat1:"기타", no:"기133",   title:"공동근로복지기금 실무 매뉴얼" },
  { cat1:"기타", no:"석폐1",   title:"석면폐증 업무처리지침" },
];

/* ═══════════════════════════════════════════════════════
   트리 헬퍼
═══════════════════════════════════════════════════════ */
type SelState = { cat1?: string; cat2?: string; cat3?: string };

/** 데이터에서 cat1 안의 cat2 목록 동적 추출 */
function getCat2List(cat1: string) {
  return CAT2_MAP[cat1] ?? [];
}

/** 특정 범위 안에서 cat3 존재 여부 */
function getAvailableCat3(cat1: string, cat2?: string): string[] {
  const scope = DATA.filter(d => d.cat1 === cat1 && (!cat2 || d.cat2 === cat2));
  return ["일반", "이의제기", "판례"].filter(t => scope.some(d => d.cat3 === t));
}

/** 항목 수 */
function cnt(cat1?: string, cat2?: string, cat3?: string) {
  return DATA.filter(d =>
    (!cat1 || d.cat1 === cat1) &&
    (!cat2 || d.cat2 === cat2) &&
    (!cat3 || d.cat3 === cat3)
  ).length;
}

const CAT3_COLOR: Record<string, { bg: string; color: string }> = {
  "일반":     { bg: "#f0fdf4", color: "#059669" },
  "이의제기": { bg: "#fef3c7", color: "#d97706" },
  "판례":     { bg: "#ede9fe", color: "#7c3aed" },
};

/* ═══════════════════════════════════════════════════════
   컴포넌트
═══════════════════════════════════════════════════════ */
export default function InfoBoardSection() {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [sel, setSel] = useState<SelState>({});
  const [query, setQuery] = useState("");
  const [openCard, setOpenCard] = useState<number | null>(null);
  const [pdfModal, setPdfModal] = useState<{ url: string; title: string } | null>(null);
  const [copied, setCopied] = useState<number | null>(null);

  function copyText(text: string, idx: number) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(idx);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  /* ── 트리 상태 조작 ── */
  function toggleNode(id: string) {
    setExpanded(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  function selectNode(s: SelState, expandId?: string) {
    setSel(s);
    if (expandId) {
      setExpanded(prev => {
        const n = new Set(prev);
        // 부모 노드도 자동 열기
        expandId.split("::").reduce((acc, part) => {
          const id = acc ? `${acc}::${part}` : part;
          n.add(id);
          return id;
        }, "");
        return n;
      });
    }
  }

  function resetAll() {
    setSel({});
    setQuery("");
  }

  /* ── 필터링 ── */
  const filtered = useMemo(() => {
    return DATA.filter(item => {
      if (sel.cat1 && item.cat1 !== sel.cat1) return false;
      if (sel.cat2 && item.cat2 !== sel.cat2) return false;
      if (sel.cat3 && item.cat3 !== sel.cat3) return false;
      const q = query.trim().toLowerCase();
      if (q && !item.title.toLowerCase().includes(q) && !(item.desc?.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [sel, query]);

  /* ── 현재 선택 브레드크럼 ── */
  const breadcrumb = useMemo(() => {
    const parts: string[] = [];
    if (sel.cat1) parts.push(CAT1_LIST.find(c => c.key === sel.cat1)?.label.replace(/^\d+\.\s*/, "") ?? sel.cat1);
    if (sel.cat2) parts.push(getCat2List(sel.cat1!).find(c => c.key === sel.cat2)?.label ?? sel.cat2);
    if (sel.cat3) parts.push(sel.cat3);
    return parts;
  }, [sel]);

  /* ── 트리 노드 렌더 함수 ── */
  function isActive(s: SelState) {
    return sel.cat1 === s.cat1 && sel.cat2 === s.cat2 && sel.cat3 === s.cat3;
  }

  function NodeBtn({
    label, nodeId, selState, depth, hasChildren, count: c,
  }: { label: string; nodeId: string; selState: SelState; depth: number; hasChildren: boolean; count: number }) {
    const open = expanded.has(nodeId);
    const active = isActive(selState);
    const ancestorActive = !!(
      (selState.cat1 && sel.cat1 === selState.cat1) &&
      (!selState.cat2 || sel.cat2 === selState.cat2) &&
      (!selState.cat3 || sel.cat3 === selState.cat3)
    );

    return (
      <div
        style={{
          display: "flex", alignItems: "center", gap: 0,
          paddingLeft: depth * 14 + 8,
          background: active ? "#dbeafe" : "transparent",
          borderRadius: 4, marginBottom: 1,
        }}
      >
        {/* 펼침 화살표 */}
        <button
          onClick={() => {
            if (hasChildren) toggleNode(nodeId);
            selectNode(selState);
          }}
          style={{
            display: "flex", alignItems: "center", gap: 4,
            flex: 1, padding: "5px 6px 5px 0",
            background: "none", border: "none", cursor: "pointer",
            textAlign: "left",
          }}
        >
          <span style={{
            width: 14, fontSize: 9, color: hasChildren ? "#9ca3af" : "transparent",
            flexShrink: 0, textAlign: "center",
          }}>
            {hasChildren ? (open ? "▼" : "▶") : ""}
          </span>
          <span style={{
            fontSize: 12, lineHeight: 1.4,
            fontWeight: active ? 700 : ancestorActive ? 600 : 400,
            color: active ? "#1e40af" : ancestorActive ? "#1e3a8a" : "#374151",
          }}>
            {label}
          </span>
          <span style={{
            marginLeft: "auto", fontSize: 10,
            color: active ? "#3b82f6" : "#9ca3af",
            flexShrink: 0, paddingLeft: 6,
          }}>
            {c}
          </span>
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", height: "calc(100vh - 170px)", minHeight: 500, overflow: "hidden" }}>

      {/* PDF 모달 */}
      {pdfModal && (
        <PdfViewerModal
          fileUrl={pdfModal.url}
          title={pdfModal.title}
          onClose={() => setPdfModal(null)}
        />
      )}

      {/* ══════════════ 왼쪽 트리 패널 ══════════════ */}
      <div style={{
        width: 230, flexShrink: 0,
        overflowY: "auto", borderRight: "1px solid #e5e7eb",
        background: "#fafafa", display: "flex", flexDirection: "column",
      }}>
        {/* 검색 */}
        <div style={{ padding: "12px 10px 8px", borderBottom: "1px solid #f3f4f6" }}>
          <input
            type="text"
            placeholder="검색..."
            value={query}
            onChange={e => { setQuery(e.target.value); setSel({}); }}
            style={{
              width: "100%", boxSizing: "border-box",
              padding: "6px 10px", fontSize: 12,
              border: "1px solid #d1d5db", borderRadius: 6,
              color: "#111827", outline: "none", background: "#fff",
            }}
          />
        </div>

        {/* 전체 보기 */}
        <div style={{ padding: "4px 8px" }}>
          <NodeBtn
            label="전체" nodeId="__all__"
            selState={{}} depth={0} hasChildren={false}
            count={DATA.length}
          />
        </div>

        <div style={{ flex: 1, padding: "0 8px 12px", overflowY: "auto" }}>
          {CAT1_LIST.map(c1 => {
            const c2List = getCat2List(c1.key);
            const directCat3 = getAvailableCat3(c1.key);          // cat2 없는 직속 cat3
            const hasCat2    = c2List.length > 0;
            const hasDirect3 = !hasCat2 && directCat3.length > 0;
            const hasChildren = hasCat2 || hasDirect3;
            const open1 = expanded.has(c1.key);

            return (
              <div key={c1.key}>
                <NodeBtn
                  label={c1.label} nodeId={c1.key}
                  selState={{ cat1: c1.key }} depth={0}
                  hasChildren={hasChildren} count={cnt(c1.key)}
                />

                {open1 && (
                  <>
                    {/* 2단계: cat2 목록 */}
                    {hasCat2 && c2List.map(c2 => {
                      const cat3s = getAvailableCat3(c1.key, c2.key);
                      const has3  = cat3s.length > 0;
                      const nodeId2 = `${c1.key}::${c2.key}`;
                      const open2  = expanded.has(nodeId2);

                      return (
                        <div key={c2.key}>
                          <NodeBtn
                            label={c2.label} nodeId={nodeId2}
                            selState={{ cat1: c1.key, cat2: c2.key }}
                            depth={1} hasChildren={has3}
                            count={cnt(c1.key, c2.key)}
                          />
                          {open2 && has3 && cat3s.map(t => (
                            <NodeBtn
                              key={t} label={t}
                              nodeId={`${nodeId2}::${t}`}
                              selState={{ cat1: c1.key, cat2: c2.key, cat3: t }}
                              depth={2} hasChildren={false}
                              count={cnt(c1.key, c2.key, t)}
                            />
                          ))}
                        </div>
                      );
                    })}

                    {/* 2단계 없고 직속 cat3 있는 경우 */}
                    {hasDirect3 && directCat3.map(t => (
                      <NodeBtn
                        key={t} label={t}
                        nodeId={`${c1.key}::${t}`}
                        selState={{ cat1: c1.key, cat3: t }}
                        depth={1} hasChildren={false}
                        count={cnt(c1.key, undefined, t)}
                      />
                    ))}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ══════════════ 오른쪽 컨텐츠 패널 ══════════════ */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", minWidth: 0 }}>

        {/* 브레드크럼 + 카운트 */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13, flexWrap: "wrap" }}>
            <span
              style={{ color: "#6b7280", cursor: "pointer", textDecoration: breadcrumb.length === 0 ? "none" : "underline" }}
              onClick={resetAll}
            >
              전체
            </span>
            {breadcrumb.map((b, i) => (
              <span key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ color: "#d1d5db" }}>›</span>
                <span style={{ color: i === breadcrumb.length - 1 ? "#111827" : "#6b7280", fontWeight: i === breadcrumb.length - 1 ? 600 : 400 }}>
                  {b}
                </span>
              </span>
            ))}
          </div>
          <span style={{ fontSize: 12, color: "#9ca3af" }}>
            {filtered.length}건
            {(sel.cat1 || query) && (
              <button
                onClick={resetAll}
                style={{ marginLeft: 8, fontSize: 11, color: "#9ca3af", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
              >
                초기화
              </button>
            )}
          </span>
        </div>

        {/* 목록 */}
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {filtered.length === 0 && (
            <div style={{ textAlign: "center", padding: 48, color: "#9ca3af", fontSize: 14 }}>
              검색 결과가 없습니다.
            </div>
          )}
          {filtered.map((item, idx) => {
            const cat1Label = CAT1_LIST.find(c => c.key === item.cat1)?.label.replace(/^\d+\.\s*/, "") ?? item.cat1;
            const cat2Label = item.cat2 ? (getCat2List(item.cat1).find(c => c.key === item.cat2)?.label ?? item.cat2) : null;
            const cat3Style = item.cat3 ? (CAT3_COLOR[item.cat3] ?? { bg: "#f3f4f6", color: "#4b5563" }) : null;
            const isOpen = openCard === idx;
            return (
              <div key={idx} style={{
                background: "#fff",
                border: `1px solid ${isOpen ? "#93c5fd" : "#e5e7eb"}`,
                borderRadius: 8, overflow: "hidden",
                transition: "border-color 0.15s",
              }}>
                {/* 헤더 (클릭 토글) */}
                <div
                  onClick={() => setOpenCard(isOpen ? null : idx)}
                  style={{
                    padding: "10px 14px", cursor: "pointer",
                    display: "flex", alignItems: "flex-start", gap: 10,
                    background: isOpen ? "#eff6ff" : "#fff",
                    transition: "background 0.15s",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#111827", lineHeight: 1.5 }}>
                      {item.title}
                    </div>
                    {item.desc && !isOpen && (
                      <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2, lineHeight: 1.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {item.desc}
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3 }}>
                      {!sel.cat1 && (
                        <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 6, background: "#dbeafe", color: "#1e40af", fontWeight: 600, whiteSpace: "nowrap" }}>
                          {cat1Label}
                        </span>
                      )}
                      {!sel.cat2 && cat2Label && (
                        <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 6, background: "#f3f4f6", color: "#4b5563", whiteSpace: "nowrap" }}>
                          {cat2Label}
                        </span>
                      )}
                      {!sel.cat3 && cat3Style && item.cat3 && (
                        <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 6, whiteSpace: "nowrap", background: cat3Style.bg, color: cat3Style.color }}>
                          {item.cat3}
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: 10, color: "#9ca3af", transition: "transform 0.2s", display: "inline-block", transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}>
                      ▼
                    </span>
                  </div>
                </div>

                {/* 펼쳐진 내용 */}
                {isOpen && (
                  <div style={{
                    padding: "12px 14px 14px",
                    borderTop: "1px solid #e0f2fe",
                    background: "#f8faff",
                    display: "flex", flexDirection: "column", gap: 10,
                  }}>
                    {/* 액션 버튼 */}
                    <div style={{ display: "flex", gap: 8 }}>
                      {item.fileUrl && (
                        <button
                          onClick={() => setPdfModal({ url: item.fileUrl!, title: item.title })}
                          style={{
                            display: "flex", alignItems: "center", gap: 5,
                            padding: "6px 12px", borderRadius: 6, border: "1px solid #93c5fd",
                            background: "#eff6ff", color: "#1d4ed8",
                            cursor: "pointer", fontSize: 12, fontWeight: 600,
                          }}
                        >
                          📄 PDF 뷰어
                        </button>
                      )}
                      {item.content && (
                        <button
                          onClick={() => copyText(item.content!, idx)}
                          style={{
                            display: "flex", alignItems: "center", gap: 5,
                            padding: "6px 12px", borderRadius: 6,
                            border: copied === idx ? "1px solid #86efac" : "1px solid #d1d5db",
                            background: copied === idx ? "#f0fdf4" : "#fff",
                            color: copied === idx ? "#15803d" : "#374151",
                            cursor: "pointer", fontSize: 12, fontWeight: 600,
                            transition: "all 0.2s",
                          }}
                        >
                          {copied === idx ? "✓ 복사됨" : "📋 핵심내용 복사"}
                        </button>
                      )}
                    </div>

                    {/* desc */}
                    {item.desc && (
                      <p style={{ margin: 0, fontSize: 13, color: "#374151", lineHeight: 1.75, whiteSpace: "pre-wrap" }}>
                        {item.desc}
                      </p>
                    )}

                    {/* 핵심 발췌 텍스트 */}
                    {item.content && (
                      <div style={{
                        background: "#fff", border: "1px solid #e5e7eb", borderRadius: 6,
                        padding: "10px 12px", fontSize: 12, color: "#374151",
                        lineHeight: 1.8, whiteSpace: "pre-wrap",
                        maxHeight: 200, overflowY: "auto",
                        fontFamily: "monospace",
                      }}>
                        {item.content}
                      </div>
                    )}

                    {/* 아무것도 없을 때 */}
                    {!item.desc && !item.content && !item.fileUrl && (
                      <p style={{ margin: 0, fontSize: 12, color: "#9ca3af", fontStyle: "italic" }}>
                        자료 내용이 아직 등록되지 않았습니다.
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
