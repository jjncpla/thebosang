# TBSS 양식 학습 자료 보관소

> 2026-04-29~30 텔레그램+OneDrive 4,526개 산재 양식 학습 결과 인덱스
>
> **목적**: 다른 세션·작업 시 양식 구조·필드·TBSS 매핑 빠른 참조

---

## 0. 자료 위치

### GitHub (영구 보관, 참조용)
- `docs/양식_데이터매핑_분석.md` — 메인 분석 보고서 (526줄)
- `docs/작업이력_2026-04-29_30.md` — 작업 timeline + 시행착오
- `docs/forms-learning/README.md` — 본 인덱스 (양식 빠른 참조)
- `docs/forms-learning/47개_양식_빠른참조.md` — 양식별 핵심 필드 + TBSS 매핑 (PII 없음)

### 로컬 (보안상 GitHub 미반영)
- `C:\Users\jjakg\AppData\Local\Temp\tbss_form_analysis\classified\bundle_for_llm.md` (343KB)
  - 양식별 표본 텍스트 (PII 자동 익명화) — LLM 보고서 작성용
- `C:\Users\jjakg\AppData\Local\Temp\tbss_form_analysis\classified\all_form_fields_summary.md` (43KB)
  - 모든 양식의 필드 추출 결과 (라벨·빈도·샘플값)
- `C:\Users\jjakg\AppData\Local\Temp\tbss_form_analysis\classified\forms_by_type.jsonl`
  - 4,526개 파일별 분류 결과 (form_id + 신뢰도 + 추출 필드)
- `C:\Users\jjakg\AppData\Local\Temp\tbss_form_analysis\classified\form_fields_*.json` (44개)
  - 양식 종류별 필드 JSON

### 메모리 (LLM 작업 시 자동 로드)
- `~/.claude/projects/C--Users-jjakg-thebosang/memory/form_master_reference.md`
- `~/.claude/projects/C--Users-jjakg-thebosang/memory/tbss_implementation_gaps.md`
- `~/.claude/projects/C--Users-jjakg-thebosang/memory/progress_form_analysis.md`

---

## 1. 양식 처리 인프라

### OCR 도구 환경
```
pdftotext 25.07.0      — winget Poppler (텍스트형 PDF)
Tesseract 5.4 + tessdata_best (kor/eng/chi_tra)
                       — C:\Users\jjakg\tessdata\ (가상화 회피)
OCRmyPDF 17.4.2        — Python pip
hwp5txt (pyhwp)        — HWP 파일
Document AI            — Production OCR (한국어 표 양식 95%+)
```

### Document AI 환경변수 (production)
```
GOOGLE_CREDENTIALS_B64  — Railway env에 설정됨
GOOGLE_DOCAI_PROCESSOR  — Railway env에 설정됨
```

### 최적 OCR 명령 (Tesseract 단일)
```bash
ocrmypdf -l kor+eng --skip-text \
  --oversample 600 \
  --tesseract-pagesegmode 6 \
  --tesseract-oem 1 \
  --sidecar OUT.txt IN.pdf OUT.pdf
```

### Microsoft Store Python AppContainer 회피
- `python` 명령 → `WindowsApps\python.exe` (가상화 차단)
- **반드시 native 경로 사용**: `C:\Users\jjakg\AppData\Local\Python\pythoncore-3.14-64\python.exe`

---

## 2. 양식 분포 (47종)

### TBSS 자동생성 17개 양식 (모두 폴더 사례 충분 확보)
| Form ID | 한글명 | 폴더 사례 |
|---|---|---|
| DISABILITY_CLAIM | 장해급여청구서 | 425 |
| MEDICAL_BENEFIT | 요양급여신청서 | 228 |
| AGENT_APPOINTMENT | 대리인선임서 | 190 |
| SICK_LEAVE_BENEFIT | 휴업급여청구서 | 123 |
| POWER_OF_ATTORNEY | 위임장 | 580* |
| BEREAVED_CLAIM | 유족급여청구서 | 49 |
| WORK_HISTORY | 직업력조사표 | 47 |
| NOISE_WORK_CONFIRM | 소음작업종사확인서 | 36 |
| DUST_WORK_CONFIRM | 분진작업종사확인서 | 19 |
| INFO_DISCLOSURE | 정보공개청구서 | 11 |
| PENSION_CHOICE | 연금일시금선택서 | 4 |
| LABOR_ATTORNEY_RECORD | 공인노무사업무처리부 | 2 |
| EXPERT_CLINIC | 전문조사기관선택서 | 1 |
| INFO_DISCLOSURE_PROXY | 정보공개청구위임장 | 1 |
| THIRD_PARTY_INFO | 본인정보제3자제공요구서 | (분류기 미식별) |
| SPECIAL_CLINIC | 특진의료기관선택서 | (CLINIC_VISIT_REQUEST와 중복) |
| EX_WORKER_HEALTH_EXAM | 퇴직자건강검진요청서 | (사용 빈도 낮음) |

*POWER_OF_ATTORNEY 580건은 false positive 다수 — 실제 위임장 본체는 약 200건 추정

