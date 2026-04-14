"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

const FORMS = [
  { type: "DISABILITY_CLAIM",   label: "장해급여 청구서",                    pages: 1 },
  { type: "NOISE_WORK_CONFIRM", label: "소음작업 종사 사실 확인서",           pages: 1 },
  { type: "AGENT_APPOINTMENT",  label: "대리인 선임신고서",                   pages: 1 },
  { type: "POWER_OF_ATTORNEY",  label: "위임장",                              pages: 1 },
  { type: "SPECIAL_CLINIC",     label: "특진의료기관 선택 확인서 (특진)",      pages: 1 },
  { type: "EXPERT_CLINIC",      label: "특진의료기관 선택 확인서 (전문조사)",  pages: 1 },
  { type: "WORK_HISTORY",       label: "직업력 조사 표준문답서",               pages: 3 },
  { type: "INFO_DISCLOSURE",        label: "정보공개 청구서",             pages: 1 },
  { type: "LABOR_ATTORNEY_RECORD",  label: "공인노무사 업무처리부",       pages: 1 },
  { type: "THIRD_PARTY_INFO",       label: "본인정보 제3자 제공요구서",   pages: 1, badge: "공통" },
  { type: "MEDICAL_BENEFIT",        label: "요양급여신청서",              pages: 1, badge: "공통" },
  { type: "SICK_LEAVE_BENEFIT",     label: "휴업급여신청서",              pages: 1, badge: "공통" },
  { type: "INFO_DISCLOSURE_PROXY",  label: "정보공개청구 위임장",         pages: 1, badge: "공통" },
  { type: "PENSION_CHOICE",         label: "연금·일시금 선택확인서",      pages: 1, badge: "공통" },
  { type: "BEREAVED_CLAIM",         label: "유족급여·장례비청구서",       pages: 1, badge: "유족 전용" },
  { type: "EX_WORKER_HEALTH_EXAM",  label: "이직자 건강진단 신청서",      pages: 1, badge: "진폐 전용" },
  { type: "DUST_WORK_CONFIRM",      label: "분진작업종사사실확인서",      pages: 1, badge: "진폐 전용" },
];

