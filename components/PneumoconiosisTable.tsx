export default function PneumoconiosisTable() {
  return (
    <div style={wrapper}>
      <h2 style={titleStyle}>폐질환 등급표</h2>
      <div style={{ overflowX: "auto" }}>
        <table style={tableStyle}>
          <thead>
            <tr style={headerRow}>
              <th style={{ ...colTh, width: 44 }}>등급</th>
              <th style={{ ...colTh, width: 100 }}>병형</th>
              <th style={{ ...colTh, width: 72 }}>심폐기능</th>
              <th style={{ ...colTh, width: 110 }}>
                FEV1<br /><span style={headerSub}>(1초량)</span>
              </th>
              <th style={{ ...colTh, width: 100 }}>
                FVC<br /><span style={headerSub}>(노력성폐활량)</span>
              </th>
              <th style={{ ...colTh, width: 80 }}>진폐보상연금</th>
              <th style={{ ...colTh, width: 80 }}>진폐재해위로금</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} style={{ backgroundColor: i % 2 === 0 ? "#fff" : "#f8fbff" }}>
                <td style={{ ...td, fontWeight: 600 }}>{row.grade}</td>
                <td style={{ ...td, whiteSpace: "pre-wrap" }}>
                  {row.disease}
                </td>
                <td style={td}>{row.lung}</td>
                <td style={td}>{row.fev1}</td>
                <td style={td}>{row.fvc}</td>
                <td style={{ ...td, color: row.pension ? "#1a7ab5" : "#bbb", fontWeight: row.pension ? 600 : 400 }}>
                  {row.pension || "\u2014"}
                </td>
                <td style={{ ...td, fontWeight: row.consolation ? 600 : 400, color: row.consolation ? "#333" : "#bbb" }}>
                  {row.consolation || "\u2014"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={noteStyle}>※ 산업재해보상보험법 시행령 별표 기준</p>
    </div>
  );
}

/* ── 데이터 ── */

type Row = {
  grade: string;
  disease: string;
  lung: string;
  fev1: string;
  fvc: string;
  pension: string;
  consolation: string;
};

const rows: Row[] = [
  { grade: "1",  disease: "모든 병형",            lung: "고도 F3",    fev1: "FEV1 < 30%",         fvc: "-",              pension: "월 11일",  consolation: "1,040" },
  { grade: "2",  disease: "",                      lung: "",           fev1: "",                    fvc: "",               pension: "",         consolation: "" },
  { grade: "3",  disease: "모든 병형",            lung: "중등도 F2",  fev1: "30% ≤ FEV1 < 55%",   fvc: "45% < χ ≤ 55%",  pension: "연 132일", consolation: "849" },
  { grade: "4",  disease: "",                      lung: "",           fev1: "",                    fvc: "",               pension: "",         consolation: "" },
  { grade: "5",  disease: "4형",                  lung: "경도 F1",    fev1: "55% ≤ FEV1 < 70%",   fvc: "55% < χ ≤ 70%",  pension: "월 6일",   consolation: "677" },
  { grade: "6",  disease: "",                      lung: "",           fev1: "",                    fvc: "",               pension: "",         consolation: "" },
  { grade: "7",  disease: "1, 2, 3형",            lung: "경도 F1",    fev1: "55% ≤ FEV1 < 70%",   fvc: "55% < χ ≤ 70%",  pension: "연 72일",  consolation: "526" },
  { grade: "8",  disease: "",                      lung: "",           fev1: "",                    fvc: "",               pension: "",         consolation: "" },
  { grade: "9",  disease: "3, 4형",               lung: "경미 F1/2",  fev1: "70% ≤ FEV1 < 80%",   fvc: "70% < χ ≤ 80%",  pension: "월 2일",   consolation: "387" },
  { grade: "10", disease: "",                      lung: "",           fev1: "",                    fvc: "",               pension: "",         consolation: "" },
  { grade: "11", disease: "1, 2형 F1/2 또는\n2, 3, 4형 F0형", lung: "-", fev1: "70% ≤ FEV1 < 80%", fvc: "-",            pension: "연 24일",  consolation: "288" },
  { grade: "12", disease: "",                      lung: "",           fev1: "",                    fvc: "",               pension: "",         consolation: "" },
  { grade: "13", disease: "1형",                  lung: "정상 F0",    fev1: "FEV1 ≥ 80%",         fvc: "80% ≤",          pension: "월 2일",   consolation: "215" },
  { grade: "14", disease: "",                      lung: "",           fev1: "",                    fvc: "",               pension: "",         consolation: "" },
];

/* ── 스타일 (옅은 톤) ── */

const wrapper: React.CSSProperties = { padding: 24 };

const titleStyle: React.CSSProperties = {
  fontSize: 18, fontWeight: 700, color: "#111827",
  marginBottom: 16, paddingBottom: 8, borderBottom: "1px solid #e5e7eb",
};

const tableStyle: React.CSSProperties = {
  borderCollapse: "collapse",
  width: "100%",
  fontSize: 14,
  boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
  borderRadius: 8,
  overflow: "hidden",
  tableLayout: "auto",
};

const headerRow: React.CSSProperties = {
  backgroundColor: "#78B8D4",
  color: "#fff",
};

const colTh: React.CSSProperties = {
  border: "1px solid #6AABC5",
  padding: "8px 6px",
  textAlign: "center",
  fontWeight: 600,
  color: "#fff",
  verticalAlign: "middle",
};

const headerSub: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 400,
  color: "rgba(255,255,255,0.75)",
};

const td: React.CSSProperties = {
  border: "1px solid #e8f0f5",
  padding: "6px 6px",
  textAlign: "center",
  color: "#374151",
  verticalAlign: "middle",
};

const noteStyle: React.CSSProperties = {
  marginTop: 12, fontSize: 13, color: "#4b5563",
};
