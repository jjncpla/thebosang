"use client";

import { useEffect, useState } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

type Article = {
  id: string;
  number: string;
  title: string;
  content: string;
};

type Chapter = {
  id: string;
  number: number;
  title: string;
  articles: Article[];
};

type Regulation = {
  title: string;
  chapters: Chapter[];
};

type LawLink = {
  id: string;
  name: string;
  shortName: string;
  url: string;
  category: string;
};

// ─── Data ────────────────────────────────────────────────────────────────────

const LAW_LINKS: LawLink[] = [
  {
    id: "산재법",
    name: "산업재해보상보험법",
    shortName: "산재보험법",
    url: "https://www.law.go.kr/법령/산업재해보상보험법",
    category: "주요 법률",
  },
  {
    id: "산재령",
    name: "산업재해보상보험법 시행령",
    shortName: "산재보험법 시행령",
    url: "https://www.law.go.kr/법령/산업재해보상보험법시행령",
    category: "주요 법률",
  },
  {
    id: "산재칙",
    name: "산업재해보상보험법 시행규칙",
    shortName: "산재보험법 시행규칙",
    url: "https://www.law.go.kr/법령/산업재해보상보험법시행규칙",
    category: "주요 법률",
  },
  {
    id: "근기법",
    name: "근로기준법",
    shortName: "근로기준법",
    url: "https://www.law.go.kr/법령/근로기준법",
    category: "주요 법률",
  },
  {
    id: "근기령",
    name: "근로기준법 시행령",
    shortName: "근기법 시행령",
    url: "https://www.law.go.kr/법령/근로기준법시행령",
    category: "주요 법률",
  },
  {
    id: "보험료법",
    name: "고용보험 및 산업재해보상보험의 보험료징수 등에 관한 법률",
    shortName: "보험료징수법",
    url: "https://www.law.go.kr/법령/고용보험및산업재해보상보험의보험료징수등에관한법률",
    category: "관련 법률",
  },
  {
    id: "고용법",
    name: "고용보험법",
    shortName: "고용보험법",
    url: "https://www.law.go.kr/법령/고용보험법",
    category: "관련 법률",
  },
  {
    id: "장애법",
    name: "장애인복지법",
    shortName: "장애인복지법",
    url: "https://www.law.go.kr/법령/장애인복지법",
    category: "관련 법률",
  },
  {
    id: "전자정부",
    name: "전자정부법",
    shortName: "전자정부법",
    url: "https://www.law.go.kr/법령/전자정부법",
    category: "관련 법률",
  },
];

// ─── Sub-components ──────────────────────────────────────────────────────────

function LawTab() {
  const [selectedLaw, setSelectedLaw] = useState<LawLink>(LAW_LINKS[0]);

  const categories = Array.from(new Set(LAW_LINKS.map((l) => l.category)));

  return (
    <div style={{ display: "flex", height: "calc(100vh - 160px)", gap: 0 }}>
      {/* Left sidebar */}
      <div
        style={{
          width: 220,
          flexShrink: 0,
          borderRight: "1px solid #e5e7eb",
          overflowY: "auto",
          background: "#f9fafb",
        }}
      >
        {categories.map((cat) => (
          <div key={cat}>
            <div
              style={{
                padding: "10px 16px 6px",
                fontSize: 11,
                fontWeight: 700,
                color: "#6b7280",
                letterSpacing: "0.05em",
                textTransform: "uppercase",
              }}
            >
              {cat}
            </div>
            {LAW_LINKS.filter((l) => l.category === cat).map((law) => (
              <button
                key={law.id}
                onClick={() => setSelectedLaw(law)}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "8px 16px",
                  fontSize: 13,
                  border: "none",
                  cursor: "pointer",
                  background:
                    selectedLaw.id === law.id ? "#dbeafe" : "transparent",
                  color: selectedLaw.id === law.id ? "#1d4ed8" : "#374151",
                  fontWeight: selectedLaw.id === law.id ? 600 : 400,
                  borderLeft:
                    selectedLaw.id === law.id
                      ? "3px solid #3b82f6"
                      : "3px solid transparent",
                  lineHeight: 1.4,
                }}
              >
                {law.shortName}
              </button>
            ))}
          </div>
        ))}
        <div style={{ padding: "16px", borderTop: "1px solid #e5e7eb", marginTop: 8 }}>
          <a
            href="https://www.law.go.kr"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "block",
              fontSize: 12,
              color: "#6b7280",
              textDecoration: "none",
              textAlign: "center",
            }}
          >
            국가법령정보센터 →
          </a>
        </div>
      </div>

      {/* Right iframe */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <div
          style={{
            padding: "10px 16px",
            borderBottom: "1px solid #e5e7eb",
            background: "#fff",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>
            {selectedLaw.name}
          </span>
          <a
            href={selectedLaw.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: 12, color: "#3b82f6", textDecoration: "none" }}
          >
            새 탭에서 열기 ↗
          </a>
        </div>
        <iframe
          key={selectedLaw.id}
          src={selectedLaw.url}
          style={{ flex: 1, border: "none" }}
          title={selectedLaw.name}
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-top-navigation"
        />
      </div>
    </div>
  );
}

