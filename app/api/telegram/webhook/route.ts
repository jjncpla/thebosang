import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/* ═══════════════════════════════════════════════════════════════
   Telegram 타입
   ═══════════════════════════════════════════════════════════════ */
interface TelegramMessage {
  message_id: number;
  from?: { id: number };
  chat: { id: number };
  text?: string;
  date: number;
}

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
}

/* ═══════════════════════════════════════════════════════════════
   헬퍼
   ═══════════════════════════════════════════════════════════════ */
const BOT_TOKEN = () => process.env.TELEGRAM_BOT_TOKEN ?? "";

const ALLOWED_USER_IDS = () =>
  (process.env.TELEGRAM_ALLOWED_USER_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

async function sendMessage(chatId: number, text: string) {
  console.log("📤 텔레그램 sendMessage 호출:", { chatId, textLength: text.length });
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN()}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "Markdown",
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error("❌ sendMessage 실패:", err);
  }
}

/* ═══════════════════════════════════════════════════════════════
   /status 명령어
   ═══════════════════════════════════════════════════════════════ */
async function handleStatus(chatId: number) {
  const caseCount = await prisma.case.count();
  const text = [
    "✅ *TBSS 시스템 정상 동작 중*",
    "",
    `• 등록된 사건 수: ${caseCount}건`,
    `• 서버 시각: ${new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}`,
  ].join("\n");
  await sendMessage(chatId, text);
}

/* ═══════════════════════════════════════════════════════════════
   /case [검색어] 명령어
   ═══════════════════════════════════════════════════════════════ */
async function handleCase(chatId: number, query: string) {
  if (!query) {
    await sendMessage(chatId, "사용법: `/case 재해자이름` 또는 `/case 사건ID`");
    return;
  }

  // ID로 직접 조회 시도 → 없으면 재해자 이름 검색
  let caseData = await prisma.case.findUnique({
    where: { id: query },
    include: { patient: true },
  });

  if (!caseData) {
    caseData = await prisma.case.findFirst({
      where: { patient: { name: { contains: query } } },
      include: { patient: true },
      orderBy: { createdAt: "desc" },
    });
  }

  if (!caseData) {
    await sendMessage(chatId, `"${query}"에 해당하는 사건을 찾을 수 없습니다.`);
    return;
  }

  const statusMap: Record<string, string> = {
    CONSULTING: "상담중",
    CONTRACTED: "약정완료",
    DOC_COLLECTING: "서류수집",
    SUBMITTED: "접수완료",
    APPROVED: "승인",
    REJECTED: "불승인",
    CLOSED: "종결",
  };

  const text = [
    `📋 *사건 정보*`,
    "",
    `• 재해자: ${caseData.patient.name}`,
    `• 상병유형: ${caseData.caseType}`,
    `• 상태: ${statusMap[caseData.status] ?? caseData.status}`,
    caseData.tfName ? `• TF: ${caseData.tfName}` : null,
    caseData.branch ? `• 지사: ${caseData.branch}` : null,
    `• 등록일: ${caseData.createdAt.toLocaleDateString("ko-KR")}`,
  ]
    .filter(Boolean)
    .join("\n");

  await sendMessage(chatId, text);
}

/* ═══════════════════════════════════════════════════════════════
   Claude API 호출 (그 외 텍스트)
   ═══════════════════════════════════════════════════════════════ */
async function handleClaudeChat(chatId: number, userText: string) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("❌ ANTHROPIC_API_KEY 미설정");
    await sendMessage(chatId, "⚠️ AI 응답을 위한 API 키가 설정되지 않았습니다.");
    return;
  }

  try {
    console.log("🤖 Claude API 호출 시작:", { chatId, userText: userText.substring(0, 50) });
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system:
          "너는 노무법인 더보상의 업무지원 AI 어시스턴트야. 산재, 노동법, 업무 관련 질문에 간결하게 답변해. 텔레그램 메시지이므로 짧고 핵심만 답변해.",
        messages: [{ role: "user", content: userText }],
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Claude API error:", err);
      await sendMessage(chatId, "⚠️ AI 응답 처리 중 오류가 발생했습니다.");
      return;
    }

    const data = await res.json();
    const reply =
      data.content?.[0]?.text ?? "응답을 생성하지 못했습니다.";
    await sendMessage(chatId, reply);
  } catch (e) {
    console.error("Claude API call failed:", e);
    await sendMessage(chatId, "⚠️ AI 응답 시간이 초과되었습니다.");
  }
}

/* ═══════════════════════════════════════════════════════════════
   POST /api/telegram/webhook
   ═══════════════════════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════════════════════
   /조회 [재해자이름] 명령어
   ═══════════════════════════════════════════════════════════════ */
