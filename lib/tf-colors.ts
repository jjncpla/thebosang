export const TF_COLORS: Record<string, string> = {
  "울산TF": "#006838",
  "울산동부TF": "#29ABE2",
  "울동TF": "#29ABE2",
  "울산남부TF": "#8DC63F",
  "울산북부TF": "#005F99",
  "부산TF": "#E74C3C",
  "부산북부TF": "#C0392B",
  "부산서부TF": "#E67E22",
  "부중TF": "#F39C12",
  "부경TF": "#D35400",
  "창원TF": "#9B59B6",
  "더보상창원TF": "#8E44AD",
  "양산TF": "#1ABC9C",
  "김해TF": "#16A085",
  "거제TF": "#2ECC71",
  "진주TF": "#27AE60",
  "포항TF": "#3498DB",
  "경주TF": "#2980B9",
  "대구TF": "#E91E63",
  "대구달서TF": "#AD1457",
  "대구수성TF": "#880E4F",
  "대구북부TF": "#6A1B9A",
  "여수TF": "#FF9800",
  "더보상여수TF": "#F57C00",
  "순천TF": "#795548",
  "더보상익산TF": "#607D8B",
  "문경TF": "#455A64",
  "영동TF": "#00BCD4",
  "영서TF": "#0097A7",
  "안동TF": "#4CAF50",
  "구미TF": "#FF5722",
  "이산구미TF": "#BF360C",
}

export function getTFColor(tfName: string): string {
  if (TF_COLORS[tfName]) return TF_COLORS[tfName]
  for (const [key, color] of Object.entries(TF_COLORS)) {
    if (tfName.includes(key) || key.includes(tfName)) return color
  }
  return "#95A5A6"
}
