/**
 * 공인노무사 업무처리부 (LABOR_ATTORNEY_RECORD) 생성
 *
 * 좌표 입력 규칙 (사용자 스펙):
 * 1. 상호명 → 공란
 * 2. 성명(대표자) → 재해자 이름
 * 3. 생년월일 → 재해자 생년월일
 * 4. 주소 → 재해자 주소
 * 5. 직무위촉연월일 → 해당 사건 약정일
 * 6. 수수료 계약금 → 성공보수 (현재 입력 안됨 → 공란)
 * 7. 직무 요지 → 사건명 (예: 소음성 난청)
 * 8. 처리결과 → 승인/불승인/반려 등 최종 진행현황
 * 9. 특기사항 → 공란
 */
import { prisma } from "@/lib/prisma";
import { loadBlankForm, loadKoreanFont, drawText, parseDateFields } from "@/lib/pdf/formUtils";

const CASE_TYPE_KO: Record<string, string> = {
  HEARING_LOSS: "소음성 난청",
  COPD: "COPD(만성폐쇄성폐질환)",
  PNEUMOCONIOSIS: "진폐",
  MUSCULOSKELETAL: "근골격계",
  OCCUPATIONAL_ACCIDENT: "업무상 사고",
  OCCUPATIONAL_CANCER: "직업성 암",
  BEREAVED: "유족급여",
  OTHER: "기타",
};

function resolveResultLabel(status: string | null | undefined, closedReason: string | null | undefined): string {
  if (closedReason === "반려" || closedReason === "파기") return closedReason;
  switch (status) {
    case "APPROVED": return "승인";
    case "REJECTED": return "불승인";
    case "CLOSED":   return "종결";
    case "OBJECTION": return "이의제기 진행";
    case "WAGE_CORRECTION": return "평균임금 정정 진행";
    default: return "진행 중";
  }
}

export interface LaborAttorneyOptions {
  contractAmount?: string;  // 수수료 계약금 (성공보수) — 현재 수동 입력
  advanceAmount?: string;   // 선수금
}

/**
 * Case + Patient 데이터를 기반으로 공인노무사 업무처리부 PDF 바이트 생성
 */
export async function generateLaborAttorneyRecord(
  caseId: string,
  options: LaborAttorneyOptions = {}
): Promise<Uint8Array | null> {
  const caseData = await prisma.case.findUnique({
    where: { id: caseId },
    include: {
      patient: { select: { name: true, ssn: true, address: true } },
    },
  });
  if (!caseData) return null;

  const patient = caseData.patient;
  const pdfDoc = await loadBlankForm("labor_attorney_record.pdf");
  const font = await loadKoreanFont(pdfDoc);
  const page = pdfDoc.getPages()[0];

  // 생년월일: 주민번호 앞 6자리 → "YY.MM.DD"
  const ssn = patient?.ssn ?? "";
  const birthDateStr = ssn.length >= 6
    ? `${ssn.slice(0, 2)}.${ssn.slice(2, 4)}.${ssn.slice(4, 6)}`
    : "";

  // 직무위촉연월일: 약정일
  const contractDateStr = caseData.contractDate
    ? (() => { const d = parseDateFields(caseData.contractDate!); return `${d.연도}.${d.월자}.${d.일자}`; })()
    : "";

  const caseDesc = CASE_TYPE_KO[caseData.caseType ?? ""] ?? caseData.caseType ?? "";
  const resultLabel = resolveResultLabel(caseData.status, caseData.closedReason);

  // 1. 상호명 → 공란 (draw 안 함)
  // 2. 성명
  drawText(page, patient?.name ?? "", 132.5, 670, font, 9);
  // 3. 생년월일
  drawText(page, birthDateStr, 399, 671, font, 9);
  // 4. 주소
  drawText(page, patient?.address ?? "", 149, 642, font, 8);
  // 5. 직무위촉연월일
  drawText(page, contractDateStr, 163, 609, font, 9);
  // 6. 수수료 계약금 + 선수금
  drawText(page, options.contractAmount ?? "", 268, 581, font, 9);
  drawText(page, options.advanceAmount ?? "", 493, 580, font, 9);
  // 7. 직무 요지
  drawText(page, caseDesc, 67, 516, font, 9);
  // 8. 처리결과
  drawText(page, resultLabel, 66, 366, font, 9);
  // 9. 특기사항 → 공란

  return await pdfDoc.save();
}

/**
 * 생성 후 CaseAttachment로 저장 (같은 카테고리 기존 파일은 대체)
 */
export async function generateAndStoreLaborAttorneyRecord(
  caseId: string,
  uploadedById?: string
): Promise<{ created: boolean; attachmentId?: string }> {
  const pdfBytes = await generateLaborAttorneyRecord(caseId);
  if (!pdfBytes) return { created: false };

  const fileName = `공인노무사업무처리부_${new Date().toISOString().slice(0, 10)}.pdf`;
  const buffer = Buffer.from(pdfBytes);

  // 기존 LABOR_ATTORNEY_RECORD 카테고리 첨부 삭제 후 새로 생성
  await prisma.caseAttachment.deleteMany({
    where: { caseId, category: "LABOR_ATTORNEY_RECORD" },
  });

  const attachment = await prisma.caseAttachment.create({
    data: {
      caseId,
      fileName,
      fileSize: buffer.length,
      mimeType: "application/pdf",
      fileData: buffer,
      category: "LABOR_ATTORNEY_RECORD",
      description: "처분결정 시 자동 생성된 업무처리부",
      uploadedById: uploadedById ?? null,
    },
  });

  return { created: true, attachmentId: attachment.id };
}
