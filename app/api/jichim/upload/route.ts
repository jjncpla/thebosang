import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import pdfParse from "pdf-parse/lib/pdf-parse";

export const maxDuration = 60;

// ─── PDF 텍스트 → 챕터/조문 파싱 ───────────────────────────────────────────

const CHAPTER_RE = /^제\s*(\d+)\s*장\s*(.+)$/;
const ARTICLE_RE = /^제\s*(\d+)\s*조(?:의\s*\d+)?\s*(?:\(([^)]+)\))?/;

function parsePdfText(title: string, rawText: string) {
  // 줄 단위로 분리, 빈 줄·중복 공백 정리
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.replace(/\s{2,}/g, " ").trim())
    .filter((l) => l.length > 0);

  type ArticleDraft = { number: string; title: string; lines: string[] };
  type ChapterDraft = { number: number; title: string; articles: ArticleDraft[] };

  const chapters: ChapterDraft[] = [];
  let currentChapter: ChapterDraft | null = null;
  let currentArticle: ArticleDraft | null = null;

  const flushArticle = () => {
    if (currentArticle && currentChapter) {
      currentChapter.articles.push({ ...currentArticle, lines: currentArticle.lines });
      currentArticle = null;
    }
  };

  const flushChapter = () => {
    flushArticle();
    if (currentChapter) {
      chapters.push(currentChapter);
      currentChapter = null;
    }
  };

  for (const line of lines) {
    const chMatch = line.match(CHAPTER_RE);
    if (chMatch) {
      flushChapter();
      currentChapter = { number: parseInt(chMatch[1]), title: line, articles: [] };
      continue;
    }

    const artMatch = line.match(ARTICLE_RE);
    if (artMatch) {
      flushArticle();
      const artTitle = artMatch[2] ?? (line.replace(ARTICLE_RE, "").trim() || "조문");
      const artNumber = `제${artMatch[1]}조`;
      if (!currentChapter) {
        currentChapter = { number: 1, title: "본문", articles: [] };
      }
      currentArticle = { number: artNumber, title: artTitle, lines: [] };
      continue;
    }

    if (currentArticle) {
      currentArticle.lines.push(line);
    } else if (currentChapter) {
      // 챕터 설명 or 조문 없는 내용 → 가상 조문에 편입
      if (currentChapter.articles.length === 0) {
        currentChapter.articles.push({ number: "§", title: "개요", lines: [line] });
      } else {
        currentChapter.articles[currentChapter.articles.length - 1].lines.push(line);
      }
    }
  }
  flushChapter();

  // 챕터가 전혀 없으면 전체를 하나의 챕터로
  if (chapters.length === 0) {
    const allLines = lines;
    chapters.push({
      number: 1,
      title: "전문",
      articles: [{ number: "§1", title: "전체 내용", lines: allLines }],
    });
  }

  // Regulation JSON 형식으로 변환
  return {
    title,
    chapters: chapters.map((ch, ci) => ({
      id: `ch-${ci + 1}`,
      number: ch.number,
      title: ch.title,
      articles: ch.articles.map((art, ai) => ({
        id: `ch-${ci + 1}-art-${ai + 1}`,
        number: art.number,
        title: art.title,
        content: art.lines.join("\n"),
      })),
    })),
  };
}

// ─── Route handler ───────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const itemId = formData.get("itemId") as string | null;
  const title = formData.get("title") as string | null;
  const file = formData.get("file") as File | null;

  if (!itemId || !title || !file) {
    return NextResponse.json({ error: "itemId, title, file 필수" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const parsed = await pdfParse(buffer);
  const content = parsePdfText(title, parsed.text);

  const doc = await prisma.jichimDocument.upsert({
    where: { itemId },
    update: { title, content },
    create: { itemId, title, content },
  });

  return NextResponse.json({ id: doc.id, chapters: (content as { chapters: unknown[] }).chapters.length });
}
