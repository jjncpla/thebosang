"use client";

import { useState, useMemo } from "react";

/* ─────────────────────────────────────────────
   타입 & 데이터
───────────────────────────────────────────── */
interface InfoEntry {
  no: string;
  title: string;
  desc?: string;
  cat: string;
  sub?: string;
}

const CAT_META: Record<string, { label: string; color: string; bg: string; emoji: string }> = {
  "공유":      { label: "공유",        color: "#0369a1", bg: "#e0f2fe", emoji: "📤" },
  "기획외":    { label: "기획사건(외)",  color: "#5b21b6", bg: "#ede9fe", emoji: "🏗" },
  "난청":      { label: "소음성 난청",   color: "#b45309", bg: "#fef3c7", emoji: "👂" },
  "평균임금":  { label: "평균임금",      color: "#047857", bg: "#d1fae5", emoji: "💰" },
  "진폐":      { label: "진폐",         color: "#b91c1c", bg: "#fee2e2", emoji: "🫁" },
  "COPD":      { label: "COPD",         color: "#6d28d9", bg: "#f3e8ff", emoji: "💨" },
  "공무상재해": { label: "공무상재해",   color: "#0c4a6e", bg: "#dbeafe", emoji: "🏛" },
  "노무제공자": { label: "노무제공자",   color: "#92400e", bg: "#fef9c3", emoji: "🚗" },
  "폐암":      { label: "폐암",         color: "#9d174d", bg: "#fce7f3", emoji: "🔬" },
  "기타":      { label: "기타",         color: "#374151", bg: "#f3f4f6", emoji: "📁" },
};

// 서브카테고리 라벨
const SUB_LABEL: Record<string, string> = {
  "이의제기": "이의제기",
  "판례":     "판례",
  "일반":     "일반",
  "감정":     "감정",
};

