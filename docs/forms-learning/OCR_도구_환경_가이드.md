# OCR 도구 환경 가이드

> 다른 세션·환경에서 양식 학습 작업을 재개할 때 즉시 사용 가능한 setup·실행 가이드

## 1. 도구 환경 (1회 설치)

### 1.1 Poppler (pdftotext)
```powershell
winget install --id oschwartz10612.Poppler
```
- 설치 후 `pdftotext.exe` 위치:
  `C:\Users\jjakg\AppData\Local\Microsoft\WinGet\Packages\oschwartz10612.Poppler_*\poppler-25.07.0\Library\bin\pdftotext.exe`

### 1.2 Tesseract OCR + 한국어 언어팩
```powershell
winget install --id UB-Mannheim.TesseractOCR
```
- 설치 위치: `C:\Program Files\Tesseract-OCR\tesseract.exe`
- 한국어 언어팩 (tessdata_best 권장):
  ```
  https://github.com/tesseract-ocr/tessdata_best/raw/main/kor.traineddata    (12.5MB)
  https://github.com/tesseract-ocr/tessdata_best/raw/main/eng.traineddata   (15.4MB)
  https://github.com/tesseract-ocr/tessdata/raw/main/chi_tra.traineddata     (56MB, 한자 혼재 대응)
  https://github.com/tesseract-ocr/tessdata/raw/main/osd.traineddata          (10.5MB, 자동 설치됨)
  ```
- **중요**: `C:\Users\jjakg\tessdata\`에 보관 (Microsoft Store Python 가상화 회피)
- 환경변수: `TESSDATA_PREFIX = C:\Users\jjakg\tessdata`

### 1.3 OCRmyPDF + Python 패키지
```powershell
python -m pip install ocrmypdf pdfminer.six pyhwp pandas openpyxl xlrd
```
- `ocrmypdf.exe`: `C:\Users\jjakg\AppData\Local\Python\pythoncore-3.14-64\Scripts\ocrmypdf.exe`
- `hwp5txt.exe`: 같은 폴더

### 1.4 Native Python (Microsoft Store launcher 회피 — 핵심)
```
C:\Users\jjakg\AppData\Local\Python\pythoncore-3.14-64\python.exe
```
- 이 경로를 `$PYNATIVE` 변수로 사용
- `python` 명령은 Microsoft Store launcher (가상화 차단) — **사용 금지**

### 1.5 Document AI (Production OCR)
- Railway 환경변수에 이미 설정됨:
  - `GOOGLE_CREDENTIALS_B64`
  - `GOOGLE_DOCAI_PROCESSOR`
- TBSS API (`/api/notice/parse`, `/api/avg-wage/parse`) 자체에서 사용

---

## 2. 표준 OCR 명령어

### 2.1 단일 PDF (Tesseract)
```bash
PYNATIVE="/c/Users/jjakg/AppData/Local/Python/pythoncore-3.14-64/python.exe"
"$PYNATIVE" -m ocrmypdf \
  -l kor+eng \
  --skip-text \
  --oversample 600 \
  --tesseract-pagesegmode 6 \
  --tesseract-oem 1 \
  --sidecar OUT.txt \
  -q \
  IN.pdf OUT.pdf
