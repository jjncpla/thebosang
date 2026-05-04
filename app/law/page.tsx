"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useSession } from "next-auth/react";

const PdfViewerModal = dynamic(() => import("../../components/PdfViewerModal"), { ssr: false });
const InlinePdfViewer = dynamic(() => import("../../components/InlinePdfViewer"), { ssr: false });

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
  const [sidebarOpen, setSidebarOpen] = useState(true);

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
      {sidebarOpen && (
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
                                  borderLeft: isActive ? "2px solid #3b82f6" : "2px solid transparent",
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
              style={{ display: "block", fontSize: 11, color: "#9ca3af", textDecoration: "none", textAlign: "center" }}
            >
              국가법령정보센터 ↗
            </a>
          </div>
        </div>
      )}

      {/* Right iframe area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Toolbar */}
        <div
          style={{
            padding: "8px 12px",
            borderBottom: "1px solid #e5e7eb",
            background: "#fff",
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexShrink: 0,
          }}
        >
          {/* 접기/펼치기 버튼 */}
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            title={sidebarOpen ? "목록 접기" : "목록 펼치기"}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "4px 8px",
              fontSize: 12,
              border: "1px solid #e5e7eb",
              borderRadius: 5,
              background: "#f9fafb",
              color: "#4b5563",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: 11 }}>{sidebarOpen ? "◀" : "▶"}</span>
            <span>{sidebarOpen ? "목록 접기" : "목록 펼치기"}</span>
          </button>

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
          <span style={{ fontSize: 13, fontWeight: 600, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
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

        {/* iframe wrapper — 가로 스크롤 가능 */}
        <div style={{ flex: 1, overflow: "auto", position: "relative" }}>
          <iframe
            key={selectedItem.id}
            src={selectedItem.url}
            style={{ width: "100%", minWidth: 900, height: "100%", border: "none", display: "block" }}
            title={selectedItem.name}
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-top-navigation"
          />
        </div>
      </div>
    </div>
  );
}

// ─── Internal Regulation Registry ───────────────────────────────────────────

type RegEntry = { id: string; label: string; dataUrl: string };

const INTERNAL_REGS: RegEntry[] = [
  { id: "bosang",    label: "보상업무처리규정",                      dataUrl: "/data/bosang-gyuchung.json" },
  { id: "yoyang",    label: "요양업무처리규정",                      dataUrl: "/data/yoyang-gyuchung.json" },
  { id: "janghae",   label: "장해등급 심사에 관한 규정",               dataUrl: "/data/janghae-gyuchung.json" },
  { id: "minwon",    label: "민원 처리에 관한 규정",                  dataUrl: "/data/minwon-gyuchung.json" },
  { id: "jigeub",    label: "보험급여 및 반환금 등 지급업무 처리규정",   dataUrl: "/data/boheum-jigeub-gyuchung.json" },
  { id: "budang",    label: "부당이득 징수 업무처리규정",               dataUrl: "/data/budang-gyuchung.json" },
  { id: "jilbyeong", label: "업무상질병판정위원회 운영규정",             dataUrl: "/data/jilbyeong-gyuchung.json" },
];

// ─── RegulationPanel (chapter + article navigation) ──────────────────────────

