import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/");

  return (
    <div style={{ minHeight: "100vh", background: "#f3f4f6", fontFamily: "'Malgun Gothic','Apple SD Gothic Neo',sans-serif" }}>
      {/* 관리자 헤더 */}
      <div style={{ background: "#1e3a5f", color: "#fff", padding: "0 24px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 52 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <Link href="/" style={{ color: "#93c5fd", fontSize: 13, textDecoration: "none" }}>← 메인</Link>
            <span style={{ fontSize: 16, fontWeight: 700 }}>TBSS 관리자</span>
          </div>
          <span style={{ fontSize: 13, color: "#bfdbfe" }}>{session.user.name} ({session.user.email})</span>
        </div>
      </div>

      {/* 탭 네비게이션 */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e5e7eb" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", gap: 0 }}>
          <NavTab href="/admin/accounts" label="계정 관리" />
          <NavTab href="/admin/notices" label="공지사항 관리" />
          <NavTab href="/admin/import" label="데이터 임포트" />
          <NavTab href="/admin/contacts" label="전화번호부" />
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 20px" }}>
        {children}
      </div>
    </div>
  );
}

function NavTab({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      style={{
        display: "block",
        padding: "14px 24px",
        fontSize: 14,
        fontWeight: 600,
        color: "#374151",
        textDecoration: "none",
        borderBottom: "2px solid transparent",
      }}
    >
      {label}
    </Link>
  );
}