### 신규 자동생성 후보 12종 (TBSS 미구현)

#### 우선순위 ★★★ (즉시 구현, Phase B-3에서 5종 완료)
| Form ID | 한글명 | 사례 | 구현 |
|---|---|---|---|
| WAGE_CORRECTION_CLAIM | 평균임금정정청구서 | 42 | ✅ B-3 |
| AVG_WAGE_REPORT | 평균임금산정내역서 (수신용) | 45 | ✅ B (OCR 인입) |
| EXAM_CLAIM | 심사청구서 | 6 | ✅ B-3 |
| REEXAM_CLAIM | 재심사청구서 | 5 | ✅ B-3 |

#### 우선순위 ★★ (Phase B-3 일부 + 미완료)
| Form ID | 한글명 | 사례 | 구현 |
|---|---|---|---|
| ADDITIONAL_INJURY_CLAIM | 추가상병 신청서 | 3 | ✅ B-3 |
| REQUOTE_REQUEST | 재요양 신청서 | 7 | ✅ B-3 |
| INJURY_PENSION_CLAIM | 상병보상연금 청구 | 4 | ⏳ |
| FUNERAL_BENEFIT | 장의비 청구서 | 4 | ⏳ |

#### 우선순위 ★ (미완료)
| Form ID | 한글명 | 사례 | 구현 |
|---|---|---|---|
| CARE_BENEFIT | 간병급여 청구 | 1 | ⏳ |
| INFO_DISCLOSURE_BUNDLE | 정보공개 자료 묶음 | 22 | ⏳ |
| INFO_DISCLOSURE_DECISION | 정보공개 결정통지서 | 1 | ⏳ |

### 공단 수신 양식 (OCR 자동 인입 후보)
| Form ID | 사례 | 자동 인입 대상 모델 |
|---|---|---|
| HEARING_LOSS_DECISION | 395 | HearingLossDetail (구현됨, OCR 인입 미완) |
| MUSCULOSKELETAL_DECISION | 113 | MusculoskeletalDetail |
| PNEUMOCONIOSIS_DECISION | 91 | PneumoconiosisDetail |
| DECISION_NOTICE_APPROVAL | 81 | Case.status |
| CLINIC_VISIT_REQUEST | 81 | Case.status + kwcOfficer* |
| DECISION_NOTICE_REJECTION | 79 | Case.status + ObjectionReview 자동 생성 |
| COPD_DECISION | 75 | CopdDetail |
| DOC_SUPPLEMENTATION_REQUEST | 57 | Case.status + 알림 |
| LUNG_CANCER_DECISION | 52 | OccupationalCancerDetail |
| AVG_WAGE_REPORT | 45 | WageReviewData |

---

## 3. 6개 미구현 상병 갭 (정밀화)

### COPD (75건 OCR)
**현재 상태**: Prisma 모델 존재 (`CopdDetail`), UI 구현 완료 (Phase B-4)

**필요 추가 필드** (사례 학습 기반):
- `smokingStatus` (흡연 중 / 금연 / 비흡연) ★ COPD 인과관계 핵심
- `smokingPacks`, `smokingYears`, `exSmokingYears` (흡연력 상세)
- `prePensionResidence` (조선소 취업 이전 거주지) — 환경 노출 변수

### 진폐 (91건 OCR)
**현재 상태**: Prisma 모델 + UI 구현 완료 (Phase B-4)

**필요 추가 필드**:
- `examDate` (정밀진단실시일)
- `complications` JSON (진폐결핵, 폐기종, 진폐심부전 등)
- `pneumoconiosisGrade` (1~4형)
- `hasWelfareGrant` (재해위로금 — 2010.11.21 진폐근로자보호법 개정 이후)

### 근골격계 (113건 OCR) ⏳
**현재 상태**: Prisma 모델 존재, UI **미구현**

**필요 추가 필드**:
- `bodyPart` (어깨/무릎/허리 등)
- `injuryDescription` (구체적 상해)
- `restTimePattern` (휴식시간 — 1일 N회, 1회 N분)
- `qualityReviewStatus` (질병판정위원회 진행 상태)
- `concurrentDiseases` (동반 상병 — 소음성 난청 동반 다수)

### 업무상사고 ⏳ (UI 미구현)
근골격계 패턴과 동일 구조 — 같은 패턴으로 빠른 구현 가능

### 직업성암 (52건, 폐암 중심) ⏳
**필요 추가 필드**:
- `cancerType` (폐암/혈액암/방광암 등)
- `concurrentDiseases` — **폐암+COPD+난청 동반 청구 다수 발견** ★

### 유족급여 (49건, 100% 텍스트 확보)
**현재 상태**: Prisma 모델 + UI 구현 완료 (Phase B-4)

**필요 추가 필드**:
- `deceasedName`, `deceasedRRN` (재해자 정보)
- `immediateCauseOfDeath` (직접사인 — 예: "폐럼")
- `underlyingCauseOfDeath` (의원인)
- `funeralMethod` (화장/매장), `funeralDate`
- `relationshipToDeceased` (사망자와의 관계)
- `livingTogetherFlag` (생계를 같이하였는지)

---

