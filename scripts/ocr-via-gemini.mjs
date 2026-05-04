#!/usr/bin/env node
/**
 * Gemini 2.5 Flash로 학습용 PDF OCR 처리.
 *
 * 입력: scan_ocr_queue.jsonl (필터링된 PDF 큐)
 * 출력: ocr/{hash}.txt (Tesseract 결과와 같은 위치)
 *
 * 사용법:
 *   .env에 GEMINI_API_KEY 추가 (Railway에서 복사) 후
 *   node scripts/ocr-via-gemini.mjs
 *
 * 안전:
 *   - 이미 ocr/{hash}.txt 있으면 skip (재실행 안전)
 *   - 5 병렬 요청 (rate limit 고려)
 *   - 1000건 batch 후 종료 (재실행으로 다음 batch)
 *   - 실패 자동 재시도 3회
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { GoogleGenAI } from "@google/genai";

// .env 직접 파싱 (메인 디렉토리)
function loadEnv(envPath) {
  if (!fs.existsSync(envPath)) return;
  const raw = fs.readFileSync(envPath, "utf-8");
  for (const line of raw.split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) {
      let v = m[2];
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      process.env[m[1]] = v;
    }
  }
}
loadEnv(path.join(process.cwd(), ".env"));
loadEnv(String.raw`C:\Users\jjakg\thebosang\.env`);

const WORK = String.raw`C:\Users\jjakg\AppData\Local\Temp\tbss_form_analysis`;
const QUEUE = path.join(WORK, "index", "scan_ocr_queue.jsonl");
const STATUS_OUT = path.join(WORK, "index", "scan_ocr_status_gemini.jsonl");
const PROGRESS = path.join(WORK, "index", "scan_ocr_gemini_progress.txt");
const OCR_DIR = path.join(WORK, "ocr");

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("ERROR: GEMINI_API_KEY 환경변수가 없습니다. .env에 추가하세요.");
  console.error("Railway 대시보드에서 GEMINI_API_KEY 값 복사 → C:\\Users\\jjakg\\thebosang\\.env에 추가");
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });
const MODEL = "gemini-2.5-flash";
// 무료 티어 안전 모드: RPM 15 / RPD 1,500
// CONCURRENCY 1 + 매 요청 5초 간격 = 12 RPM (안전 마진)
const CONCURRENCY = 1;
const REQUEST_INTERVAL_MS = 5_000; // 매 요청 후 5초 간격
const MAX_BATCH = 1400; // RPD 1500 안전 마진
const MAX_RETRIES = 3;
const TIMEOUT_MS = 90_000;

const PROMPT = `이 PDF 문서의 전체 텍스트를 한국어로 정확히 추출하세요. 표는 행/열 구조를 보존하고, 도장·서명·필기 메모도 가능한 한 옮기되 인쇄된 본문이 우선입니다. 머리말·꼬리말·페이지 번호도 포함하세요. 추가 설명 없이 추출된 텍스트만 출력하세요.`;

function fileHash(p) {
  return crypto.createHash("sha1").update(p, "utf-8").digest("hex").slice(0, 16);
}

function readJsonl(file) {
  const lines = fs.readFileSync(file, "utf-8").split("\n").filter((l) => l.trim());
  return lines.map((l) => JSON.parse(l));
}

async function callGemini(pdfBuf, attempt = 0) {
  try {
    const base64 = pdfBuf.toString("base64");
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const result = await ai.models.generateContent({
        model: MODEL,
        contents: [
          {
            role: "user",
            parts: [
              { inlineData: { mimeType: "application/pdf", data: base64 } },
              { text: PROMPT },
            ],
          },
        ],
        config: { temperature: 0, maxOutputTokens: 32768 },
      });
      clearTimeout(t);
      return result.text || "";
    } finally {
      clearTimeout(t);
    }
  } catch (e) {
    if (attempt < MAX_RETRIES) {
      const wait = 5000 * Math.pow(2, attempt);
      await new Promise((r) => setTimeout(r, wait));
      return callGemini(pdfBuf, attempt + 1);
    }
    throw e;
  }
}

async function processOne(item) {
  const src = item.path;
  const h = item.hash || fileHash(src);
  const out = path.join(OCR_DIR, `${h}.txt`);
  if (fs.existsSync(out) && fs.statSync(out).size > 50) {
    return { ...item, status: "ocr_text_cached", hash: h, size: fs.statSync(out).size };
  }
  if (!fs.existsSync(src)) {
    return { ...item, status: "src_missing", hash: h };
  }
  try {
    const buf = fs.readFileSync(src);
    if (buf.length > 20 * 1024 * 1024) {
      return { ...item, status: "too_large", hash: h, size: buf.length };
    }
    const text = await callGemini(buf);
    fs.mkdirSync(OCR_DIR, { recursive: true });
    fs.writeFileSync(out, text, "utf-8");
    return { ...item, status: text.length > 50 ? "ocr_text" : "ocr_empty", size: text.length, hash: h };
  } catch (e) {
    return { ...item, status: "error", msg: String(e).slice(0, 200), hash: h };
  }
}

async function main() {
  fs.mkdirSync(OCR_DIR, { recursive: true });
  const targets = readJsonl(QUEUE);
  const total = targets.length;

  // 이미 처리된 hash 집합
  const done = new Set();
  if (fs.existsSync(STATUS_OUT)) {
    for (const line of fs.readFileSync(STATUS_OUT, "utf-8").split("\n")) {
      if (!line.trim()) continue;
      try {
        const r = JSON.parse(line);
        if (r.hash) done.add(r.hash);
      } catch {}
    }
  }
  const pending = targets.filter((t) => !done.has(t.hash || fileHash(t.path)));
  console.log(`queue: ${total} / 처리됨: ${done.size} / 남음: ${pending.length}`);
  if (!pending.length) {
    fs.writeFileSync(PROGRESS, `[ALL DONE] queue=${total} processed=${done.size}\n`);
    return;
  }

  const batch = pending.slice(0, MAX_BATCH);
  console.log(`이번 배치: ${batch.length}건 (CONCURRENCY=${CONCURRENCY})`);

  const start = Date.now();
  const byStatus = {};
  const fout = fs.createWriteStream(STATUS_OUT, { flags: "a" });
  let processed = 0;

  // 무료 티어: 단일 worker + interval 보장
  // 캐시 skip 등 API 호출 안 한 경우는 즉시 다음으로 (RPM 제한 안 적용)
  const NO_API_STATUSES = new Set(["ocr_text_cached", "src_missing", "too_large"]);
  const queue = [...batch];
  async function worker() {
    while (queue.length) {
      const it = queue.shift();
      const reqStart = Date.now();
      const rec = await processOne(it);
      fout.write(JSON.stringify(rec) + "\n");
      processed++;
      const s = rec.status || "?";
      byStatus[s] = (byStatus[s] || 0) + 1;
      const elapsed = (Date.now() - start) / 1000;
      const rate = processed / elapsed;
      const eta = (pending.length - processed) / rate;
      const msg = `[batch ${processed}/${batch.length} | total ${done.size + processed}/${total}] elapsed=${elapsed.toFixed(0)}s rate=${rate.toFixed(2)}/s eta_total=${eta.toFixed(0)}s status=${JSON.stringify(byStatus)}`;
      fs.writeFileSync(PROGRESS, msg + "\n");
      if (processed % 50 === 0 || processed === batch.length) console.log(msg);
      // API 호출했을 때만 RPM 제한 적용 (캐시는 즉시 skip)
      if (!NO_API_STATUSES.has(s)) {
        const reqElapsed = Date.now() - reqStart;
        if (reqElapsed < REQUEST_INTERVAL_MS && queue.length > 0) {
          await new Promise((r) => setTimeout(r, REQUEST_INTERVAL_MS - reqElapsed));
        }
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  fout.end();
  console.log(`\n배치 완료: ${JSON.stringify(byStatus)}`);
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
