export const CAT1_LIST = [
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

export const CAT2_MAP: Record<string, { key: string; label: string }[]> = {
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

export const CAT3_LIST = ["일반", "이의제기", "판례"] as const;