function RegulationTab({ dataUrl }: { dataUrl: string }) {
  const [regulation, setRegulation] = useState<Regulation | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [search, setSearch] = useState("");
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());

  useEffect(() => {
    setLoading(true);
    setSelectedChapter(null);
    setSelectedArticle(null);
    setSearch("");
    setExpandedChapters(new Set());
    fetch(dataUrl)
      .then((r) => r.json())
      .then((data: Regulation) => {
        setRegulation(data);
        if (data.chapters.length > 0) {
          setSelectedChapter(data.chapters[0]);
          setExpandedChapters(new Set([data.chapters[0].id]));
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [dataUrl]);

  const toggleChapter = (chId: string) => {
    setExpandedChapters((prev) => {
      const next = new Set(prev);
      if (next.has(chId)) {
        next.delete(chId);
      } else {
        next.add(chId);
      }
      return next;
    });
  };

  // Filter by search
  const searchResults: Article[] =
    search.trim().length >= 2 && regulation
      ? regulation.chapters.flatMap((ch) =>
          ch.articles.filter(
            (a) =>
              a.title.includes(search) ||
              a.number.includes(search) ||
              a.content.includes(search)
          )
        )
      : [];

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: 200,
          color: "#9ca3af",
          fontSize: 14,
        }}
      >
        불러오는 중...
      </div>
    );
  }

  if (!regulation) {
    return (
      <div
        style={{
          padding: 32,
          color: "#ef4444",
          fontSize: 14,
        }}
      >
        데이터를 불러오지 못했습니다.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", height: "calc(100vh - 160px)", gap: 0 }}>
      {/* Left: Chapter/Article nav */}
      <div
        style={{
          width: 260,
          flexShrink: 0,
          borderRight: "1px solid #e5e7eb",
          overflowY: "auto",
          background: "#f9fafb",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Search */}
        <div style={{ padding: "12px 12px 8px", borderBottom: "1px solid #e5e7eb" }}>
          <input
            type="text"
            placeholder="조문 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "100%",
              padding: "6px 10px",
              fontSize: 13,
              border: "1px solid #d1d5db",
              borderRadius: 6,
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* Search results */}
        {search.trim().length >= 2 ? (
          <div style={{ flex: 1, overflowY: "auto" }}>
            {searchResults.length === 0 ? (
              <div style={{ padding: 16, fontSize: 13, color: "#9ca3af" }}>
                검색 결과 없음
              </div>
            ) : (
              searchResults.map((art) => (
                <button
                  key={art.id}
                  onClick={() => {
                    setSelectedArticle(art);
                    setSearch("");
                  }}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    padding: "8px 14px",
                    fontSize: 12,
                    border: "none",
                    cursor: "pointer",
                    background: "transparent",
                    color: "#374151",
                    borderBottom: "1px solid #f3f4f6",
                  }}
                >
                  <div style={{ fontWeight: 600 }}>
                    {art.number}({art.title})
                  </div>
                  <div
                    style={{
                      color: "#6b7280",
                      marginTop: 2,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {art.content.slice(0, 50)}...
                  </div>
                </button>
              ))
            )}
          </div>
        ) : (
          /* Chapter/Article tree */
          <div style={{ flex: 1, overflowY: "auto" }}>
            {regulation.chapters.map((ch) => (
              <div key={ch.id}>
                <button
                  onClick={() => {
                    toggleChapter(ch.id);
                    setSelectedChapter(ch);
                    setSelectedArticle(null);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    width: "100%",
                    textAlign: "left",
                    padding: "9px 14px",
                    fontSize: 12,
                    fontWeight: 700,
                    border: "none",
                    cursor: "pointer",
                    background:
                      selectedChapter?.id === ch.id && !selectedArticle
                        ? "#dbeafe"
                        : "transparent",
                    color:
                      selectedChapter?.id === ch.id && !selectedArticle
                        ? "#1d4ed8"
                        : "#111827",
                    borderBottom: "1px solid #e5e7eb",
                    gap: 6,
                  }}
                >
                  <span
                    style={{
                      fontSize: 10,
                      transform: expandedChapters.has(ch.id)
                        ? "rotate(90deg)"
                        : "none",
                      display: "inline-block",
                      transition: "transform 0.15s",
                    }}
                  >
                    ▶
                  </span>
                  {ch.title}
                </button>
                {expandedChapters.has(ch.id) && (
                  <div style={{ background: "#fff" }}>
                    {ch.articles.map((art) => (
                      <button
                        key={art.id}
                        onClick={() => {
                          setSelectedArticle(art);
                          setSelectedChapter(ch);
                        }}
                        style={{
                          display: "block",
                          width: "100%",
                          textAlign: "left",
                          padding: "6px 14px 6px 28px",
                          fontSize: 12,
                          border: "none",
                          cursor: "pointer",
                          background:
                            selectedArticle?.id === art.id
                              ? "#eff6ff"
                              : "transparent",
                          color:
                            selectedArticle?.id === art.id
                              ? "#1d4ed8"
                              : "#374151",
                          borderBottom: "1px solid #f9fafb",
                          fontWeight:
                            selectedArticle?.id === art.id ? 600 : 400,
                        }}
                      >
                        {art.number}({art.title})
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Right: Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "24px 32px" }}>
        {selectedArticle ? (
          <ArticleView
            article={selectedArticle}
            onBack={() => setSelectedArticle(null)}
          />
        ) : selectedChapter ? (
          <ChapterView
            chapter={selectedChapter}
            onSelectArticle={setSelectedArticle}
          />
        ) : null}
      </div>
    </div>
  );
}

function ArticleView({
  article,
  onBack,
}: {
  article: Article;
  onBack: () => void;
}) {
  return (
    <div style={{ maxWidth: 760 }}>
      <button
        onClick={onBack}
        style={{
          fontSize: 12,
          color: "#6b7280",
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: 0,
          marginBottom: 16,
        }}
      >
        ← 목록으로
      </button>
      <h2
        style={{
          fontSize: 18,
          fontWeight: 700,
          color: "#111827",
          marginBottom: 16,
        }}
      >
        {article.number}({article.title})
      </h2>
      <div
        style={{
          fontSize: 14,
          lineHeight: 2,
          color: "#374151",
          whiteSpace: "pre-wrap",
          wordBreak: "keep-all",
        }}
      >
        {article.content}
      </div>
    </div>
  );
}

function ChapterView({
  chapter,
  onSelectArticle,
}: {
  chapter: Chapter;
  onSelectArticle: (a: Article) => void;
}) {
  return (
    <div style={{ maxWidth: 760 }}>
      <h2
        style={{
          fontSize: 18,
          fontWeight: 700,
          color: "#111827",
          marginBottom: 20,
          paddingBottom: 12,
          borderBottom: "2px solid #e5e7eb",
        }}
      >
        {chapter.title}
      </h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {chapter.articles.map((art) => (
          <button
            key={art.id}
            onClick={() => onSelectArticle(art)}
            style={{
              textAlign: "left",
              padding: "14px 16px",
              border: "1px solid #e5e7eb",
              borderRadius: 8,
              background: "#fff",
              cursor: "pointer",
              transition: "border-color 0.15s, background 0.15s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor =
                "#3b82f6";
              (e.currentTarget as HTMLButtonElement).style.background =
                "#eff6ff";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor =
                "#e5e7eb";
              (e.currentTarget as HTMLButtonElement).style.background = "#fff";
            }}
          >
            <div
              style={{ fontSize: 14, fontWeight: 600, color: "#111827", marginBottom: 4 }}
            >
              {art.number}({art.title})
            </div>
            <div
              style={{
                fontSize: 12,
                color: "#6b7280",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {art.content.slice(0, 80)}...
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

const TABS = [
  { id: "law", label: "관련 법령" },
  { id: "bosang", label: "보상업무처리규정" },
  { id: "yoyang", label: "요양업무처리규정" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function LawPage() {
  const [activeTab, setActiveTab] = useState<TabId>("law");

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        fontFamily:
          "'Malgun Gothic', 'Apple SD Gothic Neo', 'Segoe UI', sans-serif",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "16px 24px 0",
          borderBottom: "1px solid #e5e7eb",
          background: "#fff",
        }}
      >
        <h1
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: "#111827",
            marginBottom: 12,
          }}
        >
          법령 및 규정
        </h1>
        <div style={{ display: "flex", gap: 0 }}>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: "8px 20px",
                fontSize: 14,
                fontWeight: activeTab === tab.id ? 700 : 400,
                border: "none",
                background: "none",
                cursor: "pointer",
                color: activeTab === tab.id ? "#1d4ed8" : "#6b7280",
                borderBottom:
                  activeTab === tab.id
                    ? "2px solid #1d4ed8"
                    : "2px solid transparent",
                marginBottom: -1,
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflow: "hidden" }}>
        {activeTab === "law" && <LawTab />}
        {activeTab === "bosang" && (
          <RegulationTab dataUrl="/data/bosang-gyuchung.json" />
        )}
        {activeTab === "yoyang" && (
          <RegulationTab dataUrl="/data/yoyang-gyuchung.json" />
        )}
      </div>
    </div>
  );
}
