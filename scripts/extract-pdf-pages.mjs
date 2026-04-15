/**
 * PDF 페이지 추출 스크립트
 * 사용: node scripts/extract-pdf-pages.mjs
 *
 * 필요한 파일이 public/forms/에 있어야 함:
 *   - 정보공개청구서_공란.pdf (위임장 포함 다중 페이지)
 *   - 분진작업종사사실확인서_공란.pdf (별지17호 포함)
 */

import { PDFDocument } from 'pdf-lib';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FORMS_DIR = join(__dirname, '..', 'public', 'forms');

async function extractPage(srcFile, pageIndex, destFile, label) {
  const srcPath = join(FORMS_DIR, srcFile);
  const destPath = join(FORMS_DIR, destFile);

  if (!existsSync(srcPath)) {
    console.log(`⚠️  소스 없음: ${srcFile} — 건너뜀`);
    return;
  }
  if (existsSync(destPath)) {
    console.log(`✅ 이미 존재: ${destFile}`);
    return;
  }

  const srcBytes = readFileSync(srcPath);
  const srcDoc = await PDFDocument.load(srcBytes);
  const totalPages = srcDoc.getPageCount();

  if (pageIndex >= totalPages) {
    console.log(`⚠️  ${label}: 페이지 ${pageIndex + 1}번 없음 (총 ${totalPages}페이지)`);
    return;
  }

  const newDoc = await PDFDocument.create();
  const [copiedPage] = await newDoc.copyPages(srcDoc, [pageIndex]);
  newDoc.addPage(copiedPage);

  const newBytes = await newDoc.save();
  writeFileSync(destPath, newBytes);
  console.log(`✅ 생성 완료: ${destFile}  (${label}, ${pageIndex + 1}페이지)`);
}

async function main() {
  console.log('PDF 페이지 추출 시작...\n');

  // 정보공개청구서 → 위임장 (마지막 페이지 또는 2번째 페이지 — 실제 파일 확인 필요)
  // info_disclosure.pdf가 이미 1페이지짜리면 별도 원본 파일 필요
  await extractPage(
    'info_disclosure.pdf',   // 소스: 위임장이 포함된 다중 페이지 정보공개청구서
    1,                        // 0-indexed: 2번째 페이지 = 위임장 (조정 필요)
    'info_disclosure_proxy.pdf',
    '정보공개 위임장'
  );

  // 분진작업종사사실확인서 → 별지17호 (2번째 페이지)
  await extractPage(
    'dust_work_confirm_source.pdf',  // 소스: 2페이지짜리 원본 PDF
    1,                                // 0-indexed: 2번째 페이지 = 별지17호
    'dust_work_confirm.pdf',
    '분진작업종사사실확인서 별지17호'
  );

  console.log('\n완료. public/forms/ 내용:');
  const { readdirSync } = await import('fs');
  readdirSync(FORMS_DIR).forEach(f => console.log(' ', f));
}

main().catch(console.error);
