import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

export const runtime = "nodejs";

const execAsync = promisify(exec);

const FILE_MAP: Record<string, string> = {
  DISABILITY_CLAIM:   "disability_claim.pdf",
  NOISE_WORK_CONFIRM: "noise_work_confirm.pdf",
  AGENT_APPOINTMENT:  "agent_appointment.pdf",
  POWER_OF_ATTORNEY:  "power_of_attorney.pdf",
  SPECIAL_CLINIC:     "special_clinic.pdf",
  EXPERT_CLINIC:      "expert_clinic.pdf",
  WORK_HISTORY:       "work_history.pdf",
};

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const type = req.nextUrl.searchParams.get("type") ?? "";
  const page = parseInt(req.nextUrl.searchParams.get("page") ?? "1", 10);

  const fileName = FILE_MAP[type];
  if (!fileName) return new NextResponse("Unknown form type", { status: 400 });

  const pdfPath = path.join(process.cwd(), "public", "forms", fileName);
  if (!fs.existsSync(pdfPath)) {
    return new NextResponse("PDF not found", { status: 404 });
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "form-preview-"));
  const outputPrefix = path.join(tmpDir, "page");

  try {
    // pdftoppm: poppler-utils (Railway/Linux 환경)
    // -r 150: 150dpi (A4 ≈ 1240×1754px)
    await execAsync(
      `pdftoppm -r 150 -png -f ${page} -l ${page} "${pdfPath}" "${outputPrefix}"`
    );

    const files = fs.readdirSync(tmpDir).filter((f) => f.endsWith(".png"));
    if (files.length === 0) throw new Error("PNG conversion produced no output");

    const pngBuffer = fs.readFileSync(path.join(tmpDir, files[0]));
    return new NextResponse(pngBuffer, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    // fallback: pdftoppm 없는 환경(로컬 Windows)에서는 PDF 그대로 반환
    const pdfBuffer = fs.readFileSync(pdfPath);
    return new NextResponse(pdfBuffer, {
      headers: { "Content-Type": "application/pdf" },
    });
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}
