export default function DisabilityTable() {
  return (
    <table style={table}>
      <thead>
        <tr>
          <th style={th} colSpan={2}>장해등급</th>
          <th style={th}>보상일수</th>
          <th style={th} colSpan={2}>장해등급</th>
          <th style={th}>보상일수</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style={td}>1급</td>
          <td style={td}>1호</td>
          <td style={td}>1474일</td>
          <td style={td}>8급</td>
          <td style={td}>1호</td>
          <td style={td}>495일</td>
        </tr>
        <tr>
          <td style={td}>2급</td>
          <td style={td}>1호</td>
          <td style={td}>1309일</td>
          <td style={td}>9급</td>
          <td style={td}>1호</td>
          <td style={td}>385일</td>
        </tr>
        <tr>
          <td style={td}>3급</td>
          <td style={td}>1호</td>
          <td style={td}>1155일</td>
          <td style={td}>10급</td>
          <td style={td}>1호</td>
          <td style={td}>297일</td>
        </tr>
        <tr>
          <td style={td}>4급</td>
          <td style={td}>1호</td>
          <td style={td}>1012일</td>
          <td style={td}>11급</td>
          <td style={td}>1호</td>
          <td style={td}>220일</td>
        </tr>
        <tr>
          <td style={td}>5급</td>
          <td style={td}>1호</td>
          <td style={td}>869일</td>
          <td style={td}>12급</td>
          <td style={td}>1호</td>
          <td style={td}>154일</td>
        </tr>
        <tr>
          <td style={td}>6급</td>
          <td style={td}>1호</td>
          <td style={td}>737일</td>
          <td style={td}>13급</td>
          <td style={td}>1호</td>
          <td style={td}>99일</td>
        </tr>
        <tr>
          <td style={td}>7급</td>
          <td style={td}>1호</td>
          <td style={td}>616일</td>
          <td style={td}>14급</td>
          <td style={td}>1호</td>
          <td style={td}>55일</td>
        </tr>
      </tbody>
    </table>
  );
}

const table: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
};

const th = {
  border: "1px solid #000",
  padding: "8px",
  background: "#e5e7eb",
  textAlign: "center" as const,
};

const td = {
  border: "1px solid #000",
  padding: "8px",
  textAlign: "center" as const,
};