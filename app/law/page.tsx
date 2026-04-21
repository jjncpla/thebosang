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

type LawItem = {
  id: string;
  label: "법" | "시행령" | "시행규칙";
  name: string;
  url: string;
};

type LawGroup = {
  id: string;
  groupName: string;
  category: "주요 법률" | "관련 법률";
  laws: LawItem[];
};

// ─── Data ────────────────────────────────────────────────────────────────────

const LAW_GROUPS: LawGroup[] = [
  {
    id: "산재",
    groupName: "산업재해보상보험법령",
    category: "주요 법률",
    laws: [
      { id: "산재법", label: "법", name: "산업재해보상보험법", url: "https://www.law.go.kr/법령/산업재해보상보험법" },
      { id: "산재령", label: "시행령", name: "산업재해보상보험법 시행령", url: "https://www.law.go.kr/법령/산업재해보상보험법시행령" },
      { id: "산재칙", label: "시행규칙", name: "산업재해보상보험법 시행규칙", url: "https://www.law.go.kr/법령/산업재해보상보험법시행규칙" },
    ],
  },
  {
    id: "근기",
    groupName: "근로기준법령",
    category: "주요 법률",
    laws: [
      { id: "근기법", label: "법", name: "근로기준법", url: "https://www.law.go.kr/법령/근로기준법" },
      { id: "근기령", label: "시행령", name: "근로기준법 시행령", url: "https://www.law.go.kr/법령/근로기준법시행령" },
    ],
  },
  {
    id: "보험료",
    groupName: "고용보험 및 산업재해보상보험의 보험료징수 등에 관한 법률",
    category: "관련 법률",
    laws: [
      { id: "보험료법", label: "법", name: "고용보험 및 산업재해보상보험의 보험료징수 등에 관한 법률", url: "https://www.law.go.kr/법령/고용보험및산업재해보상보험의보험료징수등에관한법률" },
    ],
  },
  {
    id: "고용",
    groupName: "고용보험법령",
    category: "관련 법률",
    laws: [
      { id: "고용법", label: "법", name: "고용보험법", url: "https://www.law.go.kr/법령/고용보험법" },
    ],
  },
  {
    id: "공무원재해",
    groupName: "공무원 재해보상법령",
    category: "관련 법률",
    laws: [
      { id: "공무원재해법", label: "법", name: "공무원 재해보상법", url: "https://www.law.go.kr/법령/공무원재해보상법" },
      { id: "공무원재해령", label: "시행령", name: "공무원 재해보상법 시행령", url: "https://www.law.go.kr/법령/공무원재해보상법시행령" },
      { id: "공무원재해칙", label: "시행규칙", name: "공무원 재해보상법 시행규칙", url: "https://www.law.go.kr/법령/공무원재해보상법시행규칙" },
    ],
  },
  {
    id: "어선원",
    groupName: "어선원 및 어선 재해보상보험법령",
    category: "관련 법률",
    laws: [
      { id: "어선원법", label: "법", name: "어선원 및 어선 재해보상보험법", url: "https://www.law.go.kr/법령/어선원및어선재해보상보험법" },
      { id: "어선원령", label: "시행령", name: "어선원 및 어선 재해보상보험법 시행령", url: "https://www.law.go.kr/법령/어선원및어선재해보상보험법시행령" },
      { id: "어선원칙", label: "시행규칙", name: "어선원 및 어선 재해보상보험법 시행규칙", url: "https://www.law.go.kr/법령/어선원및어선재해보상보험법시행규칙" },
    ],
  },
  {
    id: "진폐",
    groupName: "진폐의 예방과 진폐근로자의 보호 등에 관한 법률",
    category: "관련 법률",
    laws: [
      { id: "진폐법", label: "법", name: "진폐의 예방과 진폐근로자의 보호 등에 관한 법률", url: "https://www.law.go.kr/법령/진폐의예방과진폐근로자의보호등에관한법률" },
      { id: "진폐령", label: "시행령", name: "진폐의 예방과 진폐근로자의 보호 등에 관한 법률 시행령", url: "https://www.law.go.kr/법령/진폐의예방과진폐근로자의보호등에관한법률시행령" },
      { id: "진폐칙", label: "시행규칙", name: "진폐의 예방과 진폐근로자의 보호 등에 관한 법률 시행규칙", url: "https://www.law.go.kr/법령/진폐의예방과진폐근로자의보호등에관한법률시행규칙" },
    ],
  },
  {
    id: "석탄",
    groupName: "석탄산업법령",
    category: "관련 법률",
    laws: [
      { id: "석탄법", label: "법", name: "석탄산업법", url: "https://www.law.go.kr/법령/석탄산업법" },
      { id: "석탄령", label: "시행령", name: "석탄산업법 시행령", url: "https://www.law.go.kr/법령/석탄산업법시행령" },
      { id: "석탄칙", label: "시행규칙", name: "석탄산업법 시행규칙", url: "https://www.law.go.kr/법령/석탄산업법시행규칙" },
    ],
  },
  {
    id: "안전보건",
    groupName: "산업안전보건법령",
    category: "관련 법률",
    laws: [
      { id: "안전법", label: "법", name: "산업안전보건법", url: "https://www.law.go.kr/법령/산업안전보건법" },
      { id: "안전령", label: "시행령", name: "산업안전보건법 시행령", url: "https://www.law.go.kr/법령/산업안전보건법시행령" },
      { id: "안전칙", label: "시행규칙", name: "산업안전보건법 시행규칙", url: "https://www.law.go.kr/법령/산업안전보건법시행규칙" },
    ],
  },
  {
    id: "행심",
    groupName: "행정심판법령",
    category: "관련 법률",
    laws: [
      { id: "행심법", label: "법", name: "행정심판법", url: "https://www.law.go.kr/법령/행정심판법" },
      { id: "행심령", label: "시행령", name: "행정심판법 시행령", url: "https://www.law.go.kr/법령/행정심판법시행령" },
      { id: "행심칙", label: "시행규칙", name: "행정심판법 시행규칙", url: "https://www.law.go.kr/법령/행정심판법시행규칙" },
    ],
  },
];