const DATA: InfoEntry[] = [
  /* ══════════════════════ 공유 ══════════════════════ */
  { cat:"공유", no:"1",   title:"건설업 직종 설명", desc:"건설 직종 설명 및 호흡성 분진 노출량 참고자료" },
  { cat:"공유", no:"2",   title:"화물운송차주 산재보험 적용 관련" },
  { cat:"공유", no:"3",   title:"파견 근로자에 대한 사용자 책임", desc:"파견사업주 vs 사용사업주 — 근기법·산재법상 책임은 파견사업주" },
  { cat:"공유", no:"4",   title:"정신질병 심리상담 지원", desc:"요양승인자 대상 심리상담 10회 지원(상담8+검사2), 주거지 관할 공단 무방" },
  { cat:"공유", no:"5",   title:"기초생활수급자 관련 사항" },
  { cat:"공유", no:"8",   title:"진폐법 대상 관련 직종 주장 — 재해위로금 승인 사례" },
  { cat:"공유", no:"11",  title:"직력 기간 산정 한셀" },
  { cat:"공유", no:"13",  title:"승인 재처분 (장해등급 정정청구)", desc:"승인 제척 놓쳐도 당황 말 것 — 재처분 가능" },
  { cat:"공유", no:"16",  title:"추간판탈출 관련 의학적 정의 및 영향요인" },
  { cat:"공유", no:"17",  title:"보조기 지급 물품 및 청구방법·서식" },
  { cat:"공유", no:"19",  title:"울산권역 내 소견서 발급 주의사항" },
  { cat:"공유", no:"20",  title:"2024 산재보상 변동사항 정리" },
  { cat:"공유", no:"23",  title:"상병별 산재 요양기간 정리 (추가)", desc:"데이터마이닝 기법 활용 상병별 산재요양 실태분석 부록3" },
  { cat:"공유", no:"24",  title:"근골 평균요양기간 정리" },
  { cat:"공유", no:"26",  title:"COPD·폐암 추가상병·재요양 처리 질의회시" },
  { cat:"공유", no:"27",  title:"재요양 후 장해급여 청구권 소멸시효 행정해석", desc:"재요양 시점 기준으로 잔존장해에 대한 소멸시효 판단" },
  { cat:"공유", no:"27-2",title:"산재법상 요양급여·국민건강보험법상 급여 중복지급·부당이득 관련" },
  { cat:"공유", no:"28",  title:"부당이득징수 관련 판단기준" },
  { cat:"공유", no:"30",  title:"법령위반으로 발생한 사고의 업무상 재해 판단기준" },
  { cat:"공유", no:"31",  title:"산업재해발생현황" },
  { cat:"공유", no:"32",  title:"산업안전보건연구원 GPT" },
  { cat:"공유", no:"33",  title:"광해관리공단 재해위로금 설명회 자료" },
  { cat:"공유", no:"34",  title:"미지급보험급여 후순위자 인계 관련 ★대외비★", desc:"상속법리에 따라 선순위자 사망 시 후순위자 상속" },
  { cat:"공유", no:"35",  title:"보청기 산재요양비 청구지급 기준" },
  { cat:"공유", no:"36",  title:"중대재해처벌법 관련 기초 이해자료 및 판결" },
  { cat:"공유", no:"38",  title:"1990년대 장해연금 분기별 지급 관련" },
  { cat:"공유", no:"40",  title:"사업주 명의대여와 근로자성" },
  { cat:"공유", no:"40b", title:"중대재해 감축 로드맵" },
  { cat:"공유", no:"41",  title:"진폐위로금의 소멸시효 기산점", desc:"장해급여·유족급여 지급 결정시부터 기산" },
  { cat:"공유", no:"42",  title:"재요양 시 장해급여 산정 평균임금 기산점", desc:"결론: 재요양 시점으로부터 기산" },
  { cat:"공유", no:"44",  title:"2024 고용장려금 지원제도 정리" },
  { cat:"공유", no:"45",  title:"기장노인복지관 어버이날 행사 (영업 참고)" },
  { cat:"공유", no:"50",  title:"귀화 근로자 직력 조회 방법" },
  { cat:"공유", no:"51",  title:"심사·재심사·행정심판 — 근로자 사망 시 청구인 변경", desc:"별지 제21호서식 청구인 지위승계신청서 제출" },
  { cat:"공유", no:"54",  title:"장해등급 재판정 지침 (2024.5. 개정안)" },
  { cat:"공유", no:"55",  title:"유족보상연금·일시금 선택 관련", desc:"2004.01.29. 개정 전까지 연금/일시금 선택 가능" },
  { cat:"공유", no:"56",  title:"미지급 보험급여 수급권자 관련" },
  { cat:"공유", no:"59",  title:"대법원 2018두47264 — 사회보장수급권 특수성·소멸시효 기산점", desc:"소멸시효·제척기간 구분, 신청권·청구권 차이 자세히 설명" },
  { cat:"공유", no:"62",  title:"대법원 2015다232316 — 소멸시효 중단과 확인소송", desc:"금전채권 10년 시효 중단 위해 이행소송 대신 확인소송 가능" },
  { cat:"공유", no:"65",  title:"위로금 소멸시효 기산점 — 진단일 아닌 지급결정시 (대법원 판례)" },
  { cat:"공유", no:"66",  title:"2010.11.21. 진폐지침 개정 관련 노사정 협의회 자료 일체" },
  { cat:"공유", no:"67",  title:"동종근로자 임금 산정 시 근속년수 미반영의 경우", desc:"근속년수 반영한 동종으로 재산정 가능" },
  { cat:"공유", no:"67-1",title:"동종근로자 임금 — 근속년수 미반영 다툼 전략", desc:"공단 담당자 재량적 해석에 대해 평균임금 산정자료 정공 필요" },
  { cat:"공유", no:"68",  title:"진폐보상연금의 소멸시효 기산점 관련" },
  { cat:"공유", no:"69",  title:"진폐 보험급여 관련 이규훈 판사님 논문" },
  { cat:"공유", no:"70",  title:"보험금 청구와 관련된 부검의 중요성" },
  { cat:"공유", no:"71",  title:"보험금 소멸시효 기산점 변경 관련 판례법리" },
  { cat:"공유", no:"72",  title:"재해위로금 G유형 1심 패소 판결" },
  { cat:"공유", no:"75",  title:"업무상 질병 상당인과관계 — 입증책임 주체", desc:"결론: 공단 부담 아님, 근로자가 부담" },
  { cat:"공유", no:"76",  title:"석면폐증의 증상고정과 처리 관련 (대법원 판결문)" },
  { cat:"공유", no:"77",  title:"소송진행경과별 소송용어" },
  { cat:"공유", no:"79",  title:"2005년 이전 제조업·수산업 하도급 — 원청을 적용사업장으로 지정" },
  { cat:"공유", no:"80",  title:"촌수 계산방법", desc:"공무상재해 유족순위가 민법을 따르므로 촌수 이해 필요" },
  { cat:"공유", no:"81",  title:"노무사회-근로복지공단 간담회" },
  { cat:"공유", no:"83",  title:"최초청구 없이 소멸시효 도과 시 재요양 성립 여부", desc:"판결: 2020구단52453" },
  { cat:"공유", no:"84",  title:"장해등급 결정원칙 (조정·준용·가중)" },
  { cat:"공유", no:"84b", title:"진체 직종별 소음 노출 수준 정리_240202" },
  { cat:"공유", no:"85",  title:"240603 회의록 각주 자료" },
  { cat:"공유", no:"86",  title:"장해급여표 변동연혁" },
  { cat:"공유", no:"90",  title:"업무상질병판정위원회 지역별 승인률" },
  { cat:"공유", no:"94",  title:"공공데이터 포털 사용 방법" },
  { cat:"공유", no:"95",  title:"유족사건 사무위임계약 시 수급권자 확인" },
  { cat:"공유", no:"97",  title:"2024년 보수교육 교재" },
  { cat:"공유", no:"102", title:"자동차보험 개선 보도자료" },
  { cat:"공유", no:"108", title:"대법원 91누10466 — 업무상재해 의의 및 상당인과관계 판단기준" },
  { cat:"공유", no:"118", title:"건설업 관련 법개정 연혁 및 제도지침" },
  { cat:"공유", no:"119", title:"251226 개정 노동조합법 해석지침안 행정예고" },
  { cat:"공유", no:"121", title:"2024년 산업재해현황분석 (고용노동부)" },
  { cat:"공유", no:"122", title:"2025년 3분기(누적) 산업재해현황 (고용노동부)" },
  { cat:"공유", no:"123", title:"2026년 고용노동부 업무보고" },
  { cat:"공유", no:"123b",title:"고정 야간근무·교대근무가 건강에 미치는 영향" },
  { cat:"공유", no:"128", title:"접수 교육 자료" },
  { cat:"공유", no:"131", title:"2025년도 산재보험심사결정사례집" },

  /* ══════════════════════ 기획사건(외) ══════════════════════ */
  { cat:"기획외", no:"1",    title:"신경기능장해 판단" },
  { cat:"기획외", no:"2",    title:"신경장해 판단척도", desc:"장해등급상 장해정도 기술이 애매할 때 활용 — 블로그 참고" },
  { cat:"기획외", no:"3",    title:"최초+재요양, 추가상병의 판단", desc:"공단 측에서도 해석이 확립되지 않은 사안들이 많음" },
  { cat:"기획외", no:"4",    title:"대동맥박리의 개념 및 종류" },
  { cat:"기획외", no:"5",    title:"의학용어 정리" },
  { cat:"기획외", no:"7",    title:"의학용어 (추가)" },
  { cat:"기획외", no:"10",   title:"공무상재해 교본" },
  { cat:"기획외", no:"13",   title:"방광암·진폐·유족" },
  { cat:"기획외", no:"14",   title:"송무현황 — 망 박숙진 (진폐 위로금 소멸시효·수급권자)" },
  { cat:"기획외", no:"16",   title:"중증질환 산정특례제도 질의회시" },
  { cat:"기획외", no:"17-1", title:"투잡(근로자+사업소득) 근로자 휴업급여 지급제한", desc:"핵심: B사업에 근로자가 직접 노동 개입 여부에 따라 지급제한 달라짐" },
  { cat:"기획외", no:"18",   title:"일용근로소득 지급명세서", desc:"지급명세서상 비과세소득은 통상임금 해당 X" },
  { cat:"기획외", no:"19",   title:"노무제공자 관련" },
  { cat:"기획외", no:"23",   title:"유족급여(특히 폐암) & 국민연금 지급 중복 문제", desc:"국민연금공단이 산재유족 청구와 동시에 국민연금 유족연금 지급 정지" },
  { cat:"기획외", no:"24",   title:"공단 질의회시 방법 및 서식", desc:"서식 없음 — 자유양식, 질의 구체적으로·YES/NO 회시 요청" },
  { cat:"기획외", no:"25",   title:"근골 접수 시 참고" },
  { cat:"기획외", no:"26",   title:"평균임금 관련 쟁점 연혁 정리" },
  { cat:"기획외", no:"29",   title:"법적용제외 규정의 소급적용 관련", desc:"결론: 소급적용 불가" },
  { cat:"기획외", no:"30",   title:"유족급여 관련 — 회사 보상 초과 수령 시 연금 수급권 박탈 여부", desc:"결론: 박탈 X" },
  { cat:"기획외", no:"31",   title:"선원법 노무사 대리 가능 여부" },
  { cat:"기획외", no:"32",   title:"과거 5인미만 산재적용제외 관련 입증방법" },
  { cat:"기획외", no:"33-1", title:"다른 보상·배상과의 관계 — 실손보험 관련" },
  { cat:"기획외", no:"34",   title:"노임단가 검색용" },
  { cat:"기획외", no:"34-2", title:"건설업 직종별 노임단가 (2010~2024년 매반기)" },
  { cat:"기획외", no:"35",   title:"과로 관련 판례1" },
  { cat:"기획외", no:"36",   title:"사미장 소멸시효 도과 — 사실상 장애상태 해소" },
  { cat:"기획외", no:"37",   title:"심사·재심사 청구의 소멸시효 중단 효력", desc:"기각·각하는 시효중단 효력 없음 (민법 제170조)" },
  { cat:"기획외", no:"40",   title:"합병증 예방관리 변경 관련", desc:"생활근거지사유 변경 시 주치의 소견 생략 가능" },
  { cat:"기획외", no:"41",   title:"최초 승인 이후 요양관리" },
  { cat:"기획외", no:"44",   title:"선원공제조합 청구 관련", desc:"결론: 공제계약자(선주)가 청구" },
  { cat:"기획외", no:"45",   title:"장해연금·위로금 소멸시효 쟁점 (국장님 퀴즈)" },
  { cat:"기획외", no:"46",   title:"근골격계 이산 교육자료" },
  { cat:"기획외", no:"47",   title:"근골 접수 시 직종 참고 — 건설근로자공제회 직종 확인" },
  { cat:"기획외", no:"50",   title:"심장기능 장해등급 인정 기준" },
  { cat:"기획외", no:"53",   title:"의료사고 산재처리 관련 처리기준" },
  { cat:"기획외", no:"57",   title:"안전보건관리체계구축 관련 자료" },
  { cat:"기획외", no:"60",   title:"반려의 성질 판결" },
  { cat:"기획외", no:"63",   title:"재판정에 따른 장해등급 유지/변경과 합병증 예방관리 범위 축소" },
  { cat:"기획외", no:"67",   title:"과거 진폐정밀진단 비용 휴업급여의 법적성질 히스토리" },
  { cat:"기획외", no:"70-1", title:"노무제공자에 대한 이해 2" },
  { cat:"기획외", no:"72",   title:"부당이득 관련 판례" },
  { cat:"기획외", no:"79",   title:"파킨슨병과 망간과의 관계 (용접 관련 판례법리)" },
  { cat:"기획외", no:"80",   title:"파킨슨병과 LED제조공정·반도체 공정 근로자 관계" },
  { cat:"기획외", no:"82",   title:"직업적 요인으로써 파킨슨병 정리" },
  { cat:"기획외", no:"84",   title:"산재보험료율 (2024 기준)" },
  { cat:"기획외", no:"85",   title:"장해등급 심사에 관한 규정 전문 (개정 24.06.11.)" },
  { cat:"기획외", no:"88",   title:"추가상병 재요양 판례법리 및 관련 지침 정리" },
  { cat:"기획외", no:"91",   title:"휴업급여 취업치료 가능여부 판단기준 — 공단 지침" },
  { cat:"기획외", no:"93",   title:"근기법상 근로자성 판단 (택시운전기사)" },
  { cat:"기획외", no:"102",  title:"국소부위 동통 장해등급 인정기준 지침" },
  { cat:"기획외", no:"103",  title:"공단 2025 부과실무" },
  { cat:"기획외", no:"107",  title:"사업자 근무이력의 직업력 산정 관련 공단 내부 해석" },
  { cat:"기획외", no:"110",  title:"간병료 지급기준" },
  { cat:"기획외", no:"111",  title:"산재 심사업무처리규정" },
  { cat:"기획외", no:"117",  title:"공단 내부 교육영상자료 (보상PART)" },
  { cat:"기획외", no:"121",  title:"근로자성 판단과 관련한 판례 법리" },
  { cat:"기획외", no:"123",  title:"재요양시 휴업급여 산정 관련 지침" },
  { cat:"기획외", no:"124",  title:"자해행위(자살)과 '자유로운 의사결정 불가 상태' 판단" },
  { cat:"기획외", no:"125",  title:"노무제공자의 고용보험료·산재보험료 반환거부처분 쟁점" },
  { cat:"기획외", no:"126",  title:"2025 업무상질병 여부에 관한 자문 업무처리요령" },
  { cat:"기획외", no:"129",  title:"2025년 요양업무처리규정" },
  { cat:"기획외", no:"132",  title:"공단통계 이용안내" },
  { cat:"기획외", no:"133",  title:"공동근로복지기금 실무 매뉴얼" },
  { cat:"기획외", no:"134",  title:"디스플레이(OLED) 생산업무와 백혈병 간 상당인과관계 판례 법리" },
  { cat:"기획외", no:"135",  title:"직업병에 걸린 근로자의 평균임금 산정 관련 업무지침 제2008-39호" },
  { cat:"기획외", no:"141",  title:"OLED 청소 작업과 유방암 (전리방사선·벤젠 노출) 업무관련성" },
  { cat:"기획외", no:"142",  title:"업무상질병 여부에 관한 자문 업무처리 요령 (2013.04.)" },

  /* ══════════════════════ 소음성 난청 — 이의제기 ══════════════════════ */
  { cat:"난청", sub:"이의제기", no:"1",  title:"위난청 SRT와 PTA" },
  { cat:"난청", sub:"이의제기", no:"2",  title:"편측 중이염" },
  { cat:"난청", sub:"이의제기", no:"3",  title:"노인성·수평형·장기간 소음노출중단" },
  { cat:"난청", sub:"이의제기", no:"4",  title:"특수건강검진·비소음작업" },
  { cat:"난청", sub:"이의제기", no:"5",  title:"과거직력 — 최근 작측 기준 처분, 소음노출기간" },
  { cat:"난청", sub:"이의제기", no:"6",  title:"객관직력미달 (공단 축소해석)" },
  { cat:"난청", sub:"이의제기", no:"7",  title:"과거수진이력 일부승인" },
  { cat:"난청", sub:"이의제기", no:"8",  title:"형틀목공" },
  { cat:"난청", sub:"이의제기", no:"11", title:"원재특진 상향" },
  { cat:"난청", sub:"이의제기", no:"12", title:"중이염·편측 승인" },
  { cat:"난청", sub:"이의제기", no:"13", title:"이소골 이상·객관직력 미달" },
  { cat:"난청", sub:"이의제기", no:"14", title:"위난청 및 소음노출수준" },
  { cat:"난청", sub:"이의제기", no:"15", title:"저음역 및 노인성" },
  { cat:"난청", sub:"이의제기", no:"16", title:"고주파역치·과거수진이력" },
  { cat:"난청", sub:"이의제기", no:"17", title:"비대칭·심도 난청·편평형·고음 급추형" },
  { cat:"난청", sub:"이의제기", no:"18", title:"편평형·위난청·중저음역 역치저하" },
  { cat:"난청", sub:"이의제기", no:"19", title:"비대칭·편평형" },
  { cat:"난청", sub:"이의제기", no:"20", title:"혼합성 난청" },
  { cat:"난청", sub:"이의제기", no:"21", title:"노인성난청·수평형" },
  { cat:"난청", sub:"이의제기", no:"21b",title:"편평형·과거 특진기록" },
  { cat:"난청", sub:"이의제기", no:"22", title:"비대칭·40dB 미만" },
  { cat:"난청", sub:"이의제기", no:"23", title:"심사·재심사 유형화", desc:"마스터 이유서 작성 필요 — 전사적 가이드 제안" },
  { cat:"난청", sub:"이의제기", no:"24", title:"비대칭난청·혼합성난청 (만성 중이염·외상 등)" },
  { cat:"난청", sub:"이의제기", no:"25", title:"일반건강검진 증상고정 쟁점", desc:"일검/특검 근거 부지급 case에서 활용할 논리" },
  { cat:"난청", sub:"이의제기", no:"29", title:"혼합성 난청(골도미달) 감사원심사례", desc:"결론: 기각" },
  { cat:"난청", sub:"이의제기", no:"30", title:"기도청력역치 수치미달 & ABR 수치충족", desc:"결론: 기각" },
  { cat:"난청", sub:"이의제기", no:"31", title:"원특진(10급)/재특진(14급) 원특진 근거 상향", desc:"결론: 기각" },
  { cat:"난청", sub:"이의제기", no:"33", title:"난청-국가장애 (박병대 CASE)", desc:"결론: 기각" },
  { cat:"난청", sub:"이의제기", no:"34", title:"노인성 난청·관리직 직종 비소음 처리" },
  { cat:"난청", sub:"이의제기", no:"37", title:"대구병원 형틀목공 건축 업무 85dB 이상" },

  /* ══════════════════════ 소음성 난청 — 판례 ══════════════════════ */
  { cat:"난청", sub:"판례", no:"1",   title:"신뢰성 결여 최초특진 결과 활용 위법" },
  { cat:"난청", sub:"판례", no:"1(끌올)", title:"1차 특진 신뢰도 결하는 경우 2차 특진 결과로 장해등급 부여 타당 여부", desc:"결론: 타당함. 공단 상고 포기 확정" },
  { cat:"난청", sub:"판례", no:"2",   title:"난청 무직력 상향" },
  { cat:"난청", sub:"판례", no:"3",   title:"저강도 소음 장기간 노출" },
  { cat:"난청", sub:"판례", no:"4",   title:"현재 작측을 기준으로 과거 작업평가" },
  { cat:"난청", sub:"판례", no:"5",   title:"광업소 소음노출중단기간 50년 — 노인성 난청 쟁점" },
  { cat:"난청", sub:"판례", no:"6",   title:"비대칭(편측 정상/편측 고도난청)", desc:"더보상 법인 사건 승소 — 장해판정가이드라인과 배치" },
  { cat:"난청", sub:"판례", no:"7",   title:"비대칭난청(공무상 재해) — 일측에 준하여 판단" },
  { cat:"난청", sub:"판례", no:"8",   title:"일반건강검진 '정상' 소견 쟁점·장기간 소음노출중단 쟁점", desc:"일검에서 정상이어도 소음성 난청 존재 가능 — 섣불리 무관하다 단정 불가" },
  { cat:"난청", sub:"판례", no:"9",   title:"원특진·재특진 신뢰도 관련 판례" },
  { cat:"난청", sub:"판례", no:"10",  title:"감각신경성 난청인데 혼합성난청(골도미달) 이유로 부지급", desc:"항상 소송에서 뒤집힌다는 점이 아쉬움" },
  { cat:"난청", sub:"판례", no:"13",  title:"난청 장기간 저강도 소음 노출" },
  { cat:"난청", sub:"판례", no:"14",  title:"노인성 난청 자연경과적 속도 이상으로 악화" },
  { cat:"난청", sub:"판례", no:"15",  title:"난미장 2심" },
  { cat:"난청", sub:"판례", no:"16",  title:"난미장 1심" },
  { cat:"난청", sub:"판례", no:"17",  title:"비대칭난청 판례" },
  { cat:"난청", sub:"판례", no:"18",  title:"특수건강검진 결과 정상 & 이후 노인성난청 (이봉용)", desc:"원고패소 — 우리에게 매우 불리한 판결문" },
  { cat:"난청", sub:"판례", no:"28",  title:"난청 무직력 상향 항소심 확정 판결" },
  { cat:"난청", sub:"판례", no:"65",  title:"만성중이염과 골도청력과의 관계" },
  { cat:"난청", sub:"판례", no:"66",  title:"80~85dB 소음노출수준이 청력 악화에 미치는 영향" },
  { cat:"난청", sub:"판례", no:"67",  title:"난청 가중 장해 내지 유직력 상향 — 추가소음노출력 기간 판결" },

  /* ══════════════════════ 소음성 난청 — 일반 ══════════════════════ */
  { cat:"난청", sub:"일반", no:"1",    title:"선박기관장 — 산재" },
  { cat:"난청", sub:"일반", no:"4",    title:"특진/재특진 미완료자 처리방법 공단자료 (특진 중 수치미달 포함)" },
  { cat:"난청", sub:"일반", no:"5",    title:"소음성 난청 장해판정 가이드라인" },
  { cat:"난청", sub:"일반", no:"6",    title:"소음성 난청 소견서 보완 관련 근거자료" },
  { cat:"난청", sub:"일반", no:"7",    title:"과거 광업소 종사자 직종 불확실한 경우 소음 측정치 추정 판례", desc:"광업소 58개 공정 소음치 평균(90.381dB)으로 근로자에게 유리하게 판결" },
  { cat:"난청", sub:"일반", no:"10",   title:"노임단가 직종 입증2" },
  { cat:"난청", sub:"일반", no:"12",   title:"난청 이의제기 마스터 이유서 제작 완료" },
  { cat:"난청", sub:"일반", no:"13",   title:"소방관(공무상재해) 사이렌 소리와 소음성 난청 의학적 인과관계" },
  { cat:"난청", sub:"일반", no:"13-1", title:"소방관(공무상재해) 사이렌 소음성 난청 — 강태성 진료기록 감정" },
  { cat:"난청", sub:"일반", no:"16",   title:"현대삼호중공업 크레인운전 작업환경측정결과표 2010~2020년" },
  { cat:"난청", sub:"일반", no:"17",   title:"현재 작측 과거 작업환경 적용 관련 국민신문고 민원 회신", desc:"공단 답변: '전문가 의견 등을 종합적으로 고려했음'" },
  { cat:"난청", sub:"일반", no:"19-1", title:"순음>ABR임에도 감각신경성 난청 신뢰도 인정 여부", desc:"위난청 감별에서는 순음청력검사 재현성이 더 중요" },
  { cat:"난청", sub:"일반", no:"24",   title:"건설업 근로자 직종별 건강진단 방안연구" },
  { cat:"난청", sub:"일반", no:"26",   title:"좌측 귀 청력이 소음에 더 민감하다는 연구논문" },
  { cat:"난청", sub:"일반", no:"27",   title:"건설업 직종별 소음노출수준 판단요령" },
  { cat:"난청", sub:"일반", no:"31",   title:"소음강도와 시간과의 상관관계 — 3dB rule" },
  { cat:"난청", sub:"일반", no:"33",   title:"경기도 소재 공립학교 조리실 소음수준" },

  /* ══════════════════════ 소음성 난청 — 감정 ══════════════════════ */
  { cat:"난청", sub:"감정", no:"3",  title:"85dB 미달 장기간 소음노출" },
  { cat:"난청", sub:"감정", no:"5",  title:"간헐적 소음이 청력소실 유발 어렵다는 감정·장기간 소음노출 공백은 고려사항 아님" },
  { cat:"난청", sub:"감정", no:"6",  title:"삼출성 중이염에 따른 감각신경성 난청" },

  /* ══════════════════════ 평균임금 ══════════════════════ */
  { cat:"평균임금", sub:"일반", no:"7-1",  title:"적용사업장 변경 (김봉갑 원고 승소) — 판결문" },
  { cat:"평균임금", sub:"일반", no:"16",   title:"산재 특례 임금 산정 방법" },
  { cat:"평균임금", sub:"일반", no:"18",   title:"진폐 관련 보험급여의 평균임금 산정 기준시점" },
  { cat:"평균임금", sub:"일반", no:"19",   title:"총 경력년수 관련 최초단계 적용 사례" },
  { cat:"평균임금", sub:"일반", no:"21",   title:"진폐 일용 근로자 통상근로계수 미적용과 근기법 평균임금 산정 규정 배제 여부" },
  { cat:"평균임금", sub:"일반", no:"22",   title:"2025 건설업 노임단가 — 통상근로계수 적용값, 가동일수 20일 기준 평임산정" },
  { cat:"평균임금", sub:"일반", no:"23",   title:"건설일용근로자의 건설노임단가 적용" },
  { cat:"평균임금", sub:"일반", no:"31-1", title:"건설 일용 근로자 직업병 특례임금 원청기준 규모로 변경 가능 여부" },
  { cat:"평균임금", sub:"일반", no:"33",   title:"상용직 직권간주대상자의 통상근로계수 주장 논리" },
  { cat:"평균임금", sub:"일반", no:"34",   title:"직업병 특례 평균임금 업종의 구분기준" },
  { cat:"평균임금", sub:"판례", no:"1",    title:"적용사업장 변경 관련 판례" },
  { cat:"평균임금", sub:"판례", no:"2",    title:"청구시점 변경(청평) 1심 패소 판례" },
  { cat:"평균임금", sub:"판례", no:"3",    title:"청구시점 변경(청평) 대법원 파기환송심 ★대외비★" },
  { cat:"평균임금", sub:"판례", no:"5",    title:"직업병 이환자 평균임금 — 적용사업장 판단기준", desc:"상당인과관계가 있는 사업장 中 하나의 사업장을 꼽아야 함 (대법원)" },
  { cat:"평균임금", sub:"판례", no:"5-1",  title:"위 5번 판결의 파기재판" },
  { cat:"평균임금", sub:"판례", no:"39",   title:"COPD 적사변 — 현중 32년9개월 vs 마지막 사업장 6년6개월(동일작업)" },
  { cat:"평균임금", sub:"이의제기", no:"1-1", title:"이직확인서의 실임금성 (감사원)" },

  /* ══════════════════════ 진폐 ══════════════════════ */
  { cat:"진폐", sub:"일반", no:"1",  title:"진폐보상연금의 소멸시효 기산점", desc:"대법원 파기환송심: 진단일(시행령 근거)" },
  { cat:"진폐", sub:"일반", no:"2",  title:"진폐 임의검사 판정 업무처리기준" },
  { cat:"진폐", sub:"일반", no:"3",  title:"진폐 요양 중 자살 사망 관련" },
  { cat:"진폐", sub:"일반", no:"5",  title:"진폐 병형소송 검토 교육자료" },
  { cat:"진폐", sub:"일반", no:"7",  title:"전국 진폐 정밀 병원별 의무기록 발급 리스트 관리 엑셀" },
  { cat:"진폐", sub:"판례", no:"1",  title:"진폐유족 — 개인질환(뇌경색·심근경색)" },
  { cat:"진폐", sub:"판례", no:"4",  title:"청구시점 변경 관련 1~3심 정리" },
  { cat:"진폐", sub:"판례", no:"5",  title:"신법 사미장(임의검사) 관련 소멸시효 쟁점" },
  { cat:"진폐", sub:"판례", no:"6",  title:"진폐판례 모음집" },
  { cat:"진폐", sub:"판례", no:"8",  title:"자살 관련 업무상인과관계 — 대법원 판단기준", desc:"정신질환 등으로 자유로운 의사결정 불가 상태에서의 사망 여부 종합 판단" },
  { cat:"진폐", sub:"판례", no:"9",  title:"신법사미장 급수 상향 관련 신뢰도 쟁점 (망 최용석)", desc:"원고패: 19.07.03. 진폐진단 당시 7급 검사 신뢰도 없음" },
  { cat:"진폐", sub:"판례", no:"18", title:"위로금 대상자 여부(직접분진 종사) 입증" },
  { cat:"진폐", sub:"이의제기", no:"쇄석기", title:"쇄석기 운전원의 진폐법상 분진작업 해당 여부 — 행정심판 재결서 (인용)" },
  { cat:"진폐", sub:"이의제기", no:"5",  title:"중복지급 불합리 재결 이후 평균임금 산정기준 문제" },
  { cat:"진폐", sub:"이의제기", no:"6",  title:"진폐 병형소송 검토 가이드라인 (수정 중)" },
  { cat:"진폐", sub:"이의제기", no:"8",  title:"진폐유족 업무관련성 판단 (코로나 부지급)" },

  /* ══════════════════════ COPD ══════════════════════ */
  { cat:"COPD", sub:"판례", no:"1",   title:"씨미장 관련 쟁점" },
  { cat:"COPD", sub:"판례", no:"1b",  title:"공무상재해 — 석면폐증 및 COPD", desc:"분진작업 2년 → 석면폐증 → 합병증 COPD" },
  { cat:"COPD", sub:"판례", no:"1-1", title:"씨미장 관련 쟁점 (상세)", desc:"증상고정 판단: 실질적 치료인지 vs 보전적 치료인지에 따라 결정" },
  { cat:"COPD", sub:"판례", no:"1-3", title:"c미장·시미장·씨미장 관련 쟁점 공유" },
  { cat:"COPD", sub:"판례", no:"2",   title:"COPD 소멸시효 기산점 — 산재법 시행령 제25조3항 해석" },
  { cat:"COPD", sub:"일반", no:"1",   title:"용접 직업력 관련" },
  { cat:"COPD", sub:"일반", no:"3",   title:"섬유 COPD 승인 사례" },
  { cat:"COPD", sub:"일반", no:"6",   title:"만성폐쇄성폐질환 업무처리 개선방안" },
  { cat:"COPD", sub:"이의제기", no:"2", title:"도장·신호수" },
  { cat:"COPD", sub:"판례", no:"판례2", title:"COPD 소멸시효 기산점 관련 산재법 시행령 제25조3항 해석" },

  /* ══════════════════════ 공무상재해 ══════════════════════ */
  { cat:"공무상재해", no:"1", title:"위험직무순직공무원 판단기준" },
  { cat:"공무상재해", no:"2", title:"순직유족 및 위험직무 순직유족급여 보상" },
  { cat:"공무상재해", no:"3", title:"2021년 공무원연금실무" },
  { cat:"공무상재해", no:"4", title:"공무상재해+산재 경합시 근로복지공단 전문조사기관 판단", desc:"공무원 직력 기간은 제외하는 것으로 확인" },
  { cat:"공무상재해", no:"5", title:"공상 난청 교안" },
  { cat:"공무상재해", no:"6", title:"공무상재해와 산재 법령 비교정리" },

  /* ══════════════════════ 노무제공자 ══════════════════════ */
  { cat:"노무제공자", no:"1", title:"노무제공자 관련 입법 연혁" },
  { cat:"노무제공자", no:"2", title:"2023.07.01. 이전 화물차주에 대한 공단 지침" },
  { cat:"노무제공자", no:"3", title:"23.07.01. 이전·이후 지침간의 해석" },
  { cat:"노무제공자", no:"4", title:"2023.07.01. 이후 노무제공자 관련 법령 개정 및 실무사항 정리 (영업 문답서 포함)" },
  { cat:"노무제공자", no:"6", title:"노무제공자 교육자료 (24.09.06. 수정안)" },

  /* ══════════════════════ 폐암 ══════════════════════ */
  { cat:"폐암", no:"1",  title:"폐암 & 진폐" },
  { cat:"폐암", no:"3",  title:"폐암 장해진단서 발급 시 참고자료" },
  { cat:"폐암", no:"5",  title:"직업성 암 입증책임 완화·직환연 생략" },
  { cat:"폐암", no:"6",  title:"택시운전자와 폐암", desc:"10년 이상 택시운전자 폐암 유병률 — 도시 환경요인(매연 등) 기여" },
  { cat:"폐암", no:"판1", title:"직업성 암 판례 분석 연구 (2014년)" },

  /* ══════════════════════ 기타 ══════════════════════ */
  { cat:"기타", no:"민사1",    title:"손해배상의 이해 — 민사 손배 기본정리 및 관련 판례" },
  { cat:"기타", no:"민사2",    title:"상속관련" },
  { cat:"기타", no:"민사1b",   title:"손배강의안" },
  { cat:"기타", no:"근골2",    title:"우리나라 최초 무릎관절염 연령별 역학 연구자료" },
  { cat:"기타", no:"근골4",    title:"인공관절 진행 프로세스 교안 초안 (이산)" },
  { cat:"기타", no:"근골15",   title:"업무부담작업 부인과 관련된 진료기록 감정 (박경자)" },
  { cat:"기타", no:"과로1",    title:"업무상과로 — 근로시간 미달 가중요인 고려" },
  { cat:"기타", no:"과로2",    title:"업무상과로 — 근로시간 미달 단기과로(업무량)" },
  { cat:"기타", no:"안구1",    title:"울산TF·울동TF 안구 진행경과" },
  { cat:"기타", no:"안구3",    title:"특수상병 환자 취업치료 관련 업무처리기준", desc:"눈·코·귀·입·얼굴·비뇨기 상병: 최초 진료계획서 승인기간까지 휴업급여 지급" },
  { cat:"기타", no:"어선원3",  title:"산재·어재·선원 재해보상법 3단 비교" },
  { cat:"기타", no:"석폐1",    title:"석면폐증 업무처리지침" },
  { cat:"기타", no:"보훈1",    title:"보훈용어행정집 및 보훈기초자료" },
  { cat:"기타", no:"장해결정1",title:"CRPS를 파생장해로 보는지 여부 — 공단 내부 질의회시", desc:"결론: CRPS는 파생장해 아님 — 조정 원칙 적용" },
  { cat:"기타", no:"장해이의1",title:"사고 이후 발목 12급→CRPS 9급→부당이득 결정 사례" },
  { cat:"기타", no:"여수12",   title:"직력 합산 (전남여수 공유)" },
  { cat:"기타", no:"감근1",    title:"29년 철도청소 노동자(여성) 무릎관절염 업무관련성 판단 (윤선자)" },
];