const FORM_FIELDS: Record<string, { key: string; label: string; x: number; y: number }[]> = {
  DISABILITY_CLAIM: [
    { key: "name",          label: "성명 (근로자명)",    x: 157, y: 670 },
    { key: "birthY1",       label: "생년 Y1",            x: 286, y: 671 },
    { key: "birthY2",       label: "생년 Y2",            x: 303, y: 671 },
    { key: "birthY3",       label: "생년 Y3",            x: 320, y: 671 },
    { key: "birthY4",       label: "생년 Y4",            x: 337, y: 671 },
    { key: "birthM1",       label: "생월 M1",            x: 368, y: 671 },
    { key: "birthM2",       label: "생월 M2",            x: 385, y: 671 },
    { key: "birthD1",       label: "생일 D1",            x: 415, y: 671 },
    { key: "birthD2",       label: "생일 D2",            x: 433, y: 671 },
    { key: "phone",         label: "연락처",             x: 465, y: 327 },
    { key: "injY1",         label: "재해일 y1",          x: 103, y: 639 },
    { key: "injY2",         label: "재해일 y2",          x: 120, y: 639 },
    { key: "injY3",         label: "재해일 y3",          x: 137, y: 639 },
    { key: "injY4",         label: "재해일 y4",          x: 153, y: 639 },
    { key: "injM1",         label: "재해월 m1",          x: 185, y: 639 },
    { key: "injM2",         label: "재해월 m2",          x: 202, y: 639 },
    { key: "injD1",         label: "재해일 d1",          x: 233, y: 639 },
    { key: "injD2",         label: "재해일 d2",          x: 250, y: 639 },
    { key: "todayYear",     label: "오늘 연도",           x: 392, y: 340 },
    { key: "todayMonth",    label: "오늘 월",             x: 440, y: 340 },
    { key: "todayDay",      label: "오늘 일",             x: 473, y: 340 },
    { key: "ptName",        label: "청구인 성명",         x: 325, y: 328 },
    { key: "ptPhone",       label: "청구인 연락처",       x: 483, y: 327 },
    { key: "mgrName",       label: "대리인 성명",         x: 325, y: 313 },
    { key: "mgrTel",        label: "대리인 Tel",          x: 483, y: 313 },
    { key: "kwc",           label: "관할공단",            x: 299, y: 93  },
    { key: "bankChangeYes",  label: "수령계좌변경 예",    x: 287, y: 619 },
    { key: "bankChangeNo",   label: "수령계좌변경 아니오", x: 362, y: 619 },
    { key: "bankName",       label: "은행명",             x: 189, y: 600 },
    { key: "bankAccount",    label: "계좌번호",           x: 169, y: 581 },
    { key: "bankHolder",     label: "예금주",             x: 470, y: 581 },
    { key: "bankTypeNormal", label: "보통계좌 체크",      x: 120, y: 561 },
    { key: "bankTypeSpecial",label: "전용계좌 체크",      x: 222, y: 562 },
    { key: "confirm1Yes",    label: "확인①예",            x: 434, y: 539 },
    { key: "confirm1No",     label: "확인①아니오",        x: 483, y: 539 },
    { key: "confirm2Yes",    label: "확인②예",            x: 428, y: 509 },
    { key: "confirm2No",     label: "확인②아니오",        x: 469, y: 509 },
    { key: "receiptDate",    label: "수령일자",           x: 127, y: 464 },
    { key: "receiptAmount",  label: "수령금액",           x: 209, y: 465 },
    { key: "receiptPayer",   label: "지급한자",           x: 297, y: 466 },
    { key: "transferCost",   label: "이송비용",           x: 183, y: 440 },
    { key: "transferDetail", label: "이송비산출내역",     x: 317, y: 440 },
    { key: "compPart",       label: "합병증부위",         x: 207, y: 396 },
    { key: "compHospital",   label: "합병증의료기관",     x: 453, y: 396 },
  ],
  NOISE_WORK_CONFIRM: [
    { key: "name",          label: "성명",           x: 270, y: 693 },
    { key: "jumin1",        label: "주민번호 1",      x: 278, y: 670 },
    { key: "jumin2",        label: "주민번호 2",      x: 295, y: 670 },
    { key: "jumin3",        label: "주민번호 3",      x: 312, y: 670 },
    { key: "jumin4",        label: "주민번호 4",      x: 329, y: 670 },
    { key: "jumin5",        label: "주민번호 5",      x: 346, y: 670 },
    { key: "jumin6",        label: "주민번호 6",      x: 363, y: 670 },
    { key: "jumin7",        label: "주민번호 7",      x: 389, y: 670 },
    { key: "jumin8",        label: "주민번호 8",      x: 406, y: 670 },
    { key: "jumin9",        label: "주민번호 9",      x: 422, y: 670 },
    { key: "jumin10",       label: "주민번호 10",     x: 440, y: 670 },
    { key: "jumin11",       label: "주민번호 11",     x: 456, y: 670 },
    { key: "jumin12",       label: "주민번호 12",     x: 474, y: 670 },
    { key: "jumin13",       label: "주민번호 13",     x: 491, y: 670 },
    { key: "address",       label: "주소",            x: 164, y: 645 },
    { key: "checkEmployed", label: "재직 체크",       x: 316, y: 620 },
    { key: "checkRetired",  label: "퇴직 체크",       x: 401, y: 620 },
    { key: "todayYear",     label: "오늘 연도",       x: 204, y: 143 },
    { key: "todayMonth",    label: "오늘 월",         x: 275, y: 143 },
    { key: "todayDay",      label: "오늘 일",         x: 331, y: 143 },
    { key: "ptName",        label: "청구인 성명",     x: 268, y: 118 },
    { key: "ptPhone",       label: "청구인 연락처",   x: 431, y: 118 },
    { key: "mgrName",       label: "대리인 성명",     x: 268, y: 106 },
    { key: "mgrTel",        label: "대리인 Tel",      x: 431, y: 106 },
    { key: "appendixCheck", label: "별지사용 체크",   x: 367, y: 374 },
  ],
  AGENT_APPOINTMENT: [
    { key: "caseTitle",   label: "사건명",           x: 184, y: 664 },
    { key: "name",        label: "성명 (근로자)",     x: 193, y: 629 },
    { key: "birthDate",   label: "생년월일",          x: 452, y: 629 },
    { key: "address",     label: "주소 (근로자)",     x: 186, y: 599 },
    { key: "phone",       label: "연락처 (근로자)",   x: 372, y: 574 },
    { key: "mgrBranch",   label: "상호 (지사명)",     x: 222, y: 505 },
    { key: "mgrLicense",  label: "등록번호",          x: 470, y: 505 },
    { key: "mgrName",     label: "대리인 성명",       x: 250, y: 460 },
    { key: "mgrJobTitle", label: "대리인 직책",       x: 477, y: 460 },
    { key: "mgrAddress",  label: "대리인 주소",       x: 186, y: 425 },
    { key: "mgrHP",       label: "대리인 H.P",        x: 227, y: 400 },
    { key: "mgrTel",      label: "대리인 Tel",        x: 342, y: 400 },
    { key: "mgrFax",      label: "대리인 Fax",        x: 450, y: 391 },
    { key: "scope",       label: "대리의 범위",       x: 271, y: 356 },
    { key: "injDate",     label: "선임일 (재해일)",   x: 199, y: 315 },
    { key: "todayYear",   label: "오늘 연도",         x: 340, y: 203 },
    { key: "todayMonth",  label: "오늘 월",           x: 412, y: 203 },
    { key: "todayDay",    label: "오늘 일",           x: 461, y: 203 },
    { key: "ptName",      label: "신고인 성명",       x: 367, y: 173 },
    { key: "kwc",         label: "관할공단",          x: 346, y: 140 },
  ],
  POWER_OF_ATTORNEY: [
    { key: "mgrBranch",   label: "법인명 (지사)",     x: 240, y: 657 },
    { key: "mgrAddress",  label: "소재지",            x: 240, y: 638 },
    { key: "mgrTel",      label: "전화",              x: 240, y: 620 },
    { key: "mgrFax",      label: "FAX",               x: 240, y: 602 },
    { key: "mgrLicense",  label: "등록번호",          x: 295, y: 585 },
    { key: "mgrName",     label: "성명 (노무사)",     x: 233, y: 567 },
    { key: "todayYear",   label: "오늘 연도",         x: 345, y: 280 },
    { key: "todayMonth",  label: "오늘 월",           x: 409, y: 280 },
    { key: "todayDay",    label: "오늘 일",           x: 468, y: 280 },
    { key: "name",        label: "성명 (근로자)",     x: 285, y: 234 },
    { key: "ssn",         label: "주민번호",          x: 285, y: 206 },
    { key: "address",     label: "주소 (근로자)",     x: 285, y: 176 },
  ],
  SPECIAL_CLINIC: [
    { key: "name",       label: "성명",            x:  93, y: 676 },
    { key: "ssn1",       label: "주민번호 1",       x: 173, y: 676 },
    { key: "ssn2",       label: "주민번호 2",       x: 190, y: 676 },
    { key: "ssn3",       label: "주민번호 3",       x: 206, y: 676 },
    { key: "ssn4",       label: "주민번호 4",       x: 223, y: 676 },
    { key: "ssn5",       label: "주민번호 5",       x: 240, y: 676 },
    { key: "ssn6",       label: "주민번호 6",       x: 257, y: 676 },
    { key: "ssn7",       label: "주민번호 7",       x: 276, y: 676 },
    { key: "ssn8",       label: "주민번호 8",       x:   0, y:   0 },
    { key: "ssn9",       label: "주민번호 9",       x:   0, y:   0 },
    { key: "ssn10",      label: "주민번호 10",      x:   0, y:   0 },
    { key: "ssn11",      label: "주민번호 11",      x:   0, y:   0 },
    { key: "ssn12",      label: "주민번호 12",      x:   0, y:   0 },
    { key: "ssn13",      label: "주민번호 13",      x:   0, y:   0 },
    { key: "injY1",      label: "재해일 y1",        x: 399, y: 676 },
    { key: "injY2",      label: "재해일 y2",        x: 416, y: 676 },
    { key: "injY3",      label: "재해일 y3",        x: 432, y: 676 },
    { key: "injY4",      label: "재해일 y4",        x: 450, y: 676 },
    { key: "injM1",      label: "재해월 m1",        x: 474, y: 676 },
    { key: "injM2",      label: "재해월 m2",        x: 491, y: 676 },
    { key: "injD1",      label: "재해일 d1",        x: 515, y: 676 },
    { key: "injD2",      label: "재해일 d2",        x: 533, y: 676 },
    { key: "address",    label: "주소",             x: 148, y: 642 },
    { key: "phone",      label: "연락처",           x: 465, y: 640 },
    { key: "clinicName", label: "특진의료기관명",   x: 171, y: 524 },
    { key: "clinicAddr", label: "특진의료기관 주소",x: 364, y: 524 },
    { key: "clinic2Name",label: "특진의료기관2명",  x:   0, y:   0 },
    { key: "clinic2Addr",label: "특진의료기관2주소",x:   0, y:   0 },
    { key: "clinic3Name",label: "특진의료기관3명",  x:   0, y:   0 },
    { key: "clinic3Addr",label: "특진의료기관3주소",x:   0, y:   0 },
    { key: "todayYear",  label: "오늘 연도",        x: 338, y: 195 },
    { key: "todayMonth", label: "오늘 월",          x: 385, y: 195 },
    { key: "todayDay",   label: "오늘 일",          x: 418, y: 195 },
    { key: "ptName",     label: "작성인 성명",      x: 174, y: 182 },
    { key: "ptPhone",    label: "작성인 연락처",    x: 503, y: 182 },
    { key: "mgrName",    label: "대리인 성명",      x: 174, y: 165 },
    { key: "mgrTel",     label: "대리인 Tel",       x: 503, y: 164 },
    { key: "kwc",        label: "관할공단",         x: 133, y:  69 },
  ],
  EXPERT_CLINIC: [
    { key: "name",       label: "성명",            x:  93, y: 676 },
    { key: "ssn1",       label: "주민번호 1",       x: 173, y: 676 },
    { key: "ssn2",       label: "주민번호 2",       x: 190, y: 676 },
    { key: "ssn3",       label: "주민번호 3",       x: 206, y: 676 },
    { key: "ssn4",       label: "주민번호 4",       x: 223, y: 676 },
    { key: "ssn5",       label: "주민번호 5",       x: 240, y: 676 },
    { key: "ssn6",       label: "주민번호 6",       x: 257, y: 676 },
    { key: "ssn7",       label: "주민번호 7",       x: 276, y: 676 },
    { key: "ssn8",       label: "주민번호 8",       x:   0, y:   0 },
    { key: "ssn9",       label: "주민번호 9",       x:   0, y:   0 },
    { key: "ssn10",      label: "주민번호 10",      x:   0, y:   0 },
    { key: "ssn11",      label: "주민번호 11",      x:   0, y:   0 },
    { key: "ssn12",      label: "주민번호 12",      x:   0, y:   0 },
    { key: "ssn13",      label: "주민번호 13",      x:   0, y:   0 },
    { key: "injY1",      label: "재해일 y1",        x: 399, y: 676 },
    { key: "injY2",      label: "재해일 y2",        x: 416, y: 676 },
    { key: "injY3",      label: "재해일 y3",        x: 432, y: 676 },
    { key: "injY4",      label: "재해일 y4",        x: 450, y: 676 },
    { key: "injM1",      label: "재해월 m1",        x: 474, y: 676 },
    { key: "injM2",      label: "재해월 m2",        x: 491, y: 676 },
    { key: "injD1",      label: "재해일 d1",        x: 515, y: 676 },
    { key: "injD2",      label: "재해일 d2",        x: 533, y: 676 },
    { key: "address",    label: "주소",             x: 148, y: 642 },
    { key: "phone",      label: "연락처",           x: 465, y: 640 },
    { key: "clinicName", label: "특진의료기관명",   x: 171, y: 524 },
    { key: "clinicAddr", label: "특진의료기관 주소",x: 364, y: 524 },
    { key: "clinic2Name",label: "특진의료기관2명",  x:   0, y:   0 },
    { key: "clinic2Addr",label: "특진의료기관2주소",x:   0, y:   0 },
    { key: "clinic3Name",label: "특진의료기관3명",  x:   0, y:   0 },
    { key: "clinic3Addr",label: "특진의료기관3주소",x:   0, y:   0 },
    { key: "todayYear",  label: "오늘 연도",        x: 338, y: 195 },
    { key: "todayMonth", label: "오늘 월",          x: 385, y: 195 },
    { key: "todayDay",   label: "오늘 일",          x: 418, y: 195 },
    { key: "ptName",     label: "작성인 성명",      x: 174, y: 182 },
    { key: "ptPhone",    label: "작성인 연락처",    x: 503, y: 182 },
    { key: "mgrName",    label: "대리인 성명",      x: 174, y: 165 },
    { key: "mgrTel",     label: "대리인 Tel",       x: 503, y: 164 },
    { key: "kwc",        label: "관할공단",         x: 133, y:  69 },
  ],
  WORK_HISTORY: [
    { key: "name",       label: "성명 (p1)",         x: 172, y: 638 },
    { key: "phone",      label: "연락처 (p1)",        x: 174, y: 609 },
    { key: "address",    label: "주소 (p1)",          x: 174, y: 582 },
    { key: "totalDur",   label: "합계 근무기간 (p2)", x: 109, y: 687 },
    { key: "todayYear",  label: "오늘 연도 (p3)",     x: 219, y: 309 },
    { key: "todayMonth", label: "오늘 월 (p3)",       x: 282, y: 308 },
    { key: "todayDay",   label: "오늘 일 (p3)",       x: 329, y: 308 },
    { key: "ptName",     label: "청구인 성명 (p3)",   x: 283, y: 267 },
    { key: "ptPhone",    label: "청구인 연락처 (p3)", x: 485, y: 267 },
    { key: "mgrName",    label: "대리인 성명 (p3)",   x: 283, y: 222 },
    { key: "mgrTel",     label: "대리인 Tel (p3)",    x: 485, y: 222 },
  ],
  INFO_DISCLOSURE: [
    { key: "claimantName",  label: "청구인성명",     x: 108, y: 711 },
    { key: "agentSsn",      label: "주민번호(노무사)", x: 338, y: 711 },
    { key: "officeAddress", label: "주소",            x: 108, y: 686 },
    { key: "bizRegNo",      label: "사업자등록번호",  x: 338, y: 686 },
    { key: "officeTel",     label: "전화번호",        x: 108, y: 649 },
    { key: "officeFax",     label: "팩스번호",        x: 225, y: 649 },
    { key: "email",         label: "이메일",          x: 338, y: 649 },
    { key: "content",       label: "청구내용",        x: 108, y: 561 },
    { key: "submitYear",    label: "년",              x: 384, y: 321 },
    { key: "submitMonth",   label: "월",              x: 430, y: 321 },
    { key: "submitDay",     label: "일",              x: 470, y: 321 },
    { key: "agentName",     label: "청구인서명",      x: 108, y: 304 },
    { key: "kwc",           label: "귀하",            x: 200, y: 286 },
  ],
  LABOR_ATTORNEY_RECORD: [
    { key: "branchName",     label: "상호(지사명)",    x: 120.5, y: 695 },
    { key: "ptName",         label: "성명(대표자)",    x: 185,   y: 673 },
    { key: "birthDate",      label: "생년월일",        x: 421,   y: 673 },
    { key: "address",        label: "주소",            x: 120.5, y: 638 },
    { key: "commissionDate", label: "직무위촉연월일",  x: 140,   y: 608 },
    { key: "feeContract",    label: "수수료 계약금",   x: 160,   y: 583 },
    { key: "feeAdvance",     label: "착수금",          x: 360,   y: 583 },
    { key: "jobSummary",     label: "직무 요지",       x: 60.8,  y: 524 },
    { key: "result",         label: "처리 결과",       x: 60.8,  y: 364 },
    { key: "note",           label: "특기사항",        x: 60.8,  y: 201 },
  ],
  THIRD_PARTY_INFO: [
    { key: "year",        label: "년",            x: 245, y: 99  },
    { key: "month",       label: "월",            x: 287, y: 99  },
    { key: "day",         label: "일",            x: 325, y: 99  },
    { key: "ssn",         label: "주민등록번호",  x: 100, y: 79  },
    { key: "ptName",      label: "성명",          x: 250, y: 79  },
    { key: "yesCheck",    label: "예 체크",       x: 365, y: 126 },
  ],
  MEDICAL_BENEFIT: [
    { key: "ptName",          label: "성명",          x: 65,  y: 684 },
    { key: "ssn",             label: "주민번호",      x: 331, y: 686 },
    { key: "address",         label: "주소",          x: 66,  y: 650 },
    { key: "phone",           label: "휴대전화",      x: 353, y: 665 },
    { key: "injuryYear",      label: "재해년",        x: 100, y: 626 },
    { key: "injuryMonth",     label: "재해월",        x: 150, y: 626 },
    { key: "injuryDay",       label: "재해일",        x: 196, y: 626 },
    { key: "workplaceCheck",  label: "질병 체크",     x: 254, y: 347 },
    { key: "workplaceName",   label: "사업장명",      x: 130, y: 479 },
    { key: "workplaceAddr",   label: "사업장주소",    x: 106, y: 436 },
    { key: "claimYear",       label: "신청년",        x: 236, y: 86  },
    { key: "claimMonth",      label: "신청월",        x: 280, y: 86  },
    { key: "claimDay",        label: "신청일",        x: 310, y: 86  },
    { key: "claimantName",    label: "신청인",        x: 340, y: 70  },
    { key: "agentName",       label: "대리인",        x: 340, y: 54  },
    { key: "kwc",             label: "귀하",          x: 200, y: 40  },
  ],
  SICK_LEAVE_BENEFIT: [
    { key: "ptName",           label: "성명",          x: 150, y: 688 },
    { key: "birthYear",        label: "생년",          x: 220, y: 688 },
    { key: "birthMonth",       label: "생월",          x: 268, y: 688 },
    { key: "birthDay",         label: "생일",          x: 308, y: 688 },
    { key: "injuryYear",       label: "재해년",        x: 130, y: 640 },
    { key: "injuryMonth",      label: "재해월",        x: 175, y: 640 },
    { key: "injuryDay",        label: "재해일",        x: 210, y: 640 },
    { key: "bankAccount",      label: "수령계좌",      x: 95,  y: 583 },
    { key: "accountHolder",    label: "예금주",        x: 380, y: 583 },
    { key: "claimStartYear",   label: "청구시작년",    x: 95,  y: 518 },
    { key: "claimStartMonth",  label: "청구시작월",    x: 140, y: 518 },
    { key: "claimStartDay",    label: "청구시작일",    x: 178, y: 518 },
    { key: "claimEndYear",     label: "청구종료년",    x: 260, y: 518 },
    { key: "claimEndMonth",    label: "청구종료월",    x: 305, y: 518 },
    { key: "claimEndDay",      label: "청구종료일",    x: 343, y: 518 },
    { key: "submitYear",       label: "신청년",        x: 230, y: 271 },
    { key: "submitMonth",      label: "신청월",        x: 270, y: 271 },
    { key: "submitDay",        label: "신청일",        x: 305, y: 271 },
    { key: "claimantName",     label: "청구인",        x: 195, y: 255 },
    { key: "claimantPhone",    label: "청구인전화",    x: 340, y: 255 },
    { key: "agentName",        label: "대리인",        x: 195, y: 239 },
    { key: "agentPhone",       label: "대리인전화",    x: 340, y: 239 },
    { key: "kwc",              label: "귀하",          x: 205, y: 125 },
  ],
  INFO_DISCLOSURE_PROXY: [
    { key: "ptName",        label: "위임인성명",     x: 112, y: 732 },
    { key: "ptSsn",         label: "위임인주민번호", x: 342, y: 732 },
    { key: "ptAddress",     label: "위임인주소",     x: 112, y: 698 },
    { key: "agentName",     label: "수임인성명",     x: 112, y: 660 },
    { key: "agentSsn",      label: "수임인주민번호", x: 342, y: 660 },
    { key: "agentAddress",  label: "수임인주소",     x: 112, y: 643 },
    { key: "submitYear",    label: "년",             x: 350, y: 142 },
    { key: "submitMonth",   label: "월",             x: 395, y: 142 },
    { key: "submitDay",     label: "일",             x: 430, y: 142 },
    { key: "ptSign",        label: "위임인서명",     x: 333, y: 110 },
  ],
  PENSION_CHOICE: [
    { key: "submitYear",  label: "년",          x: 236, y: 93 },
    { key: "submitMonth", label: "월",          x: 282, y: 93 },
    { key: "submitDay",   label: "일",          x: 318, y: 93 },
    { key: "signName",    label: "확인자성명",  x: 310, y: 78 },
  ],
  BEREAVED_CLAIM: [
    { key: "workplaceName",  label: "사업장명",    x: 355, y: 694 },
    { key: "workplaceArea",  label: "소재지",      x: 437, y: 684 },
    { key: "deceasedName",   label: "재해자성명",  x: 156, y: 656 },
    { key: "ssn",            label: "주민번호",    x: 310, y: 656 },
    { key: "address",        label: "주소",        x: 156, y: 628 },
    { key: "occupation",     label: "직종",        x: 437, y: 618 },
    { key: "injuryYear",     label: "재해년",      x: 168, y: 596 },
    { key: "injuryMonth",    label: "재해월",      x: 215, y: 596 },
    { key: "injuryDay",      label: "재해일",      x: 255, y: 596 },
    { key: "funeralDate",    label: "장례실행일",  x: 430, y: 466 },
    { key: "bankAccount",    label: "수령계좌",    x: 150, y: 356 },
    { key: "accountHolder",  label: "예금주",      x: 390, y: 356 },
    { key: "submitYear",     label: "신청년",      x: 160, y: 131 },
    { key: "submitMonth",    label: "신청월",      x: 200, y: 131 },
    { key: "submitDay",      label: "신청일",      x: 235, y: 131 },
    { key: "claimantName",   label: "청구인",      x: 130, y: 115 },
    { key: "agentName",      label: "대리인",      x: 130, y: 99  },
    { key: "kwc",            label: "귀하",        x: 209, y: 83  },
  ],
  EX_WORKER_HEALTH_EXAM: [
    { key: "ptName",            label: "성명",            x: 108, y: 705 },
    { key: "ssn",               label: "주민번호",        x: 338, y: 705 },
    { key: "address",           label: "주소",            x: 108, y: 681 },
    { key: "phone",             label: "전화번호",        x: 338, y: 681 },
    { key: "workPeriodStart",   label: "분진기간시작",    x: 108, y: 626 },
    { key: "workPeriodEnd",     label: "분진기간종료",    x: 200, y: 626 },
    { key: "workplaceName",     label: "사업장명칭",      x: 108, y: 596 },
    { key: "workplaceAddress",  label: "사업장소재지",    x: 108, y: 566 },
    { key: "submitYear",        label: "년",              x: 350, y: 231 },
    { key: "submitMonth",       label: "월",              x: 390, y: 231 },
    { key: "submitDay",         label: "일",              x: 425, y: 231 },
    { key: "claimantName",      label: "신청인",          x: 300, y: 201 },
    { key: "kwc",               label: "귀하",            x: 100, y: 151 },
  ],
  DUST_WORK_CONFIRM: [
    { key: "ptName",       label: "근로자명",           x: 108, y: 766 },
    { key: "ssn",         label: "주민번호",            x: 108, y: 746 },
    { key: "ws0_company", label: "최종_사업장명",       x: 85,  y: 696 },
    { key: "ws0_job",     label: "최종_직종명",         x: 175, y: 696 },
    { key: "ws0_dust",    label: "최종_분진명",         x: 265, y: 696 },
    { key: "ws0_start",   label: "최종_시작",           x: 345, y: 703 },
    { key: "ws0_end",     label: "최종_종료",           x: 345, y: 686 },
    { key: "ws1_company", label: "과거1_사업장명",      x: 85,  y: 611 },
    { key: "ws1_job",     label: "과거1_직종명",        x: 175, y: 611 },
    { key: "ws1_dust",    label: "과거1_분진명",        x: 265, y: 611 },
    { key: "ws1_start",   label: "과거1_시작",          x: 345, y: 619 },
    { key: "ws1_end",     label: "과거1_종료",          x: 345, y: 601 },
    { key: "ws2_company", label: "과거2_사업장명",      x: 85,  y: 530 },
    { key: "ws2_job",     label: "과거2_직종명",        x: 175, y: 530 },
    { key: "ws2_dust",    label: "과거2_분진명",        x: 265, y: 530 },
    { key: "ws2_start",   label: "과거2_시작",          x: 345, y: 538 },
    { key: "ws2_end",     label: "과거2_종료",          x: 345, y: 520 },
    { key: "ws3_company", label: "과거3_사업장명",      x: 85,  y: 450 },
    { key: "ws3_job",     label: "과거3_직종명",        x: 175, y: 450 },
    { key: "ws3_dust",    label: "과거3_분진명",        x: 265, y: 450 },
    { key: "ws3_start",   label: "과거3_시작",          x: 345, y: 458 },
    { key: "ws3_end",     label: "과거3_종료",          x: 345, y: 440 },
    { key: "ws4_company", label: "과거4_사업장명",      x: 85,  y: 370 },
    { key: "ws4_job",     label: "과거4_직종명",        x: 175, y: 370 },
    { key: "ws4_dust",    label: "과거4_분진명",        x: 265, y: 370 },
    { key: "ws4_start",   label: "과거4_시작",          x: 345, y: 378 },
    { key: "ws4_end",     label: "과거4_종료",          x: 345, y: 360 },
    { key: "submitYear",  label: "년",                  x: 340, y: 161 },
    { key: "submitMonth", label: "월",                  x: 380, y: 161 },
    { key: "submitDay",   label: "일",                  x: 415, y: 161 },
    { key: "ptSign",      label: "근로자명서명",        x: 300, y: 143 },
  ],
};

