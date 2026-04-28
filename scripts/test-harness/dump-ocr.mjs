// Dump Document AI OCR text for a PDF (for ground truth inspection).
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { PDFDocument } from "pdf-lib"
import { DocumentProcessorServiceClient } from "@google-cloud/documentai"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function findFirst(paths) {
  for (const p of paths) if (fs.existsSync(p)) return p
  return null
}
const credPath = findFirst([
  path.resolve(__dirname, "../../tbss-494605-7be880b365d7.json"),
  "C:\\Users\\jjakg\\thebosang\\tbss-494605-7be880b365d7.json",
])
const credentials = JSON.parse(fs.readFileSync(credPath, "utf-8"))
const docAIClient = new DocumentProcessorServiceClient({ credentials })
const PROCESSOR = "projects/708185796658/locations/us/processors/bf9e989935948e63"

const pdfPath = process.argv[2]
if (!pdfPath) { console.error("Usage: node dump-ocr.mjs <pdf>"); process.exit(1) }

const buffer = fs.readFileSync(pdfPath)
const srcDoc = await PDFDocument.load(buffer)
const totalPages = srcDoc.getPageCount()
console.log(`PDF: ${path.basename(pdfPath)} (${totalPages}p)`)

// Split into N-page chunks (default 5)
const CHUNK_PAGES = Number(process.argv[3] ?? 5)
const outDir = path.resolve(__dirname, "ocr-dumps", path.basename(pdfPath, ".pdf") + `-${CHUNK_PAGES}p`)
fs.mkdirSync(outDir, { recursive: true })

for (let start = 0; start < totalPages; start += CHUNK_PAGES) {
  const end = Math.min(start + CHUNK_PAGES, totalPages)
  const chunkDoc = await PDFDocument.create()
  const copied = await chunkDoc.copyPages(
    srcDoc,
    Array.from({ length: end - start }, (_, k) => start + k)
  )
  copied.forEach((p) => chunkDoc.addPage(p))
  const bytes = await chunkDoc.save()
  const base64 = Buffer.from(bytes).toString("base64")

  const t = Date.now()
  const [result] = await docAIClient.processDocument({
    name: PROCESSOR,
    rawDocument: { content: base64, mimeType: "application/pdf" },
  })
  const text = result.document?.text ?? ""
  console.log(`  p${start + 1}-${end}: OCR ${Date.now() - t}ms, ${text.length}자`)

  fs.writeFileSync(path.join(outDir, `p${start + 1}-${end}.txt`), text)
}

console.log(`\n출력: ${outDir}`)
