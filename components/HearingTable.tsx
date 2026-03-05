export default function HearingTable({ table }: any) {
  return (
    <table style={{ borderCollapse: "collapse", width: "100%" }}>
      <thead>
        <tr>
          <th style={th}>왼쪽 \\ 오른쪽</th>
          {table.columns.map((col: string, i: number) => (
            <th key={i} style={th}>{col}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {table.rows.map((row: string, i: number) => (
          <tr key={i}>
            <td style={th}>{row}</td>
            {table.data[i].map((cell: string, j: number) => (
              <td key={j} style={td}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const th = {
  border: "1px solid #ccc",
  padding: "8px",
  background: "#f3f4f6",
};

const td = {
  border: "1px solid #ccc",
  padding: "8px",
  textAlign: "center" as const,
};