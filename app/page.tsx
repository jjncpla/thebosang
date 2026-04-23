"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import Link from "next/link";

const QUICK_MENUS = [
  { label: "사건 목록",     href: "/cases",             icon: "📋" },
  { label: "재해자 목록",   href: "/patients",          icon: "👥" },
  { label: "To Do List",    href: "/todo",              icon: "☑️" },
  { label: "통합 캘린더",   href: "/tf/special-clinic", icon: "📅" },
  { label: "실무 참고 정보",    href: "/grade",          icon: "📊" },
  { label: "상담 관리",     href: "/consultation",      icon: "💬" },
  { label: "이의제기",      href: "/objection/review",  icon: "⚖️" },
  { label: "지사장 관리·운영", href: "/branch",          icon: "🏢" },
];

interface TodoTask  { id: string; title: string; isDone: boolean; dueDate: string | null; }
interface TodoStats { total: number; done: number; rate: number; }

export default function HomePage() {
  const { data: session } = useSession();
  const [stats, setStats]           = useState<TodoStats | null>(null);
  const [todayTasks, setTodayTasks] = useState<TodoTask[]>([]);
  const [todayStr, setTodayStr]     = useState("");

  const name   = session?.user?.name || session?.user?.email || "";
  const branch = (session?.user as { branch?: string })?.branch || "";
  const role   = (session?.user as { role?: string })?.role ?? "";

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

  const visibleMenus = QUICK_MENUS.filter(m => {
    if (m.href === "/branch")
      return ["ADMIN", "MANAGER", "SENIOR_MANAGER", "SITE_MANAGER"].includes(role);
    return true;
  });

  const initial = name ? name.charAt(0) : "?";

  return (
    <div style={{ minHeight: "100vh", background: "var(--paper)" }}>

      {/* ── 히어로 배너 ── */}
      <div style={{
        background: "var(--deep)",
        padding: "36px 40px 44px",
        position: "relative",
        overflow: "hidden",
        borderBottom: "1px solid rgba(0,0,0,.12)",
      }}>
        <div style={{ position:"absolute", top:-100, right:-100, width:360, height:360, borderRadius:"50%", background:"rgba(255,255,255,.03)", pointerEvents:"none" }} />
        <div style={{ position:"absolute", bottom:-60, left:"28%", width:260, height:260, borderRadius:"50%", background:"rgba(255,255,255,.025)", pointerEvents:"none" }} />

        <div style={{ maxWidth: 1100, margin: "0 auto", position: "relative" }}>
          <div style={{ color:"rgba(255,255,255,.5)", fontSize:11.5, marginBottom:10, letterSpacing:"0.06em", fontVariantNumeric:"tabular-nums" }}>
            {todayStr}
          </div>

          <div style={{ display:"flex", alignItems:"flex-end", justifyContent:"space-between", flexWrap:"wrap", gap:20 }}>
            <div>
              <h1 style={{
                color:"#fff", fontSize:28, fontWeight:700, margin:"0 0 4px",
                letterSpacing:"-0.015em",
                fontFamily:"var(--font-serif)",
              }}>
                노무법인 더보상
              </h1>
              <p style={{ color:"rgba(255,255,255,.65)", fontSize:13.5, margin:"0 0 20px", fontWeight:400 }}>
                더 정직하게, 더 책임감있게, 더보상답게
              </p>
              <div style={{
                display:"inline-flex", alignItems:"center", gap:8,
                background:"rgba(255,255,255,.09)",
                border:"1px solid rgba(255,255,255,.14)",
                borderRadius:100,
                padding:"4px 14px 4px 4px",
              }}>
                <div style={{
                  width:28, height:28, borderRadius:"50%",
                  background:"var(--sky)", color:"#fff",
                  display:"flex", alignItems:"center", justifyContent:"center",
                  fontSize:12, fontWeight:700,
                }}>
                  {initial}
                </div>
                <span style={{ color:"#fff", fontSize:13, fontWeight:600 }}>{name}</span>
                {branch && <span style={{ color:"rgba(255,255,255,.5)", fontSize:11.5 }}>· {branch}</span>}
              </div>
            </div>

            <div style={{
              background:"rgba(0,0,0,.2)",
              border:"1px solid rgba(255,255,255,.1)",
              borderRadius:"var(--r-md)",
              padding:"16px 22px",
              minWidth:200,
            }}>
              <div style={{ fontSize:17, fontWeight:700, color:"#fff", lineHeight:1.4, fontFamily:"var(--font-serif)" }}>
                10년의 보상,<br />권리로 이어지다
              </div>
              <div style={{ fontSize:11, color:"rgba(255,255,255,.45)", marginTop:8, letterSpacing:"0.06em" }}>
                Since 2016 · Green Ribbon Campaign
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 본문 ── */}
      <div style={{ maxWidth:1100, margin:"0 auto", padding:"var(--s-7) var(--s-7) var(--s-8)" }}>

        {/* 빠른 메뉴 */}
        <section style={{ marginBottom:"var(--s-7)" }}>
          <div className="eyebrow" style={{ marginBottom:"var(--s-3)" }}>빠른 메뉴</div>
          <div style={{
            display:"grid",
            gridTemplateColumns:"repeat(auto-fill, minmax(108px, 1fr))",
            gap:8,
          }}>
            {visibleMenus.map(m => (
              <Link key={m.href} href={m.href} style={{ textDecoration:"none" }}>
                <div className="card" style={{
                  padding:"16px 10px 14px",
                  textAlign:"center",
                  cursor:"pointer",
                  transition:"box-shadow .15s, background .15s",
                }}
                  onMouseEnter={e => { e.currentTarget.style.boxShadow = "var(--shadow-lift)"; e.currentTarget.style.background = "var(--surface-alt)"; }}
                  onMouseLeave={e => { e.currentTarget.style.boxShadow = "var(--shadow-paper)"; e.currentTarget.style.background = "var(--surface)"; }}
                >
                  <div style={{ fontSize:24, marginBottom:8, lineHeight:1 }}>{m.icon}</div>
                  <div style={{ fontSize:12, fontWeight:600, color:"var(--ink-800)", lineHeight:1.35 }}>{m.label}</div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* 수행율 + 오늘 업무 */}
        <div style={{ display:"grid", gridTemplateColumns:"220px 1fr", gap:"var(--s-5)", alignItems:"start" }}>

          <div className="card card-pad">
            <div className="eyebrow" style={{ marginBottom:"var(--s-3)" }}>이번 달 수행율</div>
            {stats ? (
              <>
                <div style={{
                  fontSize:38, fontWeight:700, color:"var(--sky-ink)",
                  lineHeight:1, marginBottom:4,
                  fontVariantNumeric:"tabular-nums",
                  fontFamily:"var(--font-serif)",
                }}>
                  {stats.rate}<span style={{ fontSize:18, fontWeight:500 }}>%</span>
                </div>
                <div style={{ fontSize:12, color:"var(--ink-400)", marginBottom:"var(--s-4)" }}>
                  {stats.done}건 완료 / {stats.total}건 전체
                </div>
                <div style={{ width:"100%", background:"var(--ink-100)", borderRadius:100, height:6 }}>
                  <div style={{
                    width:`${stats.rate}%`, background:"var(--sky)",
                    borderRadius:100, height:6, transition:"width .5s",
                  }} />
                </div>
              </>
            ) : (
              <div style={{ color:"var(--ink-400)", fontSize:13 }}>불러오는 중…</div>
            )}
          </div>

          <div className="card">
            <div className="card-title">
              <h3 style={{ margin:0, fontSize:14, fontWeight:600 }}>오늘의 업무</h3>
              <Link href="/todo" style={{ fontSize:12, color:"var(--sky-ink)", fontWeight:500 }}>전체 보기 →</Link>
            </div>
            <div className="card-pad" style={{ paddingTop:"var(--s-3)" }}>
              {todayTasks.length === 0 ? (
                <div style={{ textAlign:"center", padding:"20px 0", color:"var(--ink-400)", fontSize:13 }}>
                  오늘 등록된 업무가 없습니다.
                </div>
              ) : (
                <div style={{ display:"flex", flexDirection:"column", gap:0 }}>
                  {todayTasks.map(t => (
                    <div key={t.id} style={{
                      display:"flex", alignItems:"center", gap:10,
                      padding:"9px 0",
                      borderBottom:"1px solid var(--paper-line)",
                      opacity: t.isDone ? 0.45 : 1,
                    }}>
                      <div style={{
                        width:7, height:7, borderRadius:"50%", flexShrink:0,
                        background: t.isDone ? "var(--ink-300)" : "var(--sky)",
                      }} />
                      <span style={{
                        fontSize:13, color:"var(--ink-800)", flex:1,
                        textDecoration: t.isDone ? "line-through" : "none",
                      }}>{t.title}</span>
                      {t.isDone && (
                        <span style={{ fontSize:11, color:"var(--lime-ink)", fontWeight:600 }}>완료</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
