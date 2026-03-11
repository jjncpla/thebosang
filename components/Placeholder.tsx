export default function Placeholder({ title }: { title: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100%",
        padding: 48,
        color: "#9ca3af",
        fontFamily: "'Malgun Gothic', 'Apple SD Gothic Neo', 'Segoe UI', sans-serif",
      }}
    >
      <div style={{ fontSize: 48, marginBottom: 16 }}>🚧</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: "#374151", marginBottom: 8 }}>
        {title}
      </div>
      <div style={{ fontSize: 14 }}>개발 예정 페이지입니다</div>
    </div>
  );
}
