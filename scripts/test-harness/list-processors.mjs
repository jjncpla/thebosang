// List all Document AI processors for the project
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { DocumentProcessorServiceClient } from "@google-cloud/documentai"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const credPath = "C:\\Users\\jjakg\\thebosang\\tbss-494605-7be880b365d7.json"
const credentials = JSON.parse(fs.readFileSync(credPath, "utf-8"))
const client = new DocumentProcessorServiceClient({ credentials })

const parent = "projects/708185796658/locations/us"
const [processors] = await client.listProcessors({ parent })

for (const p of processors) {
  console.log(`${p.displayName} | ${p.type} | ${p.name}`)
}
