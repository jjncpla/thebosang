# Gemini OCR 학습 보고서

_2026-05-05 19:30:28 자동 생성_

## 1. 진행 현황

| 항목 | 값 |
|------|-----|
| 큐 전체 | 10,590건 |
| 처리 완료 | **4,928건** (46.5%) |
| 성공 (ocr_text) | **4,438건** (90.1%) |
| 빈 결과 (ocr_empty) | 2건 |
| 캐시 (이미 처리됨) | 2,338건 |
| 실패 (error) | 485건 |
| 너무 큼 (skip) | 3건 |
| 소스 누락 | 0건 |
| 추출 텍스트 평균 | 17106 바이트/파일 |
| 누적 텍스트 | **75,917,733 바이트** (72.4 MB) |
| ocr/ 디렉토리 파일 | 9,292개 (Tesseract 결과 포함) |

## 2. 마지막 진행 메시지

```
[batch 312/1400 | total 4928/10590] elapsed=12112s rate=0.03/s eta_total=219795s status={"error":312}
```

## 3. 성공 표본 (참고용 — 파일명만)

- 진폐결정통지서.pdf (3,935 바이트)
- 유종식 평임산정내역서, 진폐근로자건강관리카드(재직중진폐x, 합리화x).pdf (151,445 바이트)
- 망 김선필 사미장 불승인 통지서.pdf (4,738 바이트)

## 4. 실패 표본 (디버깅용)

- 67 망 김승원 폐섬유증유족 자료보완 요청.pdf: ApiError: {"error":{"code":429,"message":"Your project has exceeded its monthly spending cap. Please go to AI Studio at 
- 망 권혁송 copd유족 자료보완요청.pdf: ApiError: {"error":{"code":429,"message":"Your project has exceeded its monthly spending cap. Please go to AI Studio at 
- 51 망 권중섭 진폐유족 자료보완 요청.pdf: ApiError: {"error":{"code":429,"message":"Your project has exceeded its monthly spending cap. Please go to AI Studio at 

## 5. 다음 단계

- 남은 처리: **5,662건** (약 4.0일)
- 매일 1,400건씩 자동 cycle (24h sleep)
- 사용자 알림: ALL DONE 메시지 확인 시 모든 OCR 학습 완료

## 6. 누적 비용 추정 (Gemini Flash 단가 기준)

| 항목 | 토큰 | 비용 |
|------|------|------|
| 입력 (PDF 이미지) | ~5,946,920 | $0.45 |
| 출력 (텍스트) | ~8,876,000 | $2.66 |
| **합계** | | **약 $3.11** (~₩4352) |

> 무료 티어 사용 시 실제 비용은 0원. Google AI Studio 콘솔에서 실측 권장.

