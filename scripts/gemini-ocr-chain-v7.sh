#!/usr/bin/env bash
# Gemini OCR chain v7 — RPD aware
# 한국 16:00 (PT 자정) RPD 리셋 시점에 cycle 시작.

WORK="/c/Users/jjakg/AppData/Local/Temp/tbss_form_analysis"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] chain v7 시작 — RPD aware" >> "$WORK/index/gemini_ocr_chain.log"

# 한국 16:00까지 대기
while true; do
  hour=$(date +%H)
  if [ "$hour" -ge 16 ] && [ "$hour" -lt 17 ]; then
    break
  fi
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] 현재 ${hour}시 → 16:00 대기 중" >> "$WORK/index/gemini_ocr_chain.log"
  sleep 600
done

# RPD 리셋 후 cycle 가동
for cycle in 1 2 3 4 5 6 7 8 9 10; do
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] cycle ${cycle} 시작" >> "$WORK/index/gemini_ocr_chain.log"
  cd /c/Users/jjakg/thebosang
  node scripts/ocr-via-gemini.mjs >> "$WORK/index/gemini_ocr_chain.log" 2>&1
  if grep -q 'ALL DONE' "$WORK/index/scan_ocr_gemini_progress.txt" 2>/dev/null; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] OCR 전체 완료" >> "$WORK/index/gemini_ocr_chain.log"
    break
  fi
  # 다음 16:00 (다음날 PT 자정)까지 대기
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] cycle ${cycle} 종료 → 다음 16:00 대기" >> "$WORK/index/gemini_ocr_chain.log"
  sleep 60
  while true; do
    hour=$(date +%H)
    if [ "$hour" -ge 16 ] && [ "$hour" -lt 17 ]; then
      break
    fi
    sleep 1800
  done
done
echo "[$(date '+%Y-%m-%d %H:%M:%S')] chain v7 종료" >> "$WORK/index/gemini_ocr_chain.log"