async function handleCaseQuery(chatId: number, searchName: string) {
  if (!searchName) {
    await sendMessage(chatId, "조회할 재해자 이름을 입력해주세요.\n예) /조회 홍길동");
    return;
  }

  const cases = await prisma.case.findMany({
    where: { patient: { name: { contains: searchName } } },
    include: { patient: { select: { name: true } } },
    take: 5,
  });

  if (cases.length === 0) {
    await sendMessage(chatId, `"${searchName}" 검색 결과가 없습니다.`);
    return;
  }

  const statusMap: Record<string, string> = {
    CONSULTING: "상담 중",
    CONTRACTED: "약정 완료",
    DOC_COLLECTING: "서류 수집",
    SUBMITTED: "접수 완료",
    EXAM_REQUESTED: "특진 요구",
    EXAM_CLINIC_SELECTED: "특진 병원 선정",
    EXAM_SCHEDULED: "특진 일정 확정",
    IN_EXAM: "특진 진행 중",
    EXAM_DONE: "특진 완료",
    EXPERT_REQUESTED: "전문조사 요구",
    EXPERT_CLINIC_SELECTED: "전문조사 기관 선정",
    EXPERT_DONE: "전문조사 완료",
    BANK_REQUESTED: "은행 요청",
    BANK_SUBMITTED: "은행 제출",
    DECISION_RECEIVED: "결정 수령",
    REVIEWING: "검토 중",
    APPROVED: "승인",
    REJECTED: "불승인",
    OBJECTION: "이의제기 진행 중",
    WAGE_CORRECTION: "평균임금 정정",
    CLOSED: "종결",
  };

  const resultText = cases
    .map((c) => {
      const status = statusMap[c.status] ?? c.status;
      return `• ${c.patient?.name} — ${status}`;
    })
    .join("\n");

  await sendMessage(chatId, `검색 결과 (${cases.length}건):\n${resultText}`);
}

/* ═══════════════════════════════════════════════════════════════
   키워드 감지 — 승인/불승인, 특진 일정, 접수 완료
   ═══════════════════════════════════════════════════════════════ */
type KeywordMatch = { type: string; value: string };

function detectKeyword(text: string): KeywordMatch | null {
  if (text.includes("승인") && (text.includes("처분") || text.includes("판정"))) {
    return { type: "APPROVAL_RESULT", value: text };
  }
  if (text.includes("특진") && text.includes("일정")) {
    return { type: "EXAM_SCHEDULE", value: text };
  }
  if (text.includes("접수") && text.includes("완료")) {
    return { type: "SUBMISSION_DONE", value: text };
  }
  return null;
}

async function handleKeywordSave(
  chatId: number,
  text: string,
  match: KeywordMatch,
) {
  try {
    console.log("[텔레그램 키워드 감지]", match.type, text.slice(0, 100));
  } catch (e) {
    console.error("키워드 저장 실패", e);
  }
}

/* ═══════════════════════════════════════════════════════════════
   POST /api/telegram/webhook
   ═══════════════════════════════════════════════════════════════ */
export async function POST(req: NextRequest) {
  try {
    // webhook 시크릿 검증
    const secret = req.headers.get("X-Telegram-Bot-Api-Secret-Token");
    if (
      process.env.TELEGRAM_WEBHOOK_SECRET &&
      secret !== process.env.TELEGRAM_WEBHOOK_SECRET
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let body: TelegramUpdate;

    try {
      body = await req.json();
    } catch {
      console.error("❌ 에러 발생: Invalid JSON body");
      return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
    }

    const msg = body.message;
    if (!msg || !msg.text) {
      return NextResponse.json({ ok: true });
    }

    // 허용된 user_id 체크
    const userId = String(msg.from?.id ?? "");
    const allowed = ALLOWED_USER_IDS();
    if (allowed.length > 0 && !allowed.includes(userId)) {
      console.log(`⛔ 허용되지 않은 유저: ${userId}`);
      return NextResponse.json({ ok: true });
    }
    console.log("✅ 유저 확인 통과:", userId);

    const chatId = msg.chat.id;
    const text = msg.text.trim();
    console.log("📩 수신 메시지:", { chatId, text: text.substring(0, 50) });

    // 라우팅: /조회 → 사건 조회
    if (text.startsWith("/조회")) {
      const searchName = text.replace("/조회", "").trim();
      await handleCaseQuery(chatId, searchName);
      return NextResponse.json({ ok: true });
    }

    // 라우팅: 키워드 감지 → DB 로깅
    const keywordMatch = detectKeyword(text);
    if (keywordMatch) {
      await handleKeywordSave(chatId, text, keywordMatch);
      // 키워드 감지 후에도 기존 로직 계속 진행 (Claude 응답 등)
    }

    // 기존 명령어 처리
    if (text === "/status" || text === "/status@bot") {
      console.log("📊 /status 명령어 처리");
      await handleStatus(chatId);
    } else if (text.startsWith("/case")) {
      const query = text.replace(/^\/case\s*/, "").trim();
      console.log("🔍 /case 명령어 처리:", query);
      await handleCase(chatId, query);
    } else {
      await handleClaudeChat(chatId, text);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("❌ 에러 발생:", error);
    return NextResponse.json({ ok: true });
  }
}
