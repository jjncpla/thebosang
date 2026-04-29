import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { buildTextFormPdf, type TextFormSpec } from "@/lib/text-form-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 평균임금 정정청구서 PDF 생성
 *
 * 입력 (JSON 또는 query):
 *  - 추가 청구 사유 (additionalReason, optional)
 *  - 수령은행, 계좌번호, 예금주 (optional, 입력 시 PDF에 포함)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  try {
    const notice = await prisma.avgWageNotice.findUnique({ where: { id } });
    if (!notice) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }

    let body: Record<string, string | undefined> = {};
    try {
      body = await req.json();
    } catch {
      /* body 없을 수 있음 */
    }

    const additionalReason = body.additionalReason ?? "";
    const bankName = body.bankName ?? "";
    const bankAccount = body.bankAccount ?? "";
    const bankHolder = body.bankHolder ?? notice.workerName ?? "";
    const claimantAddr = body.claimantAddr ?? "";
    const claimantPhone = body.claimantPhone ?? "";

    const today = new Date();
    const dateText = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일`;

    // 비교 임금 / 적용 임금 차이 계산 (정정 청구 사유 핵심)
    const candidates: Array<[string, number]> = [];
    if (notice.baseAvgWage !== null) candidates.push(["근로기준법 평균임금", notice.baseAvgWage]);
    if (notice.statWageBase !== null) candidates.push(["산재보험법 특례임금", notice.statWageBase]);
    candidates.sort((a, b) => b[1] - a[1]);
    const refLabel = candidates.length > 0 ? candidates[0][0] : "비교임금";
    const refAmount = candidates.length > 0 ? candidates[0][1] : null;

    const ratioPct =
      notice.finalAvgWage !== null && refAmount !== null
        ? ((notice.finalAvgWage / refAmount) * 100).toFixed(1)
        : null;

    const fmt = (n: number | null | undefined) =>
      n !== null && n !== undefined ? n.toLocaleString("ko-KR") + "원" : "(미파악)";

    const fmtDate = (d: Date | null | undefined) =>
      d
        ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
        : "-";

    const spec: TextFormSpec = {
      title: "평균임금 정정청구서",
      subtitle: "(산업재해보상보험법 시행령 제25조)",
      sections: [
        {
          heading: "■ 청구인 인적사항",
          rows: [
            ["성    명", notice.workerName ?? "(입력 필요)"],
            ["주민번호", notice.rrnPrefix ? `${notice.rrnPrefix}-*******` : "(입력 필요)"],
            ["주    소", claimantAddr || "(입력 필요)"],
            ["연락처", claimantPhone || "(입력 필요)"],
          ],
        },
        {
          heading: "■ 사건 정보",
          rows: [
            ["관리번호", notice.managementNo ?? "-"],
            ["사업장명", notice.workplaceName ?? "-"],
            ["사업종류", notice.businessType ?? "-"],
            ["산정사유발생일", fmtDate(notice.diagnosisDate)],
            ["채용일", fmtDate(notice.hireDate)],
          ],
        },
        {
          heading: "■ 평균임금 산정 내역 (공단 결정)",
          rows: [
            ["임금산정형태", notice.wageCalcType ?? "-"],
            ["일당", fmt(notice.dailyWage)],
            ["통상근로계수", notice.commuteCoef !== null ? String(notice.commuteCoef) : "-"],
            ["근기법 평균임금", fmt(notice.baseAvgWage)],
            ["산재보험법 특례임금", fmt(notice.statWageBase)],
            ["적용평균임금 (현재)", fmt(notice.finalAvgWage)],
            ["적용일자", fmtDate(notice.finalApplyDate)],
          ],
        },
        {
          heading: "■ 정정 청구 사유",
          paragraphs: [
            refAmount !== null && notice.finalAvgWage !== null
              ? `현재 적용평균임금 ${fmt(notice.finalAvgWage)}은 ${refLabel} ${fmt(refAmount)} 대비 ${ratioPct}%에 불과하여, 산업재해보상보험법 제5조(정의) 및 시행령 제25조(평균임금의 증감)에 따라 정당한 평균임금으로 인정되기 어려우므로 그 정정을 청구합니다.`
              : "공단이 산정한 평균임금에 대해 산업재해보상보험법 제5조 및 시행령 제25조에 따라 정정을 청구합니다.",
            ...(notice.correctionReason
              ? [`[자동 분석] ${notice.correctionReason}`]
              : []),
            ...(additionalReason ? [additionalReason] : []),
          ],
        },
        {
          heading: "■ 청구 취지",
          paragraphs: [
            `위 청구인의 평균임금을 ${refLabel} 등을 기준으로 정정하여 산정하시고, 그에 따른 보험급여 차액을 지급하여 주시기 바랍니다.`,
          ],
        },
        ...(bankAccount
          ? [
              {
                heading: "■ 수령 계좌",
                rows: [
                  ["은    행", bankName],
                  ["계좌번호", bankAccount],
                  ["예 금 주", bankHolder],
                ],
              },
            ]
          : []),
      ],
      signatureBlock: {
        dateText,
        rows: [
          ["청 구 인", `${notice.workerName ?? ""} (인)`],
          ["대 리 인", "노무법인 더보상 (인)"],
        ],
      },
      footnote:
        "※ 본 청구서는 TBSS 자동 생성된 초안입니다. 제출 전 노무사가 내용을 검토·보완해야 합니다.",
    };

    const pdfBytes = await buildTextFormPdf(spec);

    const fileName = `평균임금정정청구서_${notice.workerName ?? "재해자"}_${dateText.replace(/[년월일\s]/g, "")}.pdf`;

    return new NextResponse(pdfBytes, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(fileName)}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      },
    });
  } catch (e) {
    console.error("[avg-wage/correction-pdf] error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