## 4. 평균임금 자동 인입 파이프라인 (★★★ 핵심)

### 4.1 구현 현황
- ✅ AvgWageNotice 모델 (Prisma, 23개 필드)
- ✅ 정규식 파서 (`lib/avg-wage-parser.ts`)
- ✅ Document AI OCR 라우트 (`/api/avg-wage/parse`)
- ✅ 정정청구 트리거 룰
- ✅ UI (`/wage/avg-wage`)
- ✅ WageReviewData 변환 (`/api/avg-wage/[id]/promote`)
- ✅ 정정청구서 PDF 생성 (`/api/avg-wage/[id]/correction-pdf`)

### 4.2 데이터 흐름
```
공단 → 평균임금산정내역서 PDF (정보공개 청구로 수령)
   ↓
[1] PDF 업로드 (/wage/avg-wage)
   ↓
[2] Document AI OCR
   ↓
[3] parseAvgWageNotice (정규식) — 23개 필드 추출
   ↓
[4] AvgWageNotice INSERT
   ↓
[5] 정정청구 트리거 룰 적용
   if (finalAvgWage / max(baseAvgWage, statWageBase) < 0.95)
     → needsCorrection = true
   ↓
[6] UI 표시 — 🚨 검토필요 / ✅ 정상 / ⚠️ 판정불가
   ↓
[7] (옵션) 노무사 검토 → "변환" → WageReviewData 생성
   ↓
[8] (옵션) "정정청구서 PDF" → 자동 작성된 청구서 다운로드
```

### 4.3 OCR 정확도
- Tesseract tessdata_best (단일 OCR 검증): 35-45% 필드 추출
- Document AI (production): 70-90% 예상 — 미실측, 배포 페이지에서 검증 필요

---

## 5. 신규 자동생성 양식 5종 (Phase B-3 완료)

### 공통 인프라
```
lib/text-form-pdf.ts          — pdf-lib + NotoSansKR 텍스트 PDF
lib/text-form-templates.ts    — 양식별 spec 빌더
/api/forms/text-pdf           — 범용 라우트
```

### 5종 양식
1. **평균임금정정청구서** — `/api/avg-wage/[id]/correction-pdf` (별도 라우트)
2. **심사청구서** — `/forms/objection/exam-claim`
3. **재심사청구서** — `/forms/objection/reexam-claim`
4. **추가상병 신청서** — `/forms/objection/additional-injury`
5. **재요양 신청서** — `/forms/objection/requote`

### 추후 공단 표준 양식 PDF 입수 시
`public/forms/`에 추가 + `lib/formFields.ts`에 좌표 매핑 → 좌표 기반 양식으로 마이그레이션 가능

---

## 6. 분류기 v2 룰 (false positive 해결)

`C:\Users\jjakg\AppData\Local\Temp\tbss_form_analysis\index\classify_v2.py` 참조

### NEGATIVE 키워드 (분류 제외)
- `ADDITIONAL_INJURY_CLAIM`: "규정\(", "이 규정", "고시 N호" → 규정 본문에 단어 등장하는 경우 제외
- `CASE_CONTRACT`: "임금계약서", "기본급산정시간", "총연봉" → 직원 임금계약서 분리

### 신규 패턴
- `INFO_DISCLOSURE_DECISION` — 정보공개 결정통지서
- `INFO_DISCLOSURE_BUNDLE` — 정보공개로 받은 자료 묶음
- `WAGE_CONTRACT_EMPLOYEE` — 직원 임금계약서 (학습 외)

---

## 7. 다음 학습 작업 (오늘 저녁 예정)

### 7.1 OCR retry (290건)
- Phase 3 후반 Tesseract 메모리 누수로 실패한 파일들
- 1000건 단위 배치 + 워커 cycle로 안정화 후 retry

### 7.2 보충 학습 후보
- OneDrive `6) 운영, 관리 업무` (후순위, 미처리)
- Z 드라이브 NAS 일부 (`산재자료` 131, `정보공개서류` 621 등) — 사용자 결정에 따라
- 이의제기 양식 5종 사용 후 OCR 정확도 검증
- 결정통지서 OCR 정확도 (Document AI vs Tesseract 비교)

### 7.3 학습 결과 활용
- 근골격계·사고·암 미구현 상병 UI 구현 시 양식 패턴 참조
- 결정통지서 자동 인입 시스템 구축 (Phase B-7) 기반 자료

---

## 8. 사용자가 직접 검증 필요 (배포 페이지)

- [ ] `/wage/avg-wage`에 폴더 평균임금산정내역서 업로드 → Document AI 정확도 실측
- [ ] 신규 양식 5종 PDF 다운로드 → 한국어 폰트·줄바꿈·서명란 확인
- [ ] 사이드바 4개 메뉴 정상 표시
- [ ] 진폐/COPD/유족급여 사건 상세 폼 입력·저장 동작
- [ ] 평균임금산정내역서 → WageReviewData 변환 후 변환 결과 확인

---

*다음 세션에서 작업 시작 시 본 README + `docs/양식_데이터매핑_분석.md` + `docs/작업이력_2026-04-29_30.md` 우선 읽기.*
