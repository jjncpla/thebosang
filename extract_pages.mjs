import { PDFDocument } from 'pdf-lib'
import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'fs'

async function extractPage(srcPath, destPath, pageIndex) {
  if (!existsSync(srcPath)) {
    console.error('소스 파일 없음:', srcPath)
    return
  }
  const srcBytes = readFileSync(srcPath)
  const srcDoc = await PDFDocument.load(srcBytes)
  const totalPages = srcDoc.getPageCount()
  console.log(`${srcPath} — 총 ${totalPages}페이지`)

  if (pageIndex >= totalPages) {
    console.error(`페이지 ${pageIndex + 1} 없음 (총 ${totalPages}페이지)`)
    return
  }

  const newDoc = await PDFDocument.create()
  const [page] = await newDoc.copyPages(srcDoc, [pageIndex])
  newDoc.addPage(page)
  writeFileSync(destPath, await newDoc.save())
  console.log('저장 완료:', destPath)
}

const DOWNLOADS = 'C:/Users/jjakg/Downloads'
const FORMS = 'public/forms'

// 분진작업종사사실확인서 공란 2페이지(index=1) → 별지17호 추출
await extractPage(
  `${FORMS}/dust_work_confirm_source.pdf`,
  `${FORMS}/dust_work_confirm.pdf`,
  1
)

// 정보공개 위임장: 별도 공란 없으면 청구서 공란과 동일 파일로 설정
copyFileSync(
  `${FORMS}/info_disclosure.pdf`,
  `${FORMS}/info_disclosure_proxy.pdf`
)
console.log('위임장: info_disclosure.pdf 복사 완료 →', `${FORMS}/info_disclosure_proxy.pdf`)