const ALL_CATS = ["전체", "공유", "기획외", "난청", "평균임금", "진폐", "COPD", "공무상재해", "노무제공자", "폐암", "기타"] as const;
type CatFilter = typeof ALL_CATS[number];

const SUB_FILTERS: Record<string, string[]> = {
  난청:     ["전체", "이의제기", "판례", "일반", "감정"],
  평균임금: ["전체", "일반", "판례", "이의제기"],
  진폐:     ["전체", "일반", "판례", "이의제기"],
  COPD:     ["전체", "일반", "판례", "이의제기"],
};

/* ─────────────────────────────────────────────
   컴포넌트
───────────────────────────────────────────── */
export default function InfoBoardSection() {
  const [catFilter, setCatFilter] = useState<CatFilter>("전체");
  const [subFilter, setSubFilter] = useState<string>("전체");
  const [query, setQuery] = useState("");

  const catKey = catFilter === "전체" ? null : catFilter;

  const filtered = useMemo(() => {
    return DATA.filter(item => {
      const matchCat = !catKey || item.cat === catKey;
      const matchSub = subFilter === "전체" || item.sub === subFilter;
      const q = query.trim().toLowerCase();
      const matchQ = !q || item.title.toLowerCase().includes(q) || (item.desc?.toLowerCase().includes(q) ?? false) || item.no.toLowerCase().includes(q);
      return matchCat && matchSub && matchQ;
    });
  }, [catKey, subFilter, query]);

  const counts: Record<string, number> = {};
  ALL_CATS.forEach(c => {
    counts[c] = c === "전체" ? DATA.length : DATA.filter(d => d.cat === c).length;
  });

  const hasSub = catKey !== null && SUB_FILTERS[catKey];

  return (
    <div style={{ padding: "24px 20px", maxWidth: 920, margin: "0 auto" }}>
      {/* 헤더 */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: "#111827", margin: "0 0 4px" }}>노무사 정보방</h2>
        <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>
          더보상 노무사 업무공유방에서 누적된 판례·사례·지침·실무팁 아카이브 ({DATA.length}건)
        </p>
      </div>

      {/* 검색 */}
      <input
        type="text"
        placeholder="제목·키워드로 검색..."
        value={query}
        onChange={e => setQuery(e.target.value)}
        style={{
          width: "100%", boxSizing: "border-box",
          padding: "10px 14px", fontSize: 14,
          border: "1px solid #d1d5db", borderRadius: 8,
          marginBottom: 16, outline: "none", color: "#111827",
        }}
      />

      {/* 카테고리 필터 */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: hasSub ? 10 : 16 }}>
        {ALL_CATS.map(c => {
          const active = catFilter === c;
          const meta = c === "전체" ? null : CAT_META[c];
          return (
            <button
              key={c}
              onClick={() => { setCatFilter(c); setSubFilter("전체"); }}
              style={{
                padding: "6px 12px", fontSize: 13, fontWeight: active ? 700 : 500,
                border: active ? `2px solid ${meta?.color ?? "#1e40af"}` : "1px solid #d1d5db",
                borderRadius: 20, cursor: "pointer",
                background: active ? (meta?.bg ?? "#dbeafe") : "#fff",
                color: active ? (meta?.color ?? "#1e40af") : "#374151",
              }}
            >
              {meta?.emoji ? `${meta.emoji} ` : ""}{c === "전체" ? "전체" : (CAT_META[c]?.label ?? c)} ({counts[c]})
            </button>
          );
        })}
      </div>

      {/* 서브카테고리 필터 */}
      {hasSub && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
          {SUB_FILTERS[catKey!].map(s => (
            <button
              key={s}
              onClick={() => setSubFilter(s)}
              style={{
                padding: "4px 10px", fontSize: 12, fontWeight: subFilter === s ? 700 : 400,
                border: "1px solid #d1d5db", borderRadius: 12, cursor: "pointer",
                background: subFilter === s ? "#f0f9ff" : "#f9fafb",
                color: subFilter === s ? "#0369a1" : "#6b7280",
              }}
            >
              {s === "전체" ? "전체 서브" : (SUB_LABEL[s] ?? s)}
              {" "}({s === "전체"
                ? DATA.filter(d => d.cat === catKey).length
                : DATA.filter(d => d.cat === catKey && d.sub === s).length})
            </button>
          ))}
        </div>
      )}

      {/* 결과 카운트 */}
      <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 12px" }}>
        {filtered.length}건
      </p>

      {/* 목록 */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: 48, color: "#9ca3af", fontSize: 14 }}>
            검색 결과가 없습니다.
          </div>
        )}
        {filtered.map((item, idx) => {
          const meta = CAT_META[item.cat];
          return (
            <div
              key={idx}
              style={{
                background: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                padding: "12px 14px",
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
              }}
            >
              {/* 번호 */}
              <span style={{
                minWidth: 36, fontSize: 11, color: "#9ca3af",
                fontWeight: 600, paddingTop: 2, flexShrink: 0,
              }}>
                #{item.no}
              </span>

              {/* 본문 */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#111827", lineHeight: 1.5 }}>
                  {item.title}
                </div>
                {item.desc && (
                  <div style={{ fontSize: 12, color: "#6b7280", marginTop: 3, lineHeight: 1.5 }}>
                    {item.desc}
                  </div>
                )}
              </div>

              {/* 배지 */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
                <span style={{
                  fontSize: 11, fontWeight: 600,
                  padding: "2px 8px", borderRadius: 10,
                  background: meta?.bg ?? "#f3f4f6",
                  color: meta?.color ?? "#374151",
                }}>
                  {meta?.label ?? item.cat}
                </span>
                {item.sub && (
                  <span style={{
                    fontSize: 10, fontWeight: 500,
                    padding: "1px 6px", borderRadius: 8,
                    background: "#f3f4f6", color: "#6b7280",
                  }}>
                    {SUB_LABEL[item.sub] ?? item.sub}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
