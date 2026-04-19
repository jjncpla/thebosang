/**
 * 울산권역 승불자 관리파일 (xlsm) → ObjectionReview 일괄 주입 스크립트
 *
 * 사용:
 *   DATABASE_URL="..." ts-node scripts/import-ulsan-review.ts [xlsx-path]
 *
 * 기본 소스: 'Z:/노무법인 더보상/The보상/0. 최초팀 공유/더보상 울산동부지사/1. 울산권역 승불자 관리파일(동작 파일).xlsm'
 * 매칭키: (tfName, patientName, caseType, decisionDate)
 */
import { PrismaClient } from "@prisma/client";
import XLSX from "xlsx";

const prisma = new PrismaClient();

// TF 표기 → 시스템 TF 이름
const TF_MAP: Record<string, string> = {
  "울산": "더보상울산TF",
  "울동": "더보상울동TF",
  "울산동부": "이산울산동부TF",
  "울산남부": "이산울산남부TF",
  "울산북부": "이산울산북부TF",
  "양산": "이산양산TF",
  "울산동부,구미": "이산울산동부TF", // 데이터 이상치 — 울산동부로 흡수
};

// 사건분류 자유입력 → 우리 시스템 CaseType 코드
function mapCaseType(raw: string | null | undefined): string {
  if (!raw) return "OTHER";
  const s = String(raw).trim();
  if (!s) return "OTHER";
  if (/유족|중피종 유족|혈액암 유족|폐암유족|진폐유족|업무상사고 유족|COPD 유족/.test(s)) return "BEREAVED";
  if (/난청/.test(s)) return "HEARING_LOSS";
  if (/진폐|간질성 폐|폐섬유화/.test(s)) return "PNEUMOCONIOSIS";
  if (/COPD/i.test(s)) return "COPD";
  if (/근골격|무릎|요추|어깨|허리|전립선 장해|장해/.test(s) && !/유족|암/.test(s)) return "MUSCULOSKELETAL";
  if (/업무상사고|출퇴근|업무상 사고|재요양/.test(s) && !/근골격/.test(s)) return "OCCUPATIONAL_ACCIDENT";
  if (/암|백혈병|갑상선|침샘|파킨슨|PTSD|과로|뇌심|정신질환/.test(s)) return "OCCUPATIONAL_CANCER";
  return "OTHER";
}

// 사건진행여부 문자열 정규화
function normalizeProgress(raw: string | null | undefined): string {
  if (!raw) return "";
  const s = String(raw).trim();
  if (!s) return "";
  if (s === "이의제기진행중") return "이의제기 진행";
  // 정공 컬럼 값이 이 컬럼에 잘못 들어간 케이스
  if (s === "확보") return "검토중";
  // 다음 값들은 사용자 정의 enum 밖 → 데이터 보존 차원에서 그대로 둠
  // 종결/검토중/이의제기 진행/평정청구 진행/송무 검토/송무 인계/장해청구예정/휴업청구/보류
  return s;
}

function normalizeInfo(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const allowed = ["요청", "요청중", "확보", "평임확보", "평임 부존재", "불필요"];
  return allowed.includes(s) ? s : s; // 그 외 값도 그대로 보존
}

function parseDate(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;
  // "2023/12/22" or "2023-12-22" 등
  const m = s.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/);
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    if (!isNaN(d.getTime())) return d;
  }
  const d2 = new Date(s);
  if (!isNaN(d2.getTime())) return d2;
  return null;
}

