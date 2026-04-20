"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import Link from "next/link";

const QUICK_MENUS = [
  { label: "사건 목록", href: "/cases", icon: "📋" },
  { label: "재해자 목록", href: "/patients", icon: "👥" },
  { label: "To Do List", href: "/todo", icon: "☑️" },
  { label: "통합 캘린더", href: "/tf/special-clinic", icon: "📅" },
  { label: "장해등급·평균임금", href: "/grade", icon: "📊" },
  { label: "상담 관리", href: "/consultation", icon: "💬" },
  { label: "이의제기", href: "/objection/review", icon: "⚖️" },
  { label: "지사장 관리·운영", href: "/branch", icon: "🏢" },
];

interface TodoTask {
  id: string;
  title: string;
  isDone: boolean;
  dueDate: string | null;
}

interface TodoStats {
  total: number;
  done: number;
  rate: number;
}

export default function HomePage() {
  const { data: session } = useSession();
  const [stats, setStats] = useState<TodoStats | null>(null);
  const [todayTasks, setTodayTasks] = useState<TodoTask[]>([]);
  const [todayStr, setTodayStr] = useState("");

  const name = session?.user?.name || session?.user?.email || "";
  const branch = (session?.user as { branch?: string })?.branch || "";

  useEffect(() => {
    const now = new Date();
    setTodayStr(now.toLocaleDateString("ko-KR", {
      year: "numeric", month: "long", day: "numeric", weekday: "long",
    }));
    const today = now.toISOString().slice(0, 10);

    fetch(`/api/todos/stats?year=${now.getFullYear()}&month=${now.getMonth() + 1}`)
      .then(r => r.json()).then(setStats).catch(() => {});

    fetch("/api/todos")
      .then(r => r.json())
      .then((data: TodoTask[]) => {
        setTodayTasks(data.filter(t => t.dueDate?.slice(0, 10) === today).slice(0, 6));
      })
      .catch(() => {});
  }, []);

  const role = (session?.user as { role?: string })?.role ?? "";
  const visibleMenus = QUICK_MENUS.filter(m => {
    if (m.href === "/branch") return ["ADMIN", "MANAGER", "SENIOR_MANAGER", "SITE_MANAGER"].includes(role);
    return true;
  });

  return (
    <div style={{ minHeight: "100vh", background: "#f1f5f9", fontFamily: "'Malgun Gothic','Apple SD Gothic Neo','Segoe UI',sans-serif" }}>

      {/* 히어로 배너 */}
      <div style={{
        background: "linear-gradient(135deg, #0d5c2e 0%, #1a8a4a 50%, #29ABE2 100%)",
        padding: "36px 32px 44px",
        position: "relative",
        overflow: "hidden",
      }}>
        {/* 장식 원 */}
        <div style={{ position: "absolute", top: -80, right: -80, width: 320, height: 320, borderRadius: "50%", background: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: -50, left: "25%", width: 240, height: 240, borderRadius: "50%", background: "rgba(255,255,255,0.04)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", top: 20, right: "10%", width: 160, height: 160, borderRadius: "50%", background: "rgba(255,255,255,0.03)", pointerEvents: "none" }} />

        <div style={{ maxWidth: 960, margin: "0 auto", position: "relative" }}>
          <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 12, marginBottom: 10, letterSpacing: 0.5 }}>{todayStr}</div>

          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 20 }}>
            <div>
              <h1 style={{ color: "white", fontSize: 30, fontWeight: 800, margin: "0 0 4px 0", letterSpacing: -0.5, textShadow: "0 2px 8px rgba(0,0,0,0.2)" }}>
                노무법인 더보상
              </h1>
              <p style={{ color: "rgba(255,255,255,0.8)", fontSize: 15, margin: "0 0 20px 0", fontWeight: 400 }}>
                더 정직하게, 더 책임감있게, 더보상답게
              </p>
              <div style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                background: "rgba(255,255,255,0.12)",
                border: "1px solid rgba(255,255,255,0.2)",
                borderRadius: 20,
                padding: "4px 12px 4px 4px",
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: "50%",
                  background: "rgba(255,255,255,0.25)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 13, fontWeight: 700, color: "white",
                }}>
                  {name ? name.charAt(0) : "?"}
                </div>
                <span style={{ color: "white", fontSize: 13, fontWeight: 600 }}>{name}</span>
                {branch && <span style={{ color: "rgba(255,255,255,0.65)", fontSize: 12 }}>· {branch}</span>}
              </div>
            </div>

            {/* 배너 카드 */}
            <div style={{
              background: "rgba(0,0,0,0.25)",
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: 12,
              padding: "16px 24px",
              minWidth: 220,
            }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: "white", marginBottom: 2, lineHeight: 1.3 }}>
                10년의 보상,<br />권리로 이어지다
              </div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", marginTop: 6 }}>
                Since 2016 · Green Ribbon Campaign
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 본문 */}
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "24px 24px 40px" }}>

        {/* 빠른 메뉴 */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", letterSpacing: 1.2, marginBottom: 12, textTransform: "uppercase" }}>
            빠른 메뉴
          </div>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(108px, 1fr))",
            gap: 10,
          }}>
            {visibleMenus.map(m => (
              <Link key={m.href} href={m.href} style={{ textDecoration: "none" }}>
                <div style={{
                  background: "white",
                  border: "1px solid #e2e8f0",
                  borderRadius: 12,
                  padding: "18px 12px 14px",
                  textAlign: "center",
                  cursor: "pointer",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                  transition: "box-shadow 0.15s",
                }}
                  onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)")}
                  onMouseLeave={e => (e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.05)")}
                >
                  <div style={{ fontSize: 26, marginBottom: 8, lineHeight: 1 }}>{m.icon}</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#374151", lineHeight: 1.3 }}>{m.label}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* 통계 + 오늘 업무 */}
        <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 16, alignItems: "start" }}>

          {/* 수행율 */}
          {stats ? (
            <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 12, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", letterSpacing: 0.5, marginBottom: 12 }}>이번 달 업무 수행율</div>
              <div style={{ fontSize: 40, fontWeight: 800, color: "#29ABE2", lineHeight: 1, marginBottom: 4 }}>{stats.rate}<span style={{ fontSize: 20 }}>%</span></div>
              <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 14 }}>{stats.done}건 완료 / {stats.total}건 전체</div>
              <div style={{ width: "100%", background: "#e2e8f0", borderRadius: 999, height: 6 }}>
                <div style={{ width: `${stats.rate}%`, background: "linear-gradient(90deg,#29ABE2,#8DC63F)", borderRadius: 999, height: 6, transition: "width 0.5s" }} />
              </div>
            </div>
          ) : (
            <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 12, padding: 20, color: "#94a3b8", fontSize: 13 }}>불러오는 중...</div>
          )}

          {/* 오늘 업무 */}
          <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 12, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", letterSpacing: 0.5 }}>오늘의 업무</div>
              <Link href="/todo" style={{ fontSize: 12, color: "#29ABE2", textDecoration: "none", fontWeight: 600 }}>전체 보기 →</Link>
            </div>
            {todayTasks.length === 0 ? (
              <div style={{ textAlign: "center", padding: "20px 0", color: "#94a3b8", fontSize: 13 }}>
                오늘 등록된 업무가 없습니다.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {todayTasks.map(t => (
                  <div key={t.id} style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "8px 0", borderBottom: "1px solid #f8fafc",
                    opacity: t.isDone ? 0.45 : 1,
                  }}>
                    <div style={{
                      width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                      background: t.isDone ? "#cbd5e1" : "#29ABE2",
                    }} />
                    <span style={{
                      fontSize: 13, color: "#1e293b", flex: 1,
                      textDecoration: t.isDone ? "line-through" : "none",
                    }}>{t.title}</span>
                    {t.isDone && <span style={{ fontSize: 11, color: "#8DC63F", fontWeight: 700 }}>완료</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
