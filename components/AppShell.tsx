"use client";

import { useState, useEffect } from "react";
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

const MENU_ITEMS: MenuItem[] = [
  { id: "todo", label: "To Do List", icon: "☑", path: "/" },
  { id: "law", label: "법령 및 규정", icon: "📜", path: "/law" },
  { id: "grade", label: "장해등급·평균임금", icon: "📊", path: "/grade" },
  {
    id: "cases",
    label: "사건 관리",
    icon: "📁",
    children: [
      { id: "consultation", label: "상담 관리", path: "/consultation" },
      { id: "cases-list", label: "사건 목록", path: "/cases" },
      { id: "patients-list", label: "재해자 목록", path: "/patients" },
      { id: "cases-db", label: "사건 DB", path: "/cases/db" },
      { id: "cases-import", label: "데이터 임포트", path: "/cases/import" },
    ],
  },
  { id: "forms", label: "양식 관리", icon: "📋", path: "/forms", restricted: "admin" },
  { id: "inquiry", label: "사건 조회", icon: "🔍", path: "/inquiry" },
  { id: "cases-view", label: "사건 조회", icon: "🔍", path: "/cases-view" },
  {
    id: "objection",
    label: "이의제기 관리",
    icon: "⚖",
    children: [
      { id: "objection-review", label: "처분 검토", path: "/objection/review" },
      { id: "objection-deadline", label: "기일 관리", path: "/objection/deadline" },
      { id: "objection-document", label: "이유서·의견서", path: "/objection/document" },
    ],
  },
  {
    id: "tf",
    label: "TF 업무",
    icon: "📡",
    children: [
      { id: "tf-monitor", label: "담당TF 모니터링", path: "/tf-monitor" },
      { id: "tf-special-clinic", label: "통합 캘린더", path: "/tf/special-clinic" },
    ],
  },
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
        {/* Brand */}
        <div className="brand">
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
                      .filter((child) => {
                        if (child.id === "cases-db") return role === "ADMIN";
                        if (child.id === "cases-import") return role === "ADMIN";
                        return true;
                      })
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

        {/* User */}
        {session?.user && (
          <div className="sidebar-user" style={{ marginTop: "auto", marginBottom: 8 }}>
            <div className="avatar">{userInitial}</div>
            <div className="who">
              <b>{userName}</b>
              <span>{userBranch}</span>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="foot">
          v2.4.0 · 2026.04
          <br />
          문의 : 전산실 내선 208
        </div>
      </aside>

      {/* ── Main area ── */}
      <div className="main-area">
        {/* Topbar */}
        <header className="topbar">
          <div className="crumbs">
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
                <span className="cur">{title}</span>
              </>
            )}
          </div>

          <div className="search-box">
            <span style={{ fontSize: 13, color: "var(--ink-400)" }}>🔍</span>
            <span>사건번호, 성명, 주민번호로 검색</span>
            <span
              style={{
                marginLeft: "auto",
                fontSize: 11,
                color: "var(--ink-400)",
                border: "1px solid var(--paper-line)",
                padding: "1px 6px",
                borderRadius: 3,
              }}
            >
              ⌘K
            </span>
          </div>

          <div className="right">
            {session?.user && (
              <div className="user-chip">
                <div className="avatar">{userInitial}</div>
                <div className="who">
                  <b>{userName}</b>
                  <span>{userBranch || role}</span>
                </div>
              </div>
            )}
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => router.push("/mypage/password")}
              title="비밀번호 변경"
            >
              비밀번호 변경
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => signOut({ callbackUrl: `${window.location.origin}/login` })}
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