async function main() {
  const xlsxPath =
    process.argv[2] ??
    "C:\\Users\\jjakg\\AppData\\Local\\Temp\\xlsx\\work.xlsm";

  console.log("📂 xlsm 로드:", xlsxPath);
  const wb = XLSX.readFile(xlsxPath);
  const ws = wb.Sheets["최초총현황"];
  if (!ws) {
    throw new Error("'최초총현황' 시트를 찾을 수 없습니다");
  }
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    raw: false,
    defval: null,
  });

  // header row: index 1 ['승인여부','TF','성명','사건 분류','처분일','사건 진행 여부','정공']
  const rows = aoa.slice(2).filter(r => Array.isArray(r) && r.some(v => v !== null && String(v).trim() !== ""));
  console.log(`📊 유효 데이터 행: ${rows.length}`);

  const counters = {
    created: 0,
    updated: 0,
    skipped_no_approval: 0,
    skipped_no_name: 0,
    skipped_tf_unknown: 0,
    skipped_bad_approval: 0,
  };

  // 1) 전처리: 파싱 + 유효행만 모음
  type Parsed = {
    tfName: string; patientName: string; caseType: string;
    approvalStatus: string; progressStatus: string; decisionDate: Date | null;
    hasInfoDisclosure: boolean; infoDisclosureStatus: string | null;
  };
  const parsed: Parsed[] = [];
  for (const row of rows) {
    const [approvalRaw, tfRaw, nameRaw, caseTypeRaw, decisionRaw, progressRaw, infoRaw] = row as (string | null)[];
    const patientName = nameRaw ? String(nameRaw).trim() : "";
    const approval = approvalRaw ? String(approvalRaw).trim() : "";
    const tfDisplay = tfRaw ? String(tfRaw).trim() : "";
    if (!patientName) { counters.skipped_no_name++; continue; }
    if (!approval) { counters.skipped_no_approval++; continue; }
    if (!["승인", "불승인", "일부승인"].includes(approval)) { counters.skipped_bad_approval++; continue; }
    const tfName = TF_MAP[tfDisplay] ?? null;
    if (!tfName) { counters.skipped_tf_unknown++; continue; }
    const caseType = mapCaseType(caseTypeRaw);
    const progressStatus = normalizeProgress(progressRaw);
    const infoDisclosureStatus = normalizeInfo(infoRaw);
    const decisionDate = parseDate(decisionRaw);
    parsed.push({
      tfName, patientName, caseType,
      approvalStatus: approval, progressStatus, decisionDate,
      hasInfoDisclosure: infoDisclosureStatus === "확보" || infoDisclosureStatus === "평임확보",
      infoDisclosureStatus,
    });
  }
  console.log(`📌 파싱 완료: ${parsed.length}건 (스킵 ${counters.skipped_no_name + counters.skipped_no_approval + counters.skipped_bad_approval + counters.skipped_tf_unknown}건)`);

  // 2) 기존 매칭 행을 한 번에 조회 (대상 TF 전체)
  const tfSet = Array.from(new Set(parsed.map(p => p.tfName)));
  const existingRows = await prisma.objectionReview.findMany({
    where: { tfName: { in: tfSet } },
    select: { id: true, tfName: true, patientName: true, caseType: true, decisionDate: true },
  });
  const keyOf = (r: { tfName: string; patientName: string; caseType: string; decisionDate: Date | null }) =>
    `${r.tfName}|${r.patientName}|${r.caseType}|${r.decisionDate ? r.decisionDate.toISOString().slice(0, 10) : "NULL"}`;
  const existingMap = new Map(existingRows.map(r => [keyOf(r), r.id]));
  console.log(`🔎 기존 레코드: ${existingRows.length}건 매칭 캐시`);

  // 3) 신규 = createMany bulk / 기존 = 병렬 update
  const toCreate: Parsed[] = [];
  const toUpdate: { id: string; data: Parsed }[] = [];
  for (const p of parsed) {
    const id = existingMap.get(keyOf(p));
    if (id) toUpdate.push({ id, data: p });
    else toCreate.push(p);
  }
  console.log(`📥 신규 ${toCreate.length}건 / 업데이트 ${toUpdate.length}건`);

  // createMany (대용량 일괄)
  if (toCreate.length > 0) {
    const CHUNK = 200;
    for (let i = 0; i < toCreate.length; i += CHUNK) {
      const chunk = toCreate.slice(i, i + CHUNK);
      const res = await prisma.objectionReview.createMany({ data: chunk });
      counters.created += res.count;
      console.log(`  + createMany ${i + chunk.length}/${toCreate.length}`);
    }
  }

  // update 병렬 (한 번에 10개씩)
  const UPARA = 10;
  for (let i = 0; i < toUpdate.length; i += UPARA) {
    const batch = toUpdate.slice(i, i + UPARA);
    await Promise.all(batch.map(u =>
      prisma.objectionReview.update({ where: { id: u.id }, data: u.data }).then(() => { counters.updated++; })
    ));
  }

  console.log("✅ 완료", counters);
  const total = await prisma.objectionReview.count();
  console.log(`💾 현재 ObjectionReview 총 ${total}건`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
