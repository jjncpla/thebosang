export default function PneumoconiosisTable() {
  return (
    <div style={wrapper}>
      <h2 style={titleStyle}>폐질환 등급표</h2>
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", minWidth: 1100, fontSize: 12, width: "100%" }}>
          <thead>
            <tr>
              <th rowSpan={2} style={th}>등급</th>
              <th rowSpan={2} style={th}>병형</th>
              <th rowSpan={2} style={th}>심폐기능</th>
              <th rowSpan={2} style={th}>
                FEV1<br /><span style={sub}>(1초량)</span>
              </th>
              <th rowSpan={2} style={th}>
                FVC<br /><span style={sub}>(노력성폐활량)</span>
              </th>
              <th rowSpan={2} style={th}>
                심폐기능곤란자<br /><span style={sub}>COPD</span>
              </th>
              <th rowSpan={2} style={th}>
                진폐<br />일반 장해
              </th>
              <th rowSpan={2} style={th}>기초연금액</th>
              <th colSpan={2} style={th}>진폐보상연금</th>
              <th rowSpan={2} style={th}>진폐재해위로금</th>
              <th colSpan={2} style={th}>장해보상연금</th>
              <th rowSpan={2} style={th}>장해보상일시금</th>
            </tr>
            <tr>
              <th style={th}>연</th>
              <th style={th}>일</th>
              <th style={th}>연</th>
              <th style={th}>일</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => (
                  <td key={j} style={j === 7 ? { ...td, whiteSpace: "pre-wrap", textAlign: "left", fontSize: 11 } : td}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={noteStyle}>※ FEV1, FVC 쓸 경우: 1초율 70% 미만 55</p>
    </div>
  );
}

const rows: string[][] = [
  ["1", "모든 병형", "고도 F3", "FEV1 < 30%", "-", "요양대상", "-",
    "2021년 1,273,120원\n2022년 1,337,360원\n2023년 1,404,520원",
    "월", "1,040", "329", "월", "1,474", "-"],
  ["2", "", "", "", "", "", "", "", "", "291", "", "", "1,309", "-"],
  ["3", "모든 병형", "중등도 F2", "30% ≤ FEV1 < 55%", "45% < χ ≤ 55%", "-", "-", "", "연", "132", "849", "257", "연", "1,155"],
  ["4", "", "", "", "", "", "", "", "", "224", "", "", "", "1,012"],
  ["5", "4형", "경도 F1", "55% ≤ FEV1 < 70%", "55% < χ ≤ 70%", "4B, 4C형", "-", "", "월", "6", "677", "193", "월", "869"],
  ["6", "", "", "", "", "", "", "", "", "164", "", "", "", "737"],
  ["7", "1, 2, 3형", "경도 F1", "55% ≤ FEV1 < 70%", "55% < χ ≤ 70%", "4A, 3형", "55% ≤ FEV1 < 70%", "", "연", "72", "526", "138", "연", "616"],
  ["8", "", "", "", "", "", "", "", "", "", "", "", "", "495"],
  ["9", "3, 4형", "경미 F1/2", "70% ≤ FEV1 < 80%", "70% < χ ≤ 80%", "-", "-", "", "월", "2", "387", "", "월", "385"],
  ["10", "", "", "", "", "", "", "", "", "", "", "", "", "297"],
  ["11", "1, 2형 F1/2 또는\n2, 3, 4형 F0형", "-", "70% ≤ FEV1 < 80%", "-", "-", "2형", "", "연", "24", "288", "", "연", "220"],
  ["12", "", "", "", "", "", "", "", "", "", "", "", "", "154"],
  ["13", "1형", "정상 F0", "FEV1 ≥ 80%", "80% ≤", "-", "1형", "", "월", "2", "215", "", "월", "99"],
  ["14", "(FEV1 초율\n1초율 70% 미만 55%)", "", "", "", "", "", "", "", "", "", "", "", ""],
];

const wrapper: React.CSSProperties = { padding: 24 };
const titleStyle: React.CSSProperties = { fontSize: 18, fontWeight: 700, color: "#111827", marginBottom: 16, paddingBottom: 8, borderBottom: "1px solid #e5e7eb" };
const th: React.CSSProperties = { border: "1px solid #d1d5db", padding: "7px 8px", background: "#f3f4f6", textAlign: "center", fontWeight: 600, color: "#374151", verticalAlign: "middle" };
const td: React.CSSProperties = { border: "1px solid #d1d5db", padding: "6px 8px", textAlign: "center", color: "#374151", verticalAlign: "middle" };
const sub: React.CSSProperties = { fontSize: 10, color: "#6b7280", fontWeight: 400 };
const noteStyle: React.CSSProperties = { marginTop: 12, fontSize: 13, color: "#4b5563" };