```

옵션 설명:
- `--oversample 600`: DPI 600으로 강제 (인식률 ↑)
- `PSM 6`: 균일한 텍스트 블록 (한국어 표 양식 적합)
- `OEM 1`: LSTM 엔진만 (legacy 비활성)
- `--skip-text`: 이미 텍스트 레이어 있는 페이지 스킵
- `tessdata_best` 모델로 한국어 95%+ 정확도

### 2.2 일괄 OCR (병렬, 우선순위 큐)
- `tbss_form_analysis/index/run_ocr.py` 참조
- 4 워커 병렬 (CPU 8코어 환경 기준)
- ⚠️ 1000건 이상 처리 시 leptonica 메모리 누수 → 1000건 단위 cycle 권장

### 2.3 텍스트형 PDF (pdftotext, 빠름)
```bash
POPPLER="/c/Users/jjakg/AppData/Local/Microsoft/WinGet/Packages/oschwartz10612.Poppler_Microsoft.Winget.Source_8wekyb3d8bbwe/poppler-25.07.0/Library/bin"
"$POPPLER/pdftotext.exe" -layout -enc UTF-8 - - < IN.pdf > OUT.txt
```
- stdin 파이프로 한국어 파일명 인코딩 문제 우회

### 2.4 HWP 파일
```bash
HWP5TXT="/c/Users/jjakg/AppData/Local/Python/pythoncore-3.14-64/Scripts/hwp5txt.exe"
# 한국어 파일명 우회: 임시 ASCII 경로 복사 후 호출
cp "원본.hwp" "/tmp/tmp.hwp"
"$HWP5TXT" "/tmp/tmp.hwp" > OUT.txt
```

---

## 3. 작업 디렉토리 구조

### 표준 작업 디렉토리
```
C:\Users\jjakg\AppData\Local\Temp\tbss_form_analysis\
├── txt/                         # 텍스트 추출본 (해시.txt)
├── ocr/                         # OCR 결과 (해시.txt)
├── classified/                  # 분류 결과
│   ├── forms_by_type.jsonl
│   ├── form_fields_*.json (44개)
│   ├── all_form_fields_summary.md
│   ├── bundle_for_llm.md
│   └── cluster_summary.json
├── poc/                         # PoC 스크립트
└── index/
    ├── build_index.py           # 파일 인덱싱
    ├── extract_text.py          # 텍스트 추출
    ├── run_ocr.py               # OCR 일괄 처리 (병렬+우선순위)
    ├── classify_v2.py           # 분류 v2 (false positive 해결)
    ├── extract_form_fields.py   # 필드 추출
    ├── bundle_for_review.py     # LLM 자료 묶음 생성
    ├── tbss_form_map.py         # TBSS 17개 양식 매핑 정의
    ├── pipeline_v2.sh           # Phase 3-6 자동 chain
    ├── status.sh                # 진행 상황 한 번에 보기
    ├── file_index.jsonl
    ├── extract_status.jsonl
    ├── ocr_status.jsonl
    └── pipeline_log.txt
```

### 진행 상황 확인 (한 번에)
```bash
bash /c/Users/jjakg/AppData/Local/Temp/tbss_form_analysis/index/status.sh
```

---

## 4. 시행착오 트러블슈팅

### Q1. `Error opening data file kor.traineddata`
- 원인: Microsoft Store Python launcher AppContainer 가상화로 `AppData\Local\Tesseract-OCR` 차단
- 해결:
  1. tessdata를 `C:\Users\jjakg\tessdata\`로 이동
  2. native Python 직접 호출 (`$PYNATIVE`)
  3. `TESSDATA_PREFIX=C:\Users\jjakg\tessdata`

### Q2. `WinError 2: 지정된 파일을 찾을 수 없습니다` (한국어 PDF)
- 원인: subprocess가 한국어 파일명을 cp949로 인코딩 시도하다 실패
- 해결: PDF는 stdin 파이프, HWP는 임시 ASCII 파일 복사

### Q3. `pdftotext not found`
- 원인: 코드가 `Local\Programs\poppler\` 검색 (잘못)
- 해결: 정확한 winget 경로 사용 (위 2.3 참조)

### Q4. OCR 후반 모두 실패 (`pixdata_malloc fail`, exit 0xC0000005)
- 원인: leptonica 메모리 누수 + 임시 파일 992개 누적
- 해결: 1000건 단위로 OCR 종료·재시작 (워커 cycle)

### Q5. `pyhwp` 한국어 경로 처리 실패
- 해결: `tempfile.NamedTemporaryFile`로 ASCII 임시 파일 복사 후 `hwp5txt` 호출

---

## 5. 파일 인덱싱 + 추출 + 분류 자동화

### 5.1 파이프라인 실행
```bash
PYNATIVE="/c/Users/jjakg/AppData/Local/Python/pythoncore-3.14-64/python.exe"
WORK="/c/Users/jjakg/AppData/Local/Temp/tbss_form_analysis"

# Step 1: 파일 인덱싱
"$PYNATIVE" "$WORK/index/build_index.py"

