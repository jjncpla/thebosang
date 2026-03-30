import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// ─── Synology File Station API helpers ───
async function synoLogin(nasUrl: string): Promise<string | null> {
  const account = process.env.NAS_ACCOUNT;
  const password = process.env.NAS_PASSWORD;
  if (!account || !password) return null;

  try {
    const url = `${nasUrl}/webapi/auth.cgi?api=SYNO.API.Auth&version=3&method=login&account=${encodeURIComponent(account)}&passwd=${encodeURIComponent(password)}&session=FileStation&format=sid`;
    const res = await fetch(url);
    const data = await res.json();
    return data?.data?.sid || null;
  } catch {
    return null;
  }
}

async function synoListFolders(nasUrl: string, sid: string, folderPath: string): Promise<string[]> {
  try {
    const url = `${nasUrl}/webapi/entry.cgi?api=SYNO.FileStation.List&version=2&method=list&folder_path=${encodeURIComponent(folderPath)}&_sid=${sid}`;
    const res = await fetch(url);
    const data = await res.json();
    if (!data?.data?.files) return [];
    return data.data.files
      .filter((f: { isdir: boolean }) => f.isdir)
      .map((f: { name: string }) => f.name);
  } catch {
    return [];
  }
}

async function synoLogout(nasUrl: string, sid: string) {
  try {
    await fetch(`${nasUrl}/webapi/auth.cgi?api=SYNO.API.Auth&version=3&method=logout&session=FileStation&_sid=${sid}`);
  } catch {
    // ignore
  }
}

// ─── Folder name parser ───
function parseNasFolderName(folderName: string) {
  const parts = folderName.split("_");
  if (parts.length < 2) return null;

  const dateStr = parts[0]; // YYMMDD
  const nameRaw = parts[1]; // 박복수3
  const status = parts[2] || "";
  const region = parts[3] || "";

  const name = nameRaw.replace(/\d+$/, "");
  const duplicateIndex = parseInt(nameRaw.match(/\d+$/)?.[0] || "1");

  if (!dateStr || dateStr.length !== 6 || !name) return null;

  const year = parseInt(dateStr.slice(0, 2)) + 2000;
  const month = dateStr.slice(2, 4);
  const day = dateStr.slice(4, 6);
  const parsedDate = `${year}-${month}-${day}`;

  return { name, duplicateIndex, status, region, parsedDate, folderName };
}

export async function POST(req: NextRequest) {
  try {
    const { nasUrl, rootPath } = await req.json();
    if (!nasUrl || !rootPath) {
      return NextResponse.json({ error: "nasUrl과 rootPath가 필요합니다." }, { status: 400 });
    }

    // Login to Synology
    const sid = await synoLogin(nasUrl);
    if (!sid) {
      return NextResponse.json({ error: "NAS 로그인 실패. 환경변수(NAS_ACCOUNT, NAS_PASSWORD)를 확인하세요." }, { status: 500 });
    }

    try {
      // Get year subfolders (e.g. 2025년, 2024년)
      const yearFolders = await synoListFolders(nasUrl, sid, rootPath);
      let allFolderNames: { name: string; parentPath: string }[] = [];

      if (yearFolders.length > 0) {
        // Scan each year subfolder
        for (const yf of yearFolders) {
          const yearPath = `${rootPath}/${yf}`;
          const caseFolders = await synoListFolders(nasUrl, sid, yearPath);
          for (const cf of caseFolders) {
            allFolderNames.push({ name: cf, parentPath: yearPath });
          }
        }
      }

      // If no year subfolders, scan root directly
      if (allFolderNames.length === 0) {
        const directFolders = await synoListFolders(nasUrl, sid, rootPath);
        for (const df of directFolders) {
          allFolderNames.push({ name: df, parentPath: rootPath });
        }
      }

      // Parse each folder and match to patients
      const folders = [];
      for (const { name: folderName, parentPath } of allFolderNames) {
        const parsed = parseNasFolderName(folderName);
        if (!parsed) continue;

        const nasPath = `${parentPath}/${folderName}`;

        // Search patients by name
        const patients = await prisma.patient.findMany({
          where: { name: parsed.name },
          include: {
            cases: {
              select: {
                id: true,
                caseType: true,
                branch: true,
              },
            },
          },
        });

        if (patients.length === 0) {
          folders.push({
            folderName,
            parsedName: parsed.name,
            parsedDate: parsed.parsedDate,
            parsedRegion: parsed.region,
            nasPath,
            status: "NOT_FOUND" as const,
            candidates: [],
          });
        } else if (patients.length === 1 && patients[0].cases.length === 1) {
          folders.push({
            folderName,
            parsedName: parsed.name,
            parsedDate: parsed.parsedDate,
            parsedRegion: parsed.region,
            nasPath,
            status: "AUTO" as const,
            candidates: [],
            matchedPatientId: patients[0].id,
            matchedCaseId: patients[0].cases[0].id,
          });
        } else {
          // Multiple patients or multiple cases → CONFLICT
          const candidates = patients.flatMap((p) =>
            p.cases.map((c) => ({
              patientId: p.id,
              patientName: p.name,
              caseId: c.id,
              caseType: c.caseType,
              branch: c.branch || "",
            }))
          );
          folders.push({
            folderName,
            parsedName: parsed.name,
            parsedDate: parsed.parsedDate,
            parsedRegion: parsed.region,
            nasPath,
            status: candidates.length > 0 ? ("CONFLICT" as const) : ("NOT_FOUND" as const),
            candidates,
          });
        }
      }

      return NextResponse.json({ total: folders.length, folders });
    } finally {
      await synoLogout(nasUrl, sid);
    }
  } catch (err) {
    console.error("[POST /api/nas/scan]", err);
    return NextResponse.json({ error: "스캔 오류" }, { status: 500 });
  }
}
