#!/usr/bin/env bash
# Gemini OCR chain v8 — 즉시 cycle (RPD 한도 도달은 그냥 진행, error 누적 시 사용자 결정)

WORK="/c/Users/jjakg/AppData/Local/Temp/tbss_form_analysis"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] chain v8 시작 (즉시 cycle, 5초 sleep)" >> "$WORK/index/gemini_ocr_chain.log"

for cycle in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] cycle ${cycle} 시작" >> "$WORK/index/gemini_ocr_chain.log"
  cd /c/Users/jjakg/thebosang
  node scripts/ocr-via-gemini.mjs >> "$WORK/index/gemini_ocr_chain.log" 2>&1
  if grep -q 'ALL DONE' "$WORK/index/scan_ocr_gemini_progress.txt" 2>/dev/null; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] OCR 전체 완료" >> "$WORK/index/gemini_ocr_chain.log"
    break
  fi
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] cycle ${cycle} 종료 → 5초 후 다음" >> "$WORK/index/gemini_ocr_chain.log"
  sleep 5
done
echo "[$(date '+%Y-%m-%d %H:%M:%S')] chain v8 종료" >> "$WORK/index/gemini_ocr_chain.log"
