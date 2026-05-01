"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import QuickLinks from "./QuickLinks";

type MenuItem = {
  id: string;
  label: string;
  icon: string;
  path?: string;
  children?: { id: string; label: string; path: string }[];
  restricted?: "org" | "admin";
};

type SearchResult = {
  id: string;
  caseType: string;
  status: string;
  patient: { id: string; name: string; ssn: string | null } | null;
};

type EmpResult = {
  id: string;
  name: string;
  branch: string;
  title: string;
  jobGrade: string;
  mobile: string;
  hireDate: string | null;
};

const MENU_ITEMS: MenuItem[] = [
  { id: "todo", label: "To Do List", icon: "☑", path: "/todo" },
  { id: "law", label: "법령 및 규정", icon: "📜", path: "/law" },
  { id: "grade", label: "실무 참고 정보", icon: "📊", path: "/grade" },
  { id: "forms", label: "서식 작성", icon: "📝", path: "/forms" },
  { id: "tf-special-clinic", label: "통합 캘린더", icon: "📅", path: "/tf/special-clinic" },
  {
    id: "cases",
    label: "사건 관리",
    icon: "📁",
    children: [
      { id: "consultation", label: "상담 관리", path: "/consultation" },
      { id: "cases-list", label: "사건 목록", path: "/cases" },
      { id: "patients-list", label: "재해자 목록", path: "/patients" },
      { id: "pneumoconiosis-list", label: "진폐 사건", path: "/cases/pneumoconiosis" },
      { id: "copd-list", label: "COPD 사건", path: "/cases/copd" },
      { id: "bereaved-list", label: "유족급여 사건", path: "/cases/bereaved" },
      { id: "musculoskeletal-list", label: "근골격계 사건", path: "/cases/musculoskeletal" },
      { id: "occupational-accident-list", label: "업무상사고 사건", path: "/cases/occupational-accident" },
      { id: "occupational-cancer-list", label: "직업성암 사건", path: "/cases/occupational-cancer" },
      { id: "settlement", label: "정산 관리", path: "/settlement" },
    ],
  },
  { id: "cases-view", label: "사건 조회", icon: "🔍", path: "/cases-view" },
  {
    id: "objection",
    label: "이의제기 관리",
    icon: "⚖",
    children: [
      { id: "objection-review", label: "처분 검토", path: "/objection/review" },
      { id: "objection-deadline", label: "기일 관리", path: "/objection/deadline" },
      { id: "decision-notice", label: "결정통지서 OCR", path: "/notice/decision" },
      { id: "avg-wage", label: "평균임금 정정 검토", path: "/wage/avg-wage" },
      { id: "objection-forms", label: "이의제기 양식 작성", path: "/forms/objection" },
    ],
  },
  { id: "inquiry", label: "사건 조회", icon: "🔍", path: "/inquiry" },
  { id: "branch", label: "지사장 관리·운영", icon: "🏢", path: "/branch", restricted: "org" },
  { id: "admin", label: "관리자 페이지", icon: "⚙", path: "/admin", restricted: "admin" },
];