function RegulationPanel({ dataUrl }: { dataUrl: string }) {
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
      next.has(chId) ? next.delete(chId) : next.add(chId);
      return next;
    });
  };

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

  if (loading)
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200, color: "#9ca3af", fontSize: 14 }}>
        불러오는 중...
      </div>
    );

  if (!regulation)
    return <div style={{ padding: 32, color: "#ef4444", fontSize: 14 }}>데이터를 불러오지 못했습니다.</div>;

  return (
    <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
      {/* Chapter/Article nav */}
      <div
        style={{
          width: 240,
          flexShrink: 0,
          borderRight: "1px solid #e5e7eb",
          overflowY: "auto",
          background: "#f9fafb",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ padding: "10px 10px 6px", borderBottom: "1px solid #e5e7eb" }}>
          <input
            type="text"
            placeholder="조문 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: "100%", padding: "5px 9px", fontSize: 12, border: "1px solid #d1d5db", borderRadius: 5, outline: "none", boxSizing: "border-box" }}
          />
        </div>

        {search.trim().length >= 2 ? (
          <div style={{ flex: 1, overflowY: "auto" }}>
            {searchResults.length === 0 ? (
              <div style={{ padding: 14, fontSize: 12, color: "#9ca3af" }}>검색 결과 없음</div>
            ) : (
              searchResults.map((art) => (
                <button
                  key={art.id}
                  onClick={() => { setSelectedArticle(art); setSearch(""); }}
                  style={{ display: "block", width: "100%", textAlign: "left", padding: "7px 12px", fontSize: 11, border: "none", cursor: "pointer", background: "transparent", color: "#374151", borderBottom: "1px solid #f3f4f6" }}
                >
                  <div style={{ fontWeight: 600 }}>{art.number}({art.title})</div>
                  <div style={{ color: "#6b7280", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {art.content.slice(0, 45)}...
                  </div>
                </button>
              ))
            )}
          </div>
        ) : (
          <div style={{ flex: 1, overflowY: "auto" }}>
            {regulation.chapters.map((ch) => (
              <div key={ch.id}>
                <button
                  onClick={() => { toggleChapter(ch.id); setSelectedChapter(ch); setSelectedArticle(null); }}
                  style={{
                    display: "flex", alignItems: "center", width: "100%", textAlign: "left",
                    padding: "8px 12px", fontSize: 11, fontWeight: 700, border: "none", cursor: "pointer",
                    background: selectedChapter?.id === ch.id && !selectedArticle ? "#dbeafe" : "transparent",
                    color: selectedChapter?.id === ch.id && !selectedArticle ? "#1d4ed8" : "#111827",
                    borderBottom: "1px solid #e5e7eb", gap: 5,
                  }}
                >
                  <span style={{ fontSize: 9, transform: expandedChapters.has(ch.id) ? "rotate(90deg)" : "none", display: "inline-block", transition: "transform 0.15s" }}>▶</span>
                  {ch.title}
                </button>
                {expandedChapters.has(ch.id) && (
                  <div style={{ background: "#fff" }}>
                    {ch.articles.map((art) => (
                      <button
                        key={art.id}
                        onClick={() => { setSelectedArticle(art); setSelectedChapter(ch); }}
                        style={{
                          display: "block", width: "100%", textAlign: "left",
                          padding: "5px 12px 5px 24px", fontSize: 11, border: "none", cursor: "pointer",
                          background: selectedArticle?.id === art.id ? "#eff6ff" : "transparent",
                          color: selectedArticle?.id === art.id ? "#1d4ed8" : "#374151",
                          borderBottom: "1px solid #f9fafb",
                          fontWeight: selectedArticle?.id === art.id ? 600 : 400,
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

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "24px 32px" }}>
        {selectedArticle ? (
          <ArticleView article={selectedArticle} onBack={() => setSelectedArticle(null)} />
        ) : selectedChapter ? (
          <ChapterView chapter={selectedChapter} onSelectArticle={setSelectedArticle} />
        ) : null}
      </div>
    </div>
  );
}

// ─── InternalRegulationTab (좌측: 규정 선택 / 우측: 해당 규정 내용) ───────────

function InternalRegulationTab() {
  const [selectedReg, setSelectedReg] = useState<RegEntry>(INTERNAL_REGS[0]);

  return (
    <div style={{ display: "flex", height: "calc(100vh - 160px)" }}>
      {/* Regulation selector sidebar */}
      <div
        style={{
          width: 200,
          flexShrink: 0,
          borderRight: "1px solid #e5e7eb",
          overflowY: "auto",
          background: "#f0f4f8",
        }}
      >
        <div style={{ padding: "10px 12px 6px", fontSize: 10, fontWeight: 700, color: "#9ca3af", letterSpacing: "0.06em" }}>
          근로복지공단 내부규정
        </div>
        {INTERNAL_REGS.map((reg) => {
          const isActive = selectedReg.id === reg.id;
          return (
            <button
              key={reg.id}
              onClick={() => setSelectedReg(reg)}
              style={{
                display: "block", width: "100%", textAlign: "left",
                padding: "9px 14px", fontSize: 12, border: "none", cursor: "pointer",
                background: isActive ? "#1d4ed8" : "transparent",
                color: isActive ? "#fff" : "#374151",
                fontWeight: isActive ? 700 : 400,
                borderLeft: isActive ? "3px solid #1e40af" : "3px solid transparent",
                lineHeight: 1.5,
              }}
            >
              {reg.label}
            </button>
          );
        })}
      </div>

      {/* Regulation content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Regulation title bar */}
        <div style={{ padding: "10px 16px", borderBottom: "1px solid #e5e7eb", background: "#fff", flexShrink: 0 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>{selectedReg.label}</span>
        </div>
        <RegulationPanel key={selectedReg.id} dataUrl={selectedReg.dataUrl} />
      </div>
    </div>
  );
}

// 항목 기호 판별 (원문자·1~2자리 숫자목·가나다목만 — 연도 4자리 숫자 제외)
const ITEM_MARKER_RE = /^(?:[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳]|[1-9]\d?\.|[가나다라마바사아자차카타파하]\.)$/;
// 단락 분리 기준 (연도처럼 보이는 4자리 숫자는 제외)
const SPLIT_RE = /(?<=[^\d])([①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳]|(?<!\d)[1-9]\d?\.\s|(?<![0-9])[가나다라마바사아자차카타파하]\.\s)/g;

function formatArticleContent(raw: string): Array<{ body: string; amendment: string | null }> {
  // 1) <개정 …> 블록을 하나의 토큰으로 정규화 (내부 공백·줄바꿈 압축)
  const normalized = raw.replace(/<개정[^>]*>/g, (m) => m.replace(/\s+/g, " ").trim());

  // 2) 항목 기호 앞에서 단락 분리 (연도 숫자는 분리 안 함)
  const parts = normalized.split(SPLIT_RE).filter((s) => s.trim().length > 0);

  const paragraphs: string[] = [];
  let buffer = "";
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    if (ITEM_MARKER_RE.test(trimmed)) {
      if (buffer.trim()) paragraphs.push(buffer.trim());
      buffer = trimmed + " ";
    } else {
      buffer += part;
    }
  }
  if (buffer.trim()) paragraphs.push(buffer.trim());
  const result = paragraphs.length > 0 ? paragraphs : [normalized];

  // 3) 각 단락에서 <개정 …> 부분을 분리해 별도 표시용으로 반환
  return result.map((para) => {
    const idx = para.indexOf("<개정");
    if (idx === -1) return { body: para, amendment: null };
    return {
      body: para.slice(0, idx).trim(),
      amendment: para.slice(idx).trim(),
    };
  });
}

function ArticleView({
  article,
  onBack,
}: {
  article: Article;
  onBack: () => void;
}) {
  const paragraphs = formatArticleContent(article.content);

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
          fontSize: 16,
          fontWeight: 700,
          color: "#111827",
          marginBottom: 20,
          paddingBottom: 12,
          borderBottom: "2px solid #e5e7eb",
        }}
      >
        {article.number}({article.title})
      </h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {paragraphs.map(({ body, amendment }, i) => {
          const isItem = /^[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳1-9가나다라마바사아자차카타파하]/.test(body);
          return (
            <div key={i} style={{ paddingLeft: isItem ? 8 : 0 }}>
              <p style={{ fontSize: 14, lineHeight: 1.9, color: "#374151", margin: 0, wordBreak: "keep-all" }}>
                {body}
              </p>
              {amendment && (
                <p style={{ fontSize: 12, lineHeight: 1.7, color: "#9ca3af", margin: "2px 0 0 0", wordBreak: "keep-all" }}>
                  {amendment}
                </p>
              )}
            </div>
          );
        })}
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

// ─── 근로복지공단 지침 ──────────────────────────────────────────────────────────

const G_CAT1 = [
  { key: "산재일반", label: "산재 일반" },
  { key: "상병별",   label: "상병별 상세" },
] as const;

const G_CAT2: Record<string, { key: string; label: string }[]> = {
  산재일반: [
    { key: "요양",     label: "요양" },
    { key: "보상",     label: "보상" },
    { key: "평균임금", label: "평균임금" },
    { key: "기타일반", label: "기타" },
  ],
  상병별: [
    { key: "소음성난청", label: "소음성 난청" },
    { key: "COPD",       label: "COPD (만성폐쇄성폐질환)" },
    { key: "진폐",       label: "진폐" },
    { key: "근골격계",   label: "근골격계 질환" },
    { key: "정신질환",   label: "정신 질환" },
    { key: "뇌심혈관계", label: "뇌심혈관계 질환" },
    { key: "직업성암",   label: "직업성 암" },
    { key: "석면폐증",   label: "석면폐증" },
    { key: "기타상병",   label: "기타" },
  ],
};

type GuidanceEntry = {
  id: string;
  title: string;
  cat1: string;
  cat2?: string | null;
  fileUrl: string;
  description?: string | null;
  fileSize?: number;
  createdAt?: string;
};

// 정적 fallback (배포 직후 / DB 비었을 때 표시)
const STATIC_GUIDANCE_LIST: GuidanceEntry[] = [
  { id: "static-g1", cat1: "상병별", cat2: "소음성난청", title: "소음성 난청 업무처리기준 개선 전문 (2021.12.23. 시행)", fileUrl: "/docs/소음성_난청_업무처리기준_2021.pdf" },
];

type GSelState = { cat1?: string; cat2?: string };

function GuidelinesTab({ isAdmin }: { isAdmin: boolean }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [sel, setSel] = useState<GSelState>({});
  const [selectedPdf, setSelectedPdf] = useState<GuidanceEntry | null>(null);
  const [dbGuidances, setDbGuidances] = useState<GuidanceEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);

  // DB 목록 조회
  const reloadList = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/kwc-guideline");
      if (!res.ok) throw new Error("조회 실패");
      const items: Array<{
        id: string;
        attachmentType: string;
        number: string | null;
        title: string;
        description: string | null;
        fileSize: number;
        createdAt: string;
      }> = await res.json();
      setDbGuidances(
        items.map(it => ({
          id: it.id,
          cat1: it.attachmentType,
          cat2: it.number,
          title: it.title,
          description: it.description,
          fileSize: it.fileSize,
          createdAt: it.createdAt,
          fileUrl: `/api/kwc-guideline/${it.id}/file?inline=1`,
        }))
      );
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reloadList();
  }, []);

  // 정적 + DB 병합 (DB 우선, 정적은 fallback)
  const allList: GuidanceEntry[] = [...dbGuidances, ...STATIC_GUIDANCE_LIST];

  function toggleExpand(key: string) {
    setExpanded(prev => {
      const n = new Set(prev);
      n.has(key) ? n.delete(key) : n.add(key);
      return n;
    });
  }

  function cntPdf(cat1: string, cat2?: string) {
    return allList.filter(g =>
      g.cat1 === cat1 && (cat2 === undefined || g.cat2 === cat2)
    ).length;
  }

  const filtered = allList.filter(g =>
    (!sel.cat1 || g.cat1 === sel.cat1) &&
    (!sel.cat2 || g.cat2 === sel.cat2)
  );

  async function handleDelete(id: string) {
    if (!confirm("이 지침을 삭제하시겠습니까?")) return;
    try {
      const res = await fetch(`/api/kwc-guideline/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "삭제 실패");
      }
      await reloadList();
      if (selectedPdf?.id === id) setSelectedPdf(null);
    } catch (err) {
      alert((err as Error).message);
    }
  }

  return (
    <div style={{ display: "flex", height: "calc(100vh - 160px)" }}>
      {/* 왼쪽: 트리 사이드바 */}
      <div style={{ width: 240, flexShrink: 0, borderRight: "1px solid #e5e7eb", overflowY: "auto", background: "#f9fafb", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "8px 10px" }}>
          {/* 전체 */}
          <button
            onClick={() => { setSel({}); setSelectedPdf(null); }}
            style={{
              display: "flex", alignItems: "center", width: "100%", textAlign: "left",
              padding: "6px 8px", fontSize: 12, border: "none", cursor: "pointer", borderRadius: 4,
              background: !sel.cat1 ? "#dbeafe" : "transparent",
              color: !sel.cat1 ? "#1d4ed8" : "#374151", fontWeight: !sel.cat1 ? 700 : 400,
            }}
          >
            <span style={{ flex: 1 }}>전체</span>
            <span style={{ fontSize: 10, color: "#9ca3af" }}>{allList.length}</span>
          </button>

          {G_CAT1.map(c1 => {
            const count = cntPdf(c1.key);
            const c2List = G_CAT2[c1.key] ?? [];
            const open = expanded.has(c1.key);
            const active = sel.cat1 === c1.key && !sel.cat2;

            return (
              <div key={c1.key}>
                <button
                  onClick={() => { toggleExpand(c1.key); setSel({ cat1: c1.key }); setSelectedPdf(null); }}
                  style={{
                    display: "flex", alignItems: "center", gap: 4, width: "100%", textAlign: "left",
                    padding: "6px 8px", fontSize: 12, border: "none", cursor: "pointer", borderRadius: 4,
                    background: active ? "#dbeafe" : "transparent",
                    color: active ? "#1d4ed8" : "#374151", fontWeight: active ? 700 : 600,
                  }}
                >
                  <span style={{ fontSize: 9, color: "#9ca3af", width: 12, textAlign: "center" }}>
                    {open ? "▼" : "▶"}
                  </span>
                  <span style={{ flex: 1, lineHeight: 1.4 }}>{c1.label}</span>
                  <span style={{ fontSize: 10, color: "#9ca3af" }}>{count}</span>
                </button>

                {open && c2List.map(c2 => {
                  const c2Count = cntPdf(c1.key, c2.key);
                  const c2Active = sel.cat1 === c1.key && sel.cat2 === c2.key;
                  return (
                    <button
                      key={c2.key}
                      onClick={() => { setSel({ cat1: c1.key, cat2: c2.key }); setSelectedPdf(null); }}
                      style={{
                        display: "flex", alignItems: "center", gap: 4, width: "100%", textAlign: "left",
                        padding: "5px 8px 5px 24px", fontSize: 12, border: "none", cursor: "pointer", borderRadius: 4,
                        background: c2Active ? "#dbeafe" : "transparent",
                        color: c2Active ? "#1d4ed8" : "#4b5563", fontWeight: c2Active ? 600 : 400,
                      }}
                    >
                      <span style={{ flex: 1 }}>{c2.label}</span>
                      <span style={{ fontSize: 10, color: c2Count > 0 ? "#9ca3af" : "#d1d5db" }}>{c2Count}</span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* 오른쪽: PDF 목록 + 뷰어 */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {selectedPdf ? (
          <>
            <div style={{ padding: "8px 16px", borderBottom: "1px solid #e5e7eb", background: "#fff", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
              <button onClick={() => setSelectedPdf(null)}
                style={{ fontSize: 12, color: "#6b7280", background: "none", border: "none", cursor: "pointer", padding: 0, flexShrink: 0 }}>
                ← 목록으로
              </button>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#111827", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {selectedPdf.title}
              </span>
              <a href={selectedPdf.fileUrl} download
                style={{ fontSize: 12, color: "#3b82f6", textDecoration: "none", flexShrink: 0 }}>
                ⬇ 다운로드
              </a>
            </div>
            <div style={{ flex: 1, overflow: "hidden", background: "#525659" }}>
              <InlinePdfViewer fileUrl={selectedPdf.fileUrl} />
            </div>
          </>
        ) : (
          <>
            {/* 목록 상단: 등록 버튼 (ADMIN만) */}
            <div style={{ padding: "10px 16px", borderBottom: "1px solid #e5e7eb", background: "#fff", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
              <span style={{ fontSize: 13, color: "#6b7280" }}>
                총 {filtered.length}건
                {loading && <span style={{ marginLeft: 8, color: "#9ca3af" }}>(불러오는 중...)</span>}
              </span>
              {isAdmin && (
                <button
                  onClick={() => setShowUploadModal(true)}
                  style={{
                    marginLeft: "auto", padding: "6px 14px", fontSize: 12, fontWeight: 600,
                    background: "#29ABE2", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer",
                  }}
                >
                  + 지침 PDF 등록
                </button>
              )}
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
              {filtered.length === 0 ? (
                <div style={{ textAlign: "center", padding: 48, color: "#9ca3af", fontSize: 14 }}>
                  등록된 지침이 없습니다.
                  {isAdmin && (
                    <div style={{ marginTop: 12 }}>
                      <button
                        onClick={() => setShowUploadModal(true)}
                        style={{ padding: "6px 14px", fontSize: 12, background: "#29ABE2", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}
                      >
                        + 첫 지침 등록하기
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {filtered.map(g => {
                    const c1Label = G_CAT1.find(c => c.key === g.cat1)?.label ?? g.cat1;
                    const c2Label = g.cat2 ? (G_CAT2[g.cat1]?.find(c => c.key === g.cat2)?.label ?? g.cat2) : null;
                    const isStatic = g.id.startsWith("static-");
                    return (
                      <div
                        key={g.id}
                        style={{
                          display: "flex", alignItems: "center", gap: 12,
                          padding: "12px 16px", border: "1px solid #e5e7eb", borderRadius: 8,
                          background: "#fff",
                        }}
                      >
                        <button
                          onClick={() => setSelectedPdf(g)}
                          style={{
                            display: "flex", alignItems: "center", gap: 12, flex: 1, textAlign: "left",
                            background: "transparent", border: "none", cursor: "pointer", padding: 0,
                          }}
                        >
                          <span style={{ fontSize: 20, flexShrink: 0 }}>📄</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "#111827", lineHeight: 1.5 }}>
                              {g.title}
                            </div>
                            {g.description && (
                              <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2, lineHeight: 1.5 }}>
                                {g.description}
                              </div>
                            )}
                            {(g.fileSize || g.createdAt) && (
                              <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 3, display: "flex", gap: 10 }}>
                                {g.fileSize && <span>{(g.fileSize / 1024 / 1024).toFixed(2)} MB</span>}
                                {g.createdAt && <span>{new Date(g.createdAt).toLocaleDateString("ko-KR")}</span>}
                              </div>
                            )}
                          </div>
                        </button>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3, flexShrink: 0 }}>
                          {!sel.cat1 && (
                            <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 6, background: "#dbeafe", color: "#1e40af", fontWeight: 600, whiteSpace: "nowrap" }}>
                              {c1Label}
                            </span>
                          )}
                          {!sel.cat2 && c2Label && (
                            <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 6, background: "#f3f4f6", color: "#4b5563", whiteSpace: "nowrap" }}>
                              {c2Label}
                            </span>
                          )}
                          {isAdmin && !isStatic && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDelete(g.id); }}
                              style={{ fontSize: 10, padding: "2px 6px", borderRadius: 6, background: "#fee2e2", color: "#dc2626", border: "none", cursor: "pointer", fontWeight: 600 }}
                            >
                              삭제
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* 업로드 모달 */}
      {showUploadModal && (
        <KwcGuidelineUploadModal
          onClose={() => setShowUploadModal(false)}
          onUploaded={async () => { setShowUploadModal(false); await reloadList(); }}
        />
      )}
    </div>
  );
}

// ─── 지침 PDF 업로드 모달 ─────────────────────────────────────────────────────

function KwcGuidelineUploadModal({ onClose, onUploaded }: { onClose: () => void; onUploaded: () => void }) {
  const [cat1, setCat1] = useState<string>(G_CAT1[0].key);
  const [cat2, setCat2] = useState<string>("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const c2Options = G_CAT2[cat1] ?? [];

  async function submit() {
    setError(null);
    if (!file) return setError("파일을 선택해주세요.");
    if (!title.trim()) return setError("제목을 입력해주세요.");
    if (file.size > 10 * 1024 * 1024) return setError("파일 크기는 10MB 이하여야 합니다.");
    if (file.type !== "application/pdf") return setError("PDF 파일만 등록 가능합니다.");

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("cat1", cat1);
      if (cat2) fd.append("cat2", cat2);
      fd.append("title", title.trim());
      if (description.trim()) fd.append("description", description.trim());

      const res = await fetch("/api/kwc-guideline", { method: "POST", body: fd });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "업로드 실패");
      }
      onUploaded();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.5)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "#fff", borderRadius: 12, width: 460, maxWidth: "100%",
          padding: 0, boxShadow: "0 20px 60px rgba(0,0,0,0.3)", overflow: "hidden",
        }}
      >
        <div style={{ padding: "14px 20px", borderBottom: "1px solid #e5e7eb", background: "#f9fafb" }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#111827" }}>지침 PDF 등록</h3>
        </div>

        <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
          {/* 분류 1 */}
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>분류</label>
            <select
              value={cat1}
              onChange={e => { setCat1(e.target.value); setCat2(""); }}
              style={{ width: "100%", padding: "7px 10px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 6 }}
            >
              {G_CAT1.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
          </div>

          {/* 분류 2 */}
          {c2Options.length > 0 && (
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>세부 분류 (선택)</label>
              <select
                value={cat2}
                onChange={e => setCat2(e.target.value)}
                style={{ width: "100%", padding: "7px 10px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 6 }}
              >
                <option value="">-- 미지정 --</option>
                {c2Options.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </div>
          )}

          {/* 제목 */}
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>제목 *</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="예: 산재보험 업무처리기준 2024"
              style={{ width: "100%", padding: "7px 10px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 6, boxSizing: "border-box" }}
            />
          </div>

          {/* 설명 */}
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>설명 (선택)</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              placeholder="지침 요약이나 시행일 등"
              style={{ width: "100%", padding: "7px 10px", fontSize: 12, border: "1px solid #d1d5db", borderRadius: 6, boxSizing: "border-box", resize: "vertical", fontFamily: "inherit" }}
            />
          </div>

          {/* 파일 */}
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>PDF 파일 * (최대 10MB)</label>
            <input
              type="file"
              accept="application/pdf"
              onChange={e => setFile(e.target.files?.[0] ?? null)}
              style={{ fontSize: 12, color: "#374151" }}
            />
            {file && (
              <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>
                {file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB
              </div>
            )}
          </div>

          {error && (
            <div style={{ padding: "8px 10px", background: "#fee2e2", color: "#dc2626", fontSize: 12, borderRadius: 6 }}>
              {error}
            </div>
          )}
        </div>

        <div style={{ padding: "12px 20px", borderTop: "1px solid #e5e7eb", display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            disabled={submitting}
            style={{ padding: "7px 16px", fontSize: 13, background: "#f3f4f6", color: "#374151", border: "1px solid #d1d5db", borderRadius: 6, cursor: submitting ? "not-allowed" : "pointer" }}
          >
            취소
          </button>
          <button
            onClick={submit}
            disabled={submitting || !file || !title.trim()}
            style={{
              padding: "7px 16px", fontSize: 13, fontWeight: 600,
              background: submitting || !file || !title.trim() ? "#94a3b8" : "#29ABE2",
              color: "#fff", border: "none", borderRadius: 6,
              cursor: submitting || !file || !title.trim() ? "not-allowed" : "pointer",
            }}
          >
            {submitting ? "업로드 중..." : "등록"}
          </button>
        </div>
      </div>
    </div>
  );
}


// ─── Main Page ───────────────────────────────────────────────────────────────

const TABS = [
  { id: "law",        label: "관련 법령" },
  { id: "internal",   label: "근로복지공단 내부규정" },
  { id: "guidelines", label: "근로복지공단 지침" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function LawPage() {
  const [activeTab, setActiveTab] = useState<TabId>("law");
  const { data: session } = useSession();
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === "ADMIN";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        fontFamily: "'Malgun Gothic', 'Apple SD Gothic Neo', 'Segoe UI', sans-serif",
      }}
    >
      {/* Header */}
      <div style={{ padding: "16px 24px 0", borderBottom: "1px solid #e5e7eb", background: "#fff" }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: "#111827", marginBottom: 12 }}>
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
                borderBottom: activeTab === tab.id ? "2px solid #1d4ed8" : "2px solid transparent",
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
        {activeTab === "law"        && <LawTab />}
        {activeTab === "internal"   && <InternalRegulationTab />}
        {activeTab === "guidelines" && <GuidelinesTab isAdmin={isAdmin} />}
      </div>
    </div>
  );
}