# Step 2: 텍스트 추출 (PDF + HWP + XLSX)
"$PYNATIVE" "$WORK/index/extract_text.py" > "$WORK/index/extract_log.txt" 2>&1

# Step 3: 1차 분류 (텍스트 + 파일명 룰)
"$PYNATIVE" "$WORK/index/classify_v2.py"

# Step 4: OCR (스캔본만, 병렬)
"$PYNATIVE" "$WORK/index/run_ocr.py" > "$WORK/index/ocr_log.txt" 2>&1

# Step 5: 2차 분류 (OCR 텍스트 포함)
"$PYNATIVE" "$WORK/index/classify_v2.py"

# Step 6: 양식별 필드 추출
"$PYNATIVE" "$WORK/index/extract_form_fields.py"

# Step 7: LLM 보고서용 자료 묶음
"$PYNATIVE" "$WORK/index/bundle_for_review.py"
```

### 5.2 결과 확인
```bash
# 진행 상황 한 번에
bash "$WORK/index/status.sh"

# 양식별 필드 요약
cat "$WORK/classified/all_form_fields_summary.md"

# LLM용 자료 묶음 (PII 익명화)
head -200 "$WORK/classified/bundle_for_llm.md"

# 분류 통계 JSON
cat "$WORK/classified/cluster_summary.json"
```

---

## 6. 학습 데이터 소스

### 6.1 텔레그램 (1,847개 양식 후보, 학습 완료)
```
C:\Users\jjakg\Downloads\Telegram Desktop\
```
- 산재 실무 자료 핵심 (위임장, 결정통지서, 청구서, 평균임금 등)
- ChatExport 폴더 (대화 백업) 제외

### 6.2 OneDrive (학습 완료)
```
C:\Users\jjakg\OneDrive\1. 노무법인 더보상\
├── 1) 사건 접수 및 이의제기/    (2,622 — 학습 완료)
├── 2) 공단 지침/                 (97 — 학습 완료)
├── 3) 참고 자료_논문,판례/       (178 — 학습 완료)
├── 4) 법인 자료/                  (161 — 학습 완료)
├── 5) 교육 자료/                  (64 — 학습 완료)
├── 6) 운영, 관리 업무/           (미학습, 후순위)
├── 7) 개인자료/                   (제외)
└── 8) 시스템구축/                 (제외)
```

### 6.3 Z 드라이브 NAS (미학습, 보류)
```
Z:\노무법인 더보상\The보상\
├── 산재자료 (131건)
├── 정보공개서류 (621건)
├── 최초요양신청
├── 지침및처리요령
├── 재해보상법률원
├── 진폐tf접수현황
├── 의무기록
└── 더보상 기록 등 18개 폴더
```
- 사용자 결정에 따라 향후 학습 가능

---

## 7. 알려진 양식 패턴 (분류기 v2 룰 추출)

`C:\Users\jjakg\AppData\Local\Temp\tbss_form_analysis\index\classify_v2.py` 의 RULES 배열에
56개 양식 키워드 정규식 + NEGATIVE 키워드 (false positive 제외) 정의됨.

핵심 룰만 발췌:
```python
("WAGE_CORRECTION_CLAIM", r"평균임금\s*정정\s*청구\s*서|평균임금\s*변경\s*청구", 95),
("EXAM_CLAIM",            r"심사\s*청구\s*서|심사청구서", 90),
("AUDIT_DECISION_PUBLIC", r"\d{4}-심사-\d+|감사원\s*심사\s*결정", 90),
("AVG_WAGE_REPORT",       r"평균임금\s*산정\s*내역|평균임금\s*산정\s*서", 95),
("DUST_WORK_CONFIRM",     r"분진\s*작업\s*종사\s*사실\s*확인", 95),
("NOISE_WORK_CONFIRM",    r"소음\s*작업\s*종사\s*사실\s*확인", 95),
...
```

---

*본 가이드는 다음 세션·다른 환경에서 양식 학습 작업을 재개할 때 첫 참조 자료로 사용. 도구 setup·시행착오 정보가 모두 포함되어 있어 환경 구성에 30분 이내 소요.*
