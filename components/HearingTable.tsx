import { HearingTable as HearingTableType } from "../data/hearing";

export default function HearingTable({ table }: { table: HearingTableType }) {
  return (
    <div style={wrapper}>
      <h2 style={titleStyle}>난청급수표</h2>
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", minWidth: 700, fontSize: 13 }}>
          <thead>
            <tr>
              <th style={thStyle}>왼쪽 귀 \\ 오른쪽 귀</th>
              {table.columns.map((col, i) => (
                <th key={i} style={thStyle}>
                  {col.main}
                  {col.sub && <span style={subStyle}><br />{col.sub}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, i) => (
              <tr key={i}>
                <th style={thStyle}>
                  {row.main}
                  {row.sub && <span style={subStyle}><br />{row.sub}</span>}
                </th>
                {table.data[i].map((cell, j) => (
                  <td key={j} style={i === j ? diagStyle : tdStyle}>{cell}</td>
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

const wrapper: React.CSSProperties = { padding: 24 };
const titleStyle: React.CSSProperties = { fontSize: 18, fontWeight: 700, color: "#111827", marginBottom: 16, paddingBottom: 8, borderBottom: "1px solid #e5e7eb" };
const thStyle: React.CSSProperties = { border: "1px solid #d1d5db", padding: "8px 10px", background: "#f3f4f6", textAlign: "center", fontWeight: 600, color: "#374151", whiteSpace: "pre-wrap" };
const tdStyle: React.CSSProperties = { border: "1px solid #d1d5db", padding: "8px 10px", textAlign: "center", color: "#374151" };
const diagStyle: React.CSSProperties = { ...tdStyle, background: "#dbeafe", fontWeight: 600 };
const subStyle: React.CSSProperties = { fontSize: 11, color: "#6b7280", fontWeight: 400 };
const noteStyle: React.CSSProperties = { marginTop: 12, fontSize: 13, color: "#4b5563" };
