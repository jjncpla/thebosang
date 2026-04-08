import { HearingTable as HearingTableType } from "../data/hearing";

export default function HearingTable({ table }: { table: HearingTableType }) {
  return (
    <div style={wrapper}>
      <h2 style={titleStyle}>난청급수표</h2>
      <div style={{ overflowX: "auto" }}>
        <table style={tableStyle}>
          <thead>
            <tr style={headerRow}>
              {/* 사선 구분 셀 */}
              <th style={diagonalCell}>
                <div style={diagonalContainer}>
                  <svg
                    style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                  >
                    <line x1="0" y1="0" x2="100" y2="100" stroke="rgba(255,255,255,0.4)" strokeWidth="1" />
                  </svg>
                  <span style={diagonalTopRight}>오른쪽 귀 →</span>
                  <span style={diagonalBottomLeft}>↓ 왼쪽 귀</span>
                </div>
              </th>
              {table.columns.map((col, i) => (
                <th key={i} style={colHeaderStyle}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{col.main}</div>
                  {col.sub && <div style={subStyle}>{col.sub}</div>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, ri) => (
              <tr key={ri} style={{ backgroundColor: ri % 2 === 0 ? "#fff" : "#f8fbff" }}>
                <th style={rowHeaderStyle}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{row.main}</div>
                  {row.sub && <div style={rowSubStyle}>{row.sub}</div>}
                </th>
                {table.data[ri].map((cell, ci) => (
                  <td key={ci} style={ri === ci ? diagDataStyle : tdStyle}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={noteStyle}>※ 한 쪽 귀의 평균 청력손실치가 50dB 이상이고 최고 명료도가 50% 이하인 경우: 11급 4호</p>
    </div>
  );
}

/* ── 스타일 ── */

const wrapper: React.CSSProperties = { padding: 24 };

const titleStyle: React.CSSProperties = {
  fontSize: 18, fontWeight: 700, color: "#111827",
  marginBottom: 16, paddingBottom: 8, borderBottom: "1px solid #e5e7eb",
};

const tableStyle: React.CSSProperties = {
  borderCollapse: "collapse",
  width: "100%",
  minWidth: 780,
  fontSize: 13,
  boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
  borderRadius: 8,
  overflow: "hidden",
  tableLayout: "fixed",
};

const headerRow: React.CSSProperties = {
  backgroundColor: "#78B8D4",
  color: "#fff",
};

/* 사선 구분 셀 */
const diagonalCell: React.CSSProperties = {
  position: "relative",
  backgroundColor: "#78B8D4",
  color: "#fff",
  width: 120,
  minWidth: 120,
  height: 64,
  padding: 0,
  border: "1px solid #6AABC5",
  verticalAlign: "middle",
};

const diagonalContainer: React.CSSProperties = {
  position: "relative",
  width: "100%",
  height: "100%",
  minHeight: 64,
};

const diagonalTopRight: React.CSSProperties = {
  position: "absolute",
  top: 6,
  right: 8,
  fontSize: 11,
  fontWeight: 600,
  lineHeight: 1,
};

const diagonalBottomLeft: React.CSSProperties = {
  position: "absolute",
  bottom: 6,
  left: 8,
  fontSize: 11,
  fontWeight: 600,
  lineHeight: 1,
};

/* 열 헤더 */
const colHeaderStyle: React.CSSProperties = {
  border: "1px solid #6AABC5",
  padding: "8px 6px",
  textAlign: "center",
  fontWeight: 600,
  color: "#fff",
  verticalAlign: "middle",
  width: 110,
};

/* 행 헤더 */
const rowHeaderStyle: React.CSSProperties = {
  border: "1px solid #e8f0f5",
  padding: "8px 6px",
  textAlign: "center",
  fontWeight: 600,
  color: "#333",
  backgroundColor: "#e8f4fa",
  width: 120,
  minWidth: 120,
};

/* 데이터 셀 */
const tdStyle: React.CSSProperties = {
  border: "1px solid #e8f0f5",
  padding: "8px 6px",
  textAlign: "center",
  color: "#374151",
  width: 110,
};

/* 대각선 셀 (동일 등급) */
const diagDataStyle: React.CSSProperties = {
  ...tdStyle,
  backgroundColor: "#dbeafe",
  fontWeight: 600,
  color: "#1a7ab5",
};

const subStyle: React.CSSProperties = {
  fontSize: 10,
  color: "rgba(255,255,255,0.7)",
  fontWeight: 400,
  marginTop: 2,
  lineHeight: 1.2,
};

const rowSubStyle: React.CSSProperties = {
  fontSize: 10,
  color: "#6b7280",
  fontWeight: 400,
  marginTop: 2,
  lineHeight: 1.2,
};

const noteStyle: React.CSSProperties = {
  marginTop: 12, fontSize: 13, color: "#4b5563",
};
