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
  {
    id: "cases",
    label: "사건 관리",
    icon: "📁",
    children: [
      { id: "consultation", label: "상담 관리", path: "/consultation" },
      { id: "cases-list", label: "사건 목록", path: "/cases" },
      { id: "patients-list", label: "재해자 목록", path: "/patients" },
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
      { id: "tf-notice", label: "TF 공지", path: "/tf-notice" },
      { id: "tf-stats", label: "TF 통계", path: "/tf-stats" },
    ],
  },
  { id: "grade", label: "장해등급·평균임금", icon: "📊", path: "/grade" },
  { id: "law", label: "법령 및 규정", icon: "📜", path: "/law" },
  { id: "issues", label: "주요 쟁점 사항", icon: "💡", path: "/issues" },
  { id: "branch", label: "지사장 관리·운영", icon: "🏢", path: "/branch", restricted: "org" },
  { id: "admin", label: "관리자 페이지", icon: "⚙", path: "/admin/users", restricted: "admin" },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [openMenus, setOpenMenus] = useState<Set<string>>(new Set(["cases"]));
  const [today, setToday] = useState("");
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();

  useEffect(() => {
    const d = new Date();
    setToday(
      d.toLocaleDateString("ko-KR", {
        year: "numeric",
        month: "long",
        day: "numeric",
        weekday: "short",
      })
    );
  }, []);

  const getPageTitle = (): string => {
    if (!pathname) return "TBSS";
    for (const item of MENU_ITEMS) {
      if (item.path && pathname === item.path) return item.label;
      if (item.children) {
        for (const child of item.children) {
          if (pathname === child.path || pathname.startsWith(child.path + "/"))
            return child.label;
        }
      }
    }
    return "TBSS";
  };

  const role = (session?.user as { role?: string })?.role ?? "";

  const toggleMenu = (id: string) => {
    setOpenMenus((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleMenuClick = (item: MenuItem) => {
    if (item.children) {
      if (collapsed) {
        setCollapsed(false);
        setOpenMenus((prev) => new Set([...prev, item.id]));
      } else {
        toggleMenu(item.id);
      }
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

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        fontFamily: "'Malgun Gothic', 'Apple SD Gothic Neo', 'Segoe UI', sans-serif",
        background: "#eef6f0",
      }}
    >
      {/* ── Header ── */}
      <header
        style={{
          height: 54,
          background: "#ffffff",
          borderBottom: "3px solid #8DC63F",
          display: "flex",
          alignItems: "center",
          padding: "0 16px",
          gap: 12,
          flexShrink: 0,
          zIndex: 50,
        }}
      >
        <button
          onClick={() => setCollapsed((c) => !c)}
          style={{
            background: "none",
            border: "none",
            color: "#94a3b8",
            fontSize: 20,
            cursor: "pointer",
            padding: "4px 8px",
            borderRadius: 6,
            lineHeight: 1,
          }}
        >
          ☰
        </button>
        <span style={{ color: "#006838", fontWeight: 700, fontSize: 15, flex: 1 }}>
          {getPageTitle()}
        </span>
        <span style={{ color: "#64748b", fontSize: 12 }}>{today}</span>
        <button
          onClick={() => signOut({ callbackUrl: `${window.location.origin}/login` })}
          style={{
            background: "#334155",
            border: "none",
            color: "#94a3b8",
            fontSize: 12,
            cursor: "pointer",
            padding: "5px 12px",
            borderRadius: 6,
          }}
        >
          로그아웃
        </button>
      </header>

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* ── Sidebar ── */}
        <aside
          style={{
            width: collapsed ? 60 : 220,
            transition: "width 0.2s ease",
            background: "#006838",
            display: "flex",
            flexDirection: "column",
            flexShrink: 0,
            overflowX: "hidden",
            overflowY: "auto",
          }}
        >
          {/* Logo */}
          <div
            style={{
              padding: "16px 14px",
              display: "flex",
              alignItems: "center",
              gap: 10,
              borderBottom: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                background: "#8DC63F",
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
                fontWeight: 900,
                fontSize: 13,
                flexShrink: 0,
              }}
            >
              더
            </div>
            {!collapsed && (
              <span style={{ color: "#e2e8f0", fontWeight: 800, fontSize: 14, letterSpacing: 0 }}>
                노무법인 더보상
              </span>
            )}
          </div>

          {/* Navigation */}
          <nav style={{ flex: 1, padding: "8px 0" }}>
            {(role === "이산계정"
              ? MENU_ITEMS.filter((m) => m.path === "/cases-view")
              : MENU_ITEMS.filter((m) => m.id !== "cases-view")
            ).map((item) => {
              const active = isActive(item.path, item.children);
              const isOpen = openMenus.has(item.id);
              const restricted = !!item.restricted;

              return (
                <div key={item.id}>
                  <button
                    onClick={() => handleMenuClick(item)}
                    title={collapsed ? item.label : undefined}
                    style={{
                      width: "100%",
                      background: active ? "rgba(41,171,226,0.2)" : "none",
                      border: "none",
                      borderLeft: active ? "3px solid #29ABE2" : "3px solid transparent",
                      color: active ? "#a8e6f8" : restricted ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.85)",
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: collapsed ? "10px 0" : "10px 14px",
                      justifyContent: collapsed ? "center" : "flex-start",
                      cursor: "pointer",
                      fontSize: 13,
                      textAlign: "left",
                      transition: "background 0.15s",
                    }}
                  >
                    <span style={{ fontSize: 16, flexShrink: 0 }}>{item.icon}</span>
                    {!collapsed && (
                      <>
                        <span style={{ flex: 1, fontWeight: active ? 600 : 400 }}>
                          {item.label}
                        </span>
                        {item.children && (
                          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.45)" }}>
                            {isOpen ? "▲" : "▼"}
                          </span>
                        )}
                      </>
                    )}
                  </button>

                  {/* Submenu */}
                  {!collapsed && item.children && isOpen && (
                    <div>
                      {item.children.filter((child) => {
                        if (child.id === "patients-list") return role === "ADMIN";
                        return true;
                      }).map((child) => {
                        const childActive =
                          !!pathname && (pathname === child.path || pathname.startsWith(child.path + "/"));
                        return (
                          <button
                            key={child.id}
                            onClick={() => router.push(child.path)}
                            style={{
                              width: "100%",
                              background: childActive ? "rgba(41,171,226,0.15)" : "none",
                              border: "none",
                              borderLeft: childActive
                                ? "3px solid #29ABE2"
                                : "3px solid transparent",
                              color: childActive ? "#a8e6f8" : "rgba(255,255,255,0.85)",
                              display: "flex",
                              alignItems: "center",
                              padding: "8px 14px 8px 44px",
                              cursor: "pointer",
                              fontSize: 12,
                              textAlign: "left",
                            }}
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

          {/* User info */}
          {session?.user && (
            <div
              style={{
                padding: collapsed ? "12px 0" : "12px 14px",
                borderTop: "1px solid rgba(255,255,255,0.08)",
                display: "flex",
                alignItems: "center",
                gap: 10,
                justifyContent: collapsed ? "center" : "flex-start",
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  background: "#29ABE2",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "white",
                  fontSize: 13,
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {(session.user.name || session.user.email || "?").charAt(0).toUpperCase()}
              </div>
              {!collapsed && (
                <div style={{ overflow: "hidden" }}>
                  <div
                    style={{
                      color: "#e2e8f0",
                      fontSize: 12,
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {session.user.name || session.user.email}
                  </div>
                  <div style={{ color: "#64748b", fontSize: 11 }}>
                    {(session.user as { branch?: string }).branch || ""}
                  </div>
                </div>
              )}
            </div>
          )}
        </aside>

        {/* ── Main Content ── */}
        <main style={{ flex: 1, overflowY: "auto", position: "relative" }}>
          {children}
          <QuickLinks />
        </main>
      </div>
    </div>
  );
}