// ─── Sub-components ──────────────────────────────────────────────────────────

const LABEL_COLORS: Record<LawItem["label"], { bg: string; text: string; border: string }> = {
  법: { bg: "#dbeafe", text: "#1d4ed8", border: "#93c5fd" },
  시행령: { bg: "#dcfce7", text: "#15803d", border: "#86efac" },
  시행규칙: { bg: "#fef9c3", text: "#92400e", border: "#fde68a" },
};

function LawTab() {
  const firstItem = LAW_GROUPS[0].laws[0];
  const [selectedItem, setSelectedItem] = useState<LawItem>(firstItem);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set([LAW_GROUPS[0].id])
  );

  const categories: Array<"주요 법률" | "관련 법률"> = ["주요 법률", "관련 법률"];

  const toggleGroup = (gid: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(gid)) next.delete(gid);
      else next.add(gid);
      return next;
    });
  };

  return (
    <div style={{ display: "flex", height: "calc(100vh - 160px)", gap: 0 }}>
      {/* Left sidebar */}
      <div
        style={{
          width: 256,
          flexShrink: 0,
          borderRight: "1px solid #e5e7eb",
          overflowY: "auto",
          background: "#f9fafb",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ flex: 1 }}>
          {categories.map((cat) => (
            <div key={cat}>
              {/* Category label */}
              <div
                style={{
                  padding: "12px 14px 6px",
                  fontSize: 10,
                  fontWeight: 700,
                  color: "#9ca3af",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                {cat}
              </div>

              {LAW_GROUPS.filter((g) => g.category === cat).map((group) => {
                const isExpanded = expandedGroups.has(group.id);
                const isGroupActive = group.laws.some((l) => l.id === selectedItem.id);
                return (
                  <div key={group.id}>
                    {/* Group header */}
                    <button
                      onClick={() => toggleGroup(group.id)}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        width: "100%",
                        textAlign: "left",
                        padding: "7px 14px",
                        fontSize: 12,
                        fontWeight: isGroupActive ? 700 : 500,
                        border: "none",
                        cursor: "pointer",
                        background: isGroupActive ? "#eff6ff" : "transparent",
                        color: isGroupActive ? "#1d4ed8" : "#374151",
                        gap: 6,
                        lineHeight: 1.45,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 9,
                          marginTop: 3,
                          flexShrink: 0,
                          transform: isExpanded ? "rotate(90deg)" : "none",
                          display: "inline-block",
                          transition: "transform 0.15s",
                          color: "#9ca3af",
                        }}
                      >
                        ▶
                      </span>
                      <span>{group.groupName}</span>
                    </button>

                    {/* Sub-items */}
                    {isExpanded && (
                      <div style={{ paddingLeft: 8, paddingBottom: 4 }}>
                        {group.laws.map((law) => {
                          const colors = LABEL_COLORS[law.label];
                          const isActive = selectedItem.id === law.id;
                          return (
                            <button
                              key={law.id}
                              onClick={() => setSelectedItem(law)}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                width: "100%",
                                textAlign: "left",
                                padding: "5px 14px 5px 20px",
                                fontSize: 12,
                                border: "none",
                                cursor: "pointer",
                                background: isActive ? "#dbeafe" : "transparent",
                                color: isActive ? "#1d4ed8" : "#4b5563",
                                fontWeight: isActive ? 600 : 400,
                                gap: 8,
                                borderLeft: isActive
                                  ? "2px solid #3b82f6"
                                  : "2px solid transparent",
                              }}
                            >
                              <span
                                style={{
                                  fontSize: 10,
                                  padding: "1px 5px",
                                  borderRadius: 3,
                                  background: colors.bg,
                                  color: colors.text,
                                  border: `1px solid ${colors.border}`,
                                  flexShrink: 0,
                                  fontWeight: 600,
                                }}
                              >
                                {law.label}
                              </span>
                              <span style={{ lineHeight: 1.4 }}>{law.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}

              <div style={{ height: 8 }} />
            </div>
          ))}
        </div>

        <div style={{ padding: "12px 14px", borderTop: "1px solid #e5e7eb" }}>
          <a
            href="https://www.law.go.kr"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "block",
              fontSize: 11,
              color: "#9ca3af",
              textDecoration: "none",
              textAlign: "center",
            }}
          >
            국가법령정보센터 ↗
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
            gap: 10,
          }}
        >
          {(() => {
            const colors = LABEL_COLORS[selectedItem.label];
            return (
              <span
                style={{
                  fontSize: 11,
                  padding: "2px 6px",
                  borderRadius: 4,
                  background: colors.bg,
                  color: colors.text,
                  border: `1px solid ${colors.border}`,
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {selectedItem.label}
              </span>
            );
          })()}
          <span style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>
            {selectedItem.name}
          </span>
          <a
            href={selectedItem.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: 12, color: "#3b82f6", textDecoration: "none", marginLeft: "auto", flexShrink: 0 }}
          >
            새 탭에서 열기 ↗
          </a>
        </div>
        <iframe
          key={selectedItem.id}
          src={selectedItem.url}
          style={{ flex: 1, border: "none" }}
          title={selectedItem.name}
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