function getPageInfo(pathname: string | null): { title: string; section: string } {
  if (!pathname) return { title: "TBSS", section: "" };
  for (const item of MENU_ITEMS) {
    if (item.path && (pathname === item.path || pathname.startsWith(item.path + "/"))) {
      return { title: item.label, section: item.label };
    }
    if (item.children) {
      for (const child of item.children) {
        if (pathname === child.path || pathname.startsWith(child.path + "/")) {
          return { title: child.label, section: item.label };
        }
      }
    }
  }
  return { title: "TBSS", section: "" };
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [openMenus, setOpenMenus] = useState<Set<string>>(new Set(["cases"]));
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const searchBoxRef = useRef<HTMLDivElement>(null);

  const [empQuery, setEmpQuery] = useState("");
  const [empResults, setEmpResults] = useState<EmpResult[]>([]);
  const [empOpen, setEmpOpen] = useState(false);
  const empRef = useRef<HTMLInputElement>(null);
  const empBoxRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();

  const role = (session?.user as { role?: string })?.role ?? "";
  const { title, section } = getPageInfo(pathname);

  // Auto-expand active parent menu
  useEffect(() => {
    for (const item of MENU_ITEMS) {
      if (item.children?.some((c) => pathname === c.path || pathname?.startsWith(c.path + "/"))) {
        setOpenMenus((prev) => new Set([...prev, item.id]));
      }
    }
  }, [pathname]);

  // ⌘K / Ctrl+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchRef.current?.focus();
        setSearchOpen(true);
      }
      if (e.key === "Escape") {
        setSearchOpen(false);
        searchRef.current?.blur();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Click outside to close dropdowns
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
      if (empBoxRef.current && !empBoxRef.current.contains(e.target as Node)) {
        setEmpOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Debounced case search
  const doSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setSearchResults([]); return; }
    try {
      const res = await fetch(`/api/cases?search=${encodeURIComponent(q)}&limit=8`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults(Array.isArray(data) ? data.slice(0, 8) : []);
      }
    } catch { setSearchResults([]); }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => doSearch(searchQuery), 250);
    return () => clearTimeout(t);
  }, [searchQuery, doSearch]);

  // Debounced employee search
  const doEmpSearch = useCallback(async (q: string) => {
    if (q.trim().length < 1) { setEmpResults([]); return; }
    try {
      const params = new URLSearchParams({ firmType: "TBOSANG", search: q });
      const res = await fetch(`/api/contacts?${params}`);
      if (res.ok) {
        const data = await res.json();
        setEmpResults((data.contacts || []).slice(0, 8));
      }
    } catch { setEmpResults([]); }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => doEmpSearch(empQuery), 250);
    return () => clearTimeout(t);
  }, [empQuery, doEmpSearch]);

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && searchQuery.trim()) {
      router.push(`/cases?search=${encodeURIComponent(searchQuery.trim())}`);
      setSearchOpen(false);
      setSearchQuery("");
      searchRef.current?.blur();
    }
  };

  const toggleMenu = (id: string) => {
    setOpenMenus((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleMenuClick = (item: MenuItem) => {
    if (item.children) {
      toggleMenu(item.id);
    } else if (item.path) {
      router.push(item.path);
    }
  };

  const isActive = (path?: string, children?: { path: string }[]): boolean => {
    if (!pathname) return false;
    if (path && (pathname === path || pathname.startsWith(path + "/"))) return true;
    if (children) return children.some((c) => pathname === c.path || pathname.startsWith(c.path + "/"));
    return false;
  };

  const visibleItems =
    role === "이산계정"
      ? MENU_ITEMS.filter((m) => m.path === "/cases-view")
      : MENU_ITEMS.filter((m) => {
          if (m.id === "cases-view") return false;
          if (m.restricted === "admin" && role !== "ADMIN") return false;
          if (
            m.restricted === "org" &&
            !["ADMIN", "MANAGER", "SENIOR_MANAGER", "SITE_MANAGER"].includes(role)
          )
            return false;
          return true;
        });

  const userName = session?.user?.name || session?.user?.email || "";
  const userInitial = userName.charAt(0).toUpperCase();
  const userBranch = (session?.user as { branch?: string })?.branch || "";

  return (
    <div className="tbss-app">
      {/* ── Sidebar ── */}
      <aside className="sidebar">
        {/* Brand — click to go home */}
        <div
          className="brand"
          onClick={() => router.push("/")}
          style={{ cursor: "pointer" }}
          title="홈으로"
        >
          <div className="mark">
            노무법인 더보상
            <span className="en">The Bosang · TBSS</span>
          </div>
        </div>

        {/* Navigation */}
        <div className="sec-label">Workspace</div>
        <nav className="nav">
          {visibleItems.map((item) => {
            const active = isActive(item.path, item.children);
            const isOpen = openMenus.has(item.id);

            return (
              <div key={item.id}>
                <button
                  className={`nav-item${active ? " active" : ""}`}
                  onClick={() => handleMenuClick(item)}
                  title={item.label}
                >
                  <span style={{ fontSize: 15, lineHeight: 1, flexShrink: 0 }}>{item.icon}</span>
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {item.children && (
                    <span
                      style={{
                        fontSize: 9,
                        opacity: 0.5,
                        transform: isOpen ? "rotate(90deg)" : "none",
                        transition: "transform .15s",
                      }}
                    >
                      ▶
                    </span>
                  )}
                </button>

                {item.children && isOpen && (
                  <div className="nav-sub">
                    {item.children
                      .map((child) => {
                        const childActive =
                          !!pathname &&
                          (pathname === child.path || pathname.startsWith(child.path + "/"));
                        return (
                          <button
                            key={child.id}
                            className={`nav-sub-item${childActive ? " active" : ""}`}
                            onClick={() => router.push(child.path)}
                          >
                            {child.label}
                          </button>
                        );
                      })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="foot">
          v2.4.0 · 2026.04
          <br />
          문의 : 이정준 노무사 010-9248-5596
        </div>
      </aside>

      {/* ── Main area ── */}
      <div className="main-area">
        {/* Topbar — 홈('/') 에서는 히어로와 이어지도록 딥그린 */}
        <header
          className="topbar"
          style={pathname === "/" ? {
            background: "var(--deep)",
            borderBottom: "none",
          } : undefined}
        >
          <div className="crumbs" style={pathname === "/" ? { color: "rgba(255,255,255,.6)" } : undefined}>
            <span>TBSS</span>
            {section && (
              <>
                <span className="sep">/</span>
                <span>{section}</span>
              </>
            )}
            {section !== title && (
              <>
                <span className="sep">/</span>
                <span className={pathname === "/" ? "" : "cur"}
                  style={pathname === "/" ? { color: "rgba(255,255,255,.9)", fontWeight: 500 } : undefined}
                >{title}</span>
              </>
            )}
          </div>

          {/* Functional search */}
          <div
            ref={searchBoxRef}
            className="search-box"
            style={{
              position: "relative",
              ...(pathname === "/" ? {
                background: "rgba(255,255,255,.1)",
                border: "1px solid rgba(255,255,255,.18)",
              } : {}),
            }}
          >
            <span style={{ fontSize: 13, color: pathname === "/" ? "rgba(255,255,255,.6)" : "var(--ink-400)", flexShrink: 0 }}>🔍</span>
            <input
              ref={searchRef}
              type="text"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setSearchOpen(true); }}
              onFocus={() => setSearchOpen(true)}
              onKeyDown={handleSearchKeyDown}
              placeholder="사건번호, 성명, 주민번호로 검색"
              style={{
                flex: 1,
                border: "none",
                outline: "none",
                background: "transparent",
                fontSize: 13,
                color: pathname === "/" ? "rgba(255,255,255,.9)" : "var(--ink-700)",
                minWidth: 0,
              }}
            />
            <span
              style={{
                fontSize: 11,
                color: pathname === "/" ? "rgba(255,255,255,.45)" : "var(--ink-400)",
                border: `1px solid ${pathname === "/" ? "rgba(255,255,255,.2)" : "var(--paper-line)"}`,
                padding: "1px 6px",
                borderRadius: 3,
                flexShrink: 0,
                whiteSpace: "nowrap",
              }}
            >
              ⌘K
            </span>

            {/* Dropdown results */}
            {searchOpen && searchQuery.trim().length >= 2 && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 6px)",
                  left: 0,
                  right: 0,
                  background: "#fff",
                  border: "1px solid var(--paper-line)",
                  borderRadius: 8,
                  boxShadow: "0 8px 24px rgba(0,0,0,.12)",
                  zIndex: 200,
                  maxHeight: 320,
                  overflowY: "auto",
                }}
              >
                {searchResults.length === 0 ? (
                  <div style={{ padding: "14px 16px", fontSize: 13, color: "var(--ink-400)" }}>
                    검색 결과가 없습니다.
                  </div>
                ) : (
                  <>
                    {searchResults.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => {
                          router.push(`/cases/${c.id}`);
                          setSearchOpen(false);
                          setSearchQuery("");
                        }}
                        style={{
                          width: "100%",
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "10px 14px",
                          background: "none",
                          border: "none",
                          borderBottom: "1px solid var(--paper-line)",
                          cursor: "pointer",
                          textAlign: "left",
                          fontSize: 13,
                          color: "var(--ink-700)",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                      >
                        <span style={{ fontWeight: 600, color: "var(--ink-900)", flex: 1 }}>
                          {c.patient?.name ?? "—"}
                        </span>
                        <span style={{ fontSize: 11, color: "var(--ink-400)" }}>
                          {c.patient?.ssn ? c.patient.ssn.replace(/(\d{6})-?(\d{7})/, "$1-*******") : ""}
                        </span>
                        <span
                          style={{
                            fontSize: 11,
                            background: "var(--sky-wash)",
                            color: "var(--sky-ink)",
                            padding: "2px 6px",
                            borderRadius: 4,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {c.caseType}
                        </span>
                      </button>
                    ))}
                    <button
                      onClick={() => {
                        router.push(`/cases?search=${encodeURIComponent(searchQuery.trim())}`);
                        setSearchOpen(false);
                        setSearchQuery("");
                      }}
                      style={{
                        width: "100%",
                        padding: "10px 14px",
                        background: "var(--surface)",
                        border: "none",
                        cursor: "pointer",
                        fontSize: 12,
                        color: "var(--sky-ink)",
                        fontWeight: 600,
                        textAlign: "center",
                      }}
                    >
                      전체 결과 보기 →
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Employee search */}
          <div
            ref={empBoxRef}
            style={{
              position: "relative",
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: pathname === "/" ? "rgba(255,255,255,.1)" : "var(--surface)",
              border: `1px solid ${pathname === "/" ? "rgba(255,255,255,.18)" : "var(--paper-line)"}`,
              borderRadius: 8,
              padding: "5px 10px",
              minWidth: 180,
            }}
          >
            <span style={{ fontSize: 12, color: pathname === "/" ? "rgba(255,255,255,.6)" : "var(--ink-400)", flexShrink: 0 }}>👤</span>
            <input
              ref={empRef}
              type="text"
              value={empQuery}
              onChange={(e) => { setEmpQuery(e.target.value); setEmpOpen(true); }}
              onFocus={() => setEmpOpen(true)}
              onKeyDown={(e) => { if (e.key === "Escape") { setEmpOpen(false); empRef.current?.blur(); } }}
              placeholder="임직원 검색"
              style={{
                flex: 1,
                border: "none",
                outline: "none",
                background: "transparent",
                fontSize: 13,
                color: pathname === "/" ? "rgba(255,255,255,.9)" : "var(--ink-700)",
                minWidth: 0,
              }}
            />
            {empOpen && empQuery.trim().length >= 1 && (
              <div style={{
                position: "absolute",
                top: "calc(100% + 6px)",
                left: 0,
                right: 0,
                background: "#fff",
                border: "1px solid var(--paper-line)",
                borderRadius: 8,
                boxShadow: "0 8px 24px rgba(0,0,0,.12)",
                zIndex: 200,
                minWidth: 360,
                maxHeight: 360,
                overflowY: "auto",
              }}>
                {empResults.length === 0 ? (
                  <div style={{ padding: "14px 16px", fontSize: 13, color: "var(--ink-400)" }}>검색 결과가 없습니다.</div>
                ) : (
                  empResults.map((c) => (
                    <div key={c.id} style={{
                      padding: "10px 14px",
                      borderBottom: "1px solid var(--paper-line)",
                      fontSize: 13,
                      color: "var(--ink-700)",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                        <span style={{ fontWeight: 700, color: "var(--ink-900)" }}>{c.name}</span>
                        <span style={{ fontSize: 11, background: "#f0fdf4", color: "#065f46", padding: "1px 6px", borderRadius: 4, border: "1px solid #d1fae5" }}>{c.jobGrade}</span>
                        <span style={{ fontSize: 11, color: "var(--ink-400)" }}>{c.title}</span>
                      </div>
                      <div style={{ display: "flex", gap: 12, fontSize: 11, color: "var(--ink-400)" }}>
                        <span>{c.branch}</span>
                        <span>{c.mobile || "-"}</span>
                        <span>{c.hireDate ? c.hireDate.slice(0, 10) : "-"}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          <div className="right">
            {session?.user && (
              <div
                className="user-chip"
                style={pathname === "/" ? {
                  background: "rgba(255,255,255,.1)",
                  border: "1px solid rgba(255,255,255,.18)",
                } : undefined}
              >
                <div className="avatar">{userInitial}</div>
                <div className="who">
                  <b style={pathname === "/" ? { color: "#fff" } : undefined}>{userName}</b>
                  <span style={pathname === "/" ? { color: "rgba(255,255,255,.55)" } : undefined}>{userBranch || role}</span>
                </div>
              </div>
            )}
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => router.push("/mypage/password")}
              title="비밀번호 변경"
              style={pathname === "/" ? { color: "rgba(255,255,255,.75)", borderColor: "rgba(255,255,255,.2)" } : undefined}
            >
              비밀번호 변경
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => signOut({ callbackUrl: `${window.location.origin}/login` })}
              style={pathname === "/" ? { color: "rgba(255,255,255,.75)", borderColor: "rgba(255,255,255,.2)" } : undefined}
            >
              로그아웃
            </button>
          </div>
        </header>

        {/* Content */}
        <main style={{ flex: 1, overflowY: "auto", position: "relative" }}>
          {children}
          <QuickLinks />
        </main>
      </div>
    </div>
  );
}