type FieldEntry = { key: string; label: string; x: number; y: number };

// pdf-lib pt 좌표계 (좌하단 원점, A4=595×841)
const PDF_W = 595;
const PDF_H = 841;

export default function FormsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") { router.replace("/login"); return; }
    if (status === "authenticated" && (session.user as { role?: string }).role !== "ADMIN") { router.replace("/"); return; }
  }, [status, session, router]);

  const [selectedForm, setSelectedForm]   = useState<string | null>(null);
  const [previewPage, setPreviewPage]     = useState(1);
  const [selectedField, setSelectedField] = useState<FieldEntry | null>(null);
  const [coordFields, setCoordFields]     = useState<Record<string, FieldEntry[]>>({});
  const [coordOutput, setCoordOutput]     = useState("");

  // PNG 미리보기 상태
  const [imgSize, setImgSize]             = useState<{ w: number; h: number } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewType, setPreviewType]     = useState<"png" | "pdf">("png");

  const imgRef       = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 서식 선택
  const handleSelectForm = (type: string) => {
    setSelectedForm(type);
    setPreviewPage(1);
    setSelectedField(null);
    setImgSize(null);
    setPreviewType("png");
    if (!coordFields[type]) {
      setCoordFields(prev => ({
        ...prev,
        [type]: (FORM_FIELDS[type] ?? []).map(f => ({ ...f })),
      }));
    }
  };

  const updateCoordOutput = useCallback((form: string, fields: FieldEntry[]) => {
    const lines = fields.map(f => `{ key: '${f.key}', label: '${f.label}', x: ${f.x}, y: ${f.y} },`).join("\n");
    setCoordOutput(lines);
  }, []);

  const updateFieldCoord = useCallback((axis: "x" | "y", value: number) => {
    setSelectedField(prev => {
      if (!prev) return prev;
      const updated = { ...prev, [axis]: value };
      setCoordFields(cf => {
        if (!selectedForm) return cf;
        const newFields = (cf[selectedForm] ?? []).map(f => f.key === updated.key ? updated : f);
        updateCoordOutput(selectedForm, newFields);
        return { ...cf, [selectedForm]: newFields };
      });
      return updated;
    });
  }, [selectedForm, updateCoordOutput]);

  // 필드 선택 + 컨테이너 포커스
  const handleSelectField = (key: string) => {
    if (!selectedForm) return;
    const f = coordFields[selectedForm]?.find(f => f.key === key) ?? null;
    setSelectedField(f);
    setTimeout(() => containerRef.current?.focus(), 50);
  };

  // 이미지 클릭 → 마커 이동
  const handleImageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!selectedField || !imgRef.current || !imgSize) return;
    const rect = imgRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    const scaleX = imgSize.w / rect.width;
    const scaleY = imgSize.h / rect.height;
    const pdfX = Math.round(clickX * scaleX * (PDF_W / imgSize.w));
    const pdfY = Math.round(PDF_H - (clickY * scaleY * (PDF_H / imgSize.h)));
    updateFieldCoord("x", pdfX);
    updateFieldCoord("y", pdfY);
  };

  // 방향키 핸들러 (컨테이너 div)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!selectedField) return;
    const arrows = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"];
    if (!arrows.includes(e.key)) return;
    e.preventDefault();
    const step = e.shiftKey ? 5 : 1;
    switch (e.key) {
      case "ArrowLeft":  updateFieldCoord("x", selectedField.x - step); break;
      case "ArrowRight": updateFieldCoord("x", selectedField.x + step); break;
      case "ArrowUp":    updateFieldCoord("y", selectedField.y + step); break;
      case "ArrowDown":  updateFieldCoord("y", selectedField.y - step); break;
    }
  };

  const handleLoadCoords = () => {
    if (!selectedForm) return;
    const fields = coordFields[selectedForm] ?? (FORM_FIELDS[selectedForm] ?? []).map(f => ({ ...f }));
    setCoordFields(prev => ({ ...prev, [selectedForm]: fields }));
    updateCoordOutput(selectedForm, fields);
  };

  const handleCopyCoords = () => {
    navigator.clipboard.writeText(coordOutput);
    alert("좌표가 클립보드에 복사되었습니다.");
  };

  const handleBlankPrint = async (type: string, label: string) => {
    const res = await fetch(`/api/forms/blank?type=${type}`);
    if (!res.ok) { alert("공란 인쇄 실패"); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `[공란]${label}.pdf`; a.click();
    URL.revokeObjectURL(url);
  };

  if (status === "loading") return <div style={{ padding: 40, color: "#9ca3af" }}>불러오는 중…</div>;

  const currentFormMeta = FORMS.find(f => f.type === selectedForm);
  const previewUrl = selectedForm
    ? `/api/forms/preview?type=${selectedForm}&page=${previewPage}&t=${Date.now()}`
    : "";

  return (
    <div style={{ display: "flex", height: "calc(100vh - 56px)", fontFamily: "'Malgun Gothic','Apple SD Gothic Neo','Segoe UI',sans-serif", fontSize: 13 }}>

      {/* ── 좌측 패널: 서식 목록 ── */}
      <div style={{ width: 260, borderRight: "1px solid #e5e7eb", padding: 16, overflowY: "auto", background: "#fafafa", flexShrink: 0 }}>
        <h2 style={{ fontSize: 15, fontWeight: "bold", marginBottom: 14, color: "#111827" }}>서식 목록</h2>
        {FORMS.map((form) => (
          <div
            key={form.type}
            onClick={() => handleSelectForm(form.type)}
            style={{
              padding: 10, marginBottom: 8, borderRadius: 6,
              border: `1px solid ${selectedForm === form.type ? "#29ABE2" : "#e5e7eb"}`,
              backgroundColor: selectedForm === form.type ? "#e8f7fd" : "white",
              cursor: "pointer",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontWeight: "bold", fontSize: 12, color: "#111827" }}>{form.label}</span>
              {(form as any).badge && (
                <span style={{
                  fontSize: 9, padding: "1px 5px", borderRadius: 4, fontWeight: 600,
                  backgroundColor: (form as any).badge === "진폐 전용" ? "#fef3c7" : (form as any).badge === "유족 전용" ? "#fce7f3" : "#e0f7fa",
                  color: (form as any).badge === "진폐 전용" ? "#92400e" : (form as any).badge === "유족 전용" ? "#9d174d" : "#006064",
                }}>
                  {(form as any).badge}
                </span>
              )}
            </div>
            <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 2 }}>{form.pages}페이지</div>
            <button
              onClick={(e) => { e.stopPropagation(); handleBlankPrint(form.type, form.label); }}
              style={{ marginTop: 6, padding: "3px 8px", fontSize: 11, backgroundColor: "#f3f4f6", border: "1px solid #d1d5db", borderRadius: 4, cursor: "pointer", color: "#374151" }}
            >
              🖨️ 공란 인쇄
            </button>
          </div>
        ))}
      </div>

      {/* ── 우측 패널: 에디터 ── */}
      <div style={{ flex: 1, padding: 12, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <h2 style={{ fontSize: 15, fontWeight: "bold", margin: 0, color: "#111827" }}>
            좌표 에디터{selectedForm ? ` — ${currentFormMeta?.label}` : ""}
          </h2>
          {selectedForm && (
            <button onClick={handleLoadCoords} style={{ padding: "3px 8px", fontSize: 11, border: "1px solid #d1d5db", borderRadius: 4, cursor: "pointer", background: "white" }}>
              좌표 불러오기
            </button>
          )}
        </div>

        {!selectedForm ? (
          <div style={{ color: "#9ca3af", fontSize: 13, paddingTop: 60, textAlign: "center" }}>
            좌측에서 서식을 선택하세요.
          </div>
        ) : (
          <div style={{ display: "flex", gap: 12, flex: 1, overflow: "hidden" }}>

            {/* ── PDF 미리보기 컨테이너 ── */}
            <div
              ref={containerRef}
              style={{
                position: "relative",
                flex: 1,
                border: "1px solid #d1d5db",
                borderRadius: 6,
                backgroundColor: "#666",
                overflow: "auto",
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "center",
                outline: "none",
              }}
              tabIndex={0}
              onKeyDown={handleKeyDown}
              onClick={handleImageClick}
            >
              {previewType === "png" ? (
                <>
                  <img
                    ref={imgRef}
                    src={previewUrl}
                    alt="서식 미리보기"
                    style={{
                      display: "block",
                      maxWidth: "100%",
                      cursor: selectedField ? "crosshair" : "default",
                      userSelect: "none",
                    }}
                    onLoad={(e) => {
                      const img = e.currentTarget;
                      setImgSize({ w: img.naturalWidth, h: img.naturalHeight });
                      setPreviewLoading(false);
                    }}
                    onLoadStart={() => setPreviewLoading(true)}
                    onError={() => setPreviewType("pdf")}
                    draggable={false}
                  />

                  {/* 마커 오버레이 */}
                  {selectedField && imgSize && imgRef.current && containerRef.current && (() => {
                    const containerRect = containerRef.current!.getBoundingClientRect();
                    const imgRect = imgRef.current.getBoundingClientRect();
                    const relLeft = imgRect.left - containerRect.left + containerRef.current!.scrollLeft;
                    const relTop  = imgRect.top  - containerRect.top  + containerRef.current!.scrollTop;
                    const scaleX = imgRect.width / imgSize.w;
                    const scaleY = imgRect.height / imgSize.h;
                    const pxPerPtX = imgSize.w / PDF_W;
                    const pxPerPtY = imgSize.h / PDF_H;
                    const markerX = selectedField.x * pxPerPtX * scaleX;
                    const markerY = (PDF_H - selectedField.y) * pxPerPtY * scaleY;

                    return (
                      <div
                        style={{
                          position: "absolute",
                          left: relLeft,
                          top: relTop,
                          width: imgRect.width,
                          height: imgRect.height,
                          pointerEvents: "none",
                        }}
                      >
                        {/* 십자선 */}
                        <div style={{ position: "absolute", left: markerX - 10, top: markerY - 10, width: 20, height: 20, pointerEvents: "none" }}>
                          <div style={{ position: "absolute", left: 0, top: 9, width: 20, height: 2, backgroundColor: "#FF0000", opacity: 0.9 }} />
                          <div style={{ position: "absolute", left: 9, top: 0, width: 2, height: 20, backgroundColor: "#FF0000", opacity: 0.9 }} />
                        </div>
                        {/* 라벨 */}
                        <div style={{
                          position: "absolute",
                          left: markerX + 12,
                          top: markerY - 18,
                          backgroundColor: "rgba(220,38,38,0.9)",
                          color: "white",
                          fontSize: 10,
                          padding: "1px 5px",
                          borderRadius: 3,
                          whiteSpace: "nowrap",
                          pointerEvents: "none",
                        }}>
                          {selectedField.label} ({selectedField.x}, {selectedField.y})
                        </div>
                      </div>
                    );
                  })()}
                </>
              ) : (
                // fallback: pdftoppm 없는 환경
                <iframe
                  key={`${selectedForm}-${previewPage}`}
                  src={`/api/forms/blank?type=${selectedForm}`}
                  style={{ flex: 1, border: "none", width: "100%", height: "100%", minHeight: 600 }}
                  title="서식 미리보기"
                />
              )}

              {/* 로딩 오버레이 */}
              {previewLoading && previewType === "png" && (
                <div style={{
                  position: "absolute", inset: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  backgroundColor: "rgba(255,255,255,0.7)",
                  fontSize: 14, color: "#666",
                }}>
                  로딩 중...
                </div>
              )}

              {/* 페이지 네비게이션 */}
              {(currentFormMeta?.pages ?? 1) > 1 && (
                <div style={{
                  position: "absolute", bottom: 8, left: "50%", transform: "translateX(-50%)",
                  display: "flex", gap: 8, alignItems: "center",
                  background: "rgba(255,255,255,0.92)", padding: "4px 14px", borderRadius: 20, border: "1px solid #e5e7eb",
                }}>
                  <button onClick={(e) => { e.stopPropagation(); setPreviewPage(p => Math.max(1, p - 1)); }} disabled={previewPage <= 1} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: previewPage <= 1 ? "#d1d5db" : "#374151" }}>◀</button>
                  <span style={{ fontSize: 12, color: "#374151" }}>{previewPage} / {currentFormMeta?.pages ?? 1}</span>
                  <button onClick={(e) => { e.stopPropagation(); setPreviewPage(p => Math.min(currentFormMeta?.pages ?? 1, p + 1)); }} disabled={previewPage >= (currentFormMeta?.pages ?? 1)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: previewPage >= (currentFormMeta?.pages ?? 1) ? "#d1d5db" : "#374151" }}>▶</button>
                </div>
              )}

              {/* 힌트 */}
              {selectedField && previewType === "png" && (
                <div style={{ position: "absolute", top: 8, left: "50%", transform: "translateX(-50%)", background: "rgba(0,0,0,0.6)", color: "white", fontSize: 10, padding: "2px 8px", borderRadius: 10, pointerEvents: "none", whiteSpace: "nowrap" }}>
                  클릭으로 마커 이동 · 방향키(Shift: 5pt)로 미세 조정
                </div>
              )}
            </div>

            {/* ── 우측 좌표 패널 ── */}
            <div style={{ width: 240, display: "flex", flexDirection: "column", gap: 10, overflowY: "auto", flexShrink: 0 }}>

              {/* 필드 선택 */}
              <div>
                <label style={{ fontSize: 11, fontWeight: "bold", display: "block", marginBottom: 4, color: "#374151" }}>필드 선택</label>
                <select
                  value={selectedField?.key ?? ""}
                  onChange={(e) => handleSelectField(e.target.value)}
                  style={{ width: "100%", padding: "6px 8px", fontSize: 12, border: "1px solid #d1d5db", borderRadius: 4 }}
                >
                  <option value="">-- 필드 선택 --</option>
                  {(coordFields[selectedForm] ?? []).map((f) => (
                    <option key={f.key} value={f.key}>{f.label}</option>
                  ))}
                </select>
              </div>

              {/* 선택 필드 좌표 */}
              {selectedField && (
                <div style={{ padding: 10, border: "1px solid #29ABE2", borderRadius: 6, fontSize: 12, backgroundColor: "#e8f7fd" }}>
                  <div style={{ fontWeight: "bold", marginBottom: 6, color: "#29ABE2" }}>
                    📍 {selectedField.label}
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <div>
                      <label style={{ fontSize: 11, color: "#666", display: "block", marginBottom: 2 }}>x (pt)</label>
                      <input
                        type="number"
                        value={selectedField.x}
                        onChange={(e) => updateFieldCoord("x", Number(e.target.value))}
                        style={{ width: 70, padding: "4px 6px", fontSize: 12, border: "1px solid #d1d5db", borderRadius: 4, display: "block" }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: "#666", display: "block", marginBottom: 2 }}>y (pt)</label>
                      <input
                        type="number"
                        value={selectedField.y}
                        onChange={(e) => updateFieldCoord("y", Number(e.target.value))}
                        style={{ width: 70, padding: "4px 6px", fontSize: 12, border: "1px solid #d1d5db", borderRadius: 4, display: "block" }}
                      />
                    </div>
                  </div>
                  <div style={{ marginTop: 6, fontSize: 10, color: "#888" }}>
                    이미지 클릭 또는 방향키(Shift: 5pt)로 이동
                  </div>
                </div>
              )}

              {/* 전체 좌표 복사 */}
              <button
                onClick={handleCopyCoords}
                style={{ padding: "7px 10px", fontSize: 12, backgroundColor: "#8DC63F", color: "white", border: "none", borderRadius: 4, cursor: "pointer", fontWeight: 600 }}
              >
                📋 전체 좌표 복사
              </button>

              {/* 좌표 출력 */}
              <textarea
                value={coordOutput}
                readOnly
                rows={12}
                style={{ fontSize: 10, fontFamily: "monospace", resize: "vertical", padding: 8, border: "1px solid #e5e7eb", borderRadius: 4, color: "#374151", background: "#f9fafb" }}
                placeholder="필드를 선택하고 좌표를 입력하면 여기에 출력됩니다."
              />

              {/* 안내 */}
              <div style={{ fontSize: 10, color: "#9ca3af", padding: "8px 10px", background: "#f9fafb", borderRadius: 4, border: "1px solid #f3f4f6" }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>사용 방법</div>
                <div>1. 서식 선택 → PNG 미리보기 표시</div>
                <div>2. 필드 선택 → 빨간 마커 표시</div>
                <div>3. 이미지 클릭 → 마커 이동</div>
                <div>4. 방향키(Shift: 5pt) 미세 조정</div>
                <div>5. 전체 좌표 복사 → PDF API에 적용</div>
                <div style={{ marginTop: 4, color: "#d97706" }}>※ 좌하단 원점, A4 = 595×841pt</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
