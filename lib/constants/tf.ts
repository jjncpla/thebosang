export const TF_BY_BRANCH: Record<string, string[]> = {
  "노무법인 더보상 울산지사": ["더보상울산TF", "이산울산동부TF", "이산울산남부TF", "이산울산북부TF"],
  "노무법인 더보상 울산동부지사": ["더보상울동TF", "이산양산TF"],
  "노무법인 더보상 부산경남지사": ["더보상부경TF", "이산부산서부TF", "이산부산북부TF", "이산김해TF"],
  "노무법인 더보상 부산중부지사": ["더보상부중TF", "이산부산지역본부TF"],
  "노무법인 더보상 경남창원지사": ["더보상창원TF", "이산창원TF", "이산거제TF"],
  "노무법인 더보상 경북포항지사": ["더보상포항TF", "이산포항TF", "더보상포프TF"],
  "노무법인 더보상 경북구미지사": ["더보상구미TF", "이산구미TF", "이산문경TF"],
  "노무법인 더보상 대구지사": ["더보상대구TF", "이산대구달서TF", "이산대구수성TF", "이산대구TF"],
  "노무법인 더보상 대구중부지사": ["더보상대구중부TF"],
  "노무법인 더보상 서울북부지사": ["더보상직업병상담소TF", "더보상서울북부TF", "더보상서울북부영업TF", "더보상서울북부상담TF"],
  "노무법인 더보상 강원동해지사": ["더보상동해TF", "이산영동TF", "이산강원TF", "이산원주TF"],
  "노무법인 더보상 경기안산지사": ["더보상안산TF", "이산영서TF", "이산용인TF"],
  "노무법인 더보상 경기의정부지사": ["더보상의정부TF", "이산의정부TF", "이산성남TF"],
  "노무법인 더보상 대전지사": ["더보상대전TF", "이산청주TF", "이산충주TF", "이산보령TF"],
  "노무법인 더보상 경기수원지사": ["더보상수원TF", "더보상경기수원TF", "이산수원TF", "이산평택TF"],
  "노무법인 더보상 경인지사": ["더보상경인TF", "이산인천TF", "이산인천북부TF"],
  "노무법인 더보상 서울구로지사": ["더보상구로TF", "이산부천TF"],
  "노무법인 더보상": ["이산제주TF", "이산마곡TF"],
  "노무법인 더보상 산재연구원": ["이산서울지역본부TF", "이산서울동부TF", "연구원TF"],
  "노무법인 더보상 전북익산지사": ["더보상익산TF", "이산익산TF", "이산전북TF", "이산전주TF"],
  "노무법인 더보상 전남여수지사": ["더보상여수TF", "이산전남TF", "이산광주TF", "이산여수TF"],
  "노무법인 더보상 전남순천지사": ["더보상순천TF", "이산진주TF", "이산순천TF"],
  // 신규 특수 지사
  "노무법인 더보상 재해보상법률원": ["더보상법률원TF"],
  "노무법인 더보상 어선원": ["더보상어선원TF"],
  // 기타 — 세분화 전 명칭 / 특수 그룹 / 카테고리형 TF
  "노무법인 더보상 기타": [
    "이산부산TF", "이산울산TF", "이산대구TF", "더보상TF", // 세분화 전 명칭
    "경북TF", "진폐TF", "미확인TF",                      // 특수 그룹
    "경서TF", "공무상재해TF", "플랜트TF", "동서해TF",    // 카테고리형 / 기타
  ],
};

export const ALL_TF_LIST = Object.values(TF_BY_BRANCH).flat();

export const TF_TO_BRANCH: Record<string, string> = Object.entries(TF_BY_BRANCH).reduce(
  (acc, [branch, tfs]) => {
    tfs.forEach((tf) => { acc[tf] = branch; });
    return acc;
  },
  {} as Record<string, string>
);

// DB에서 TF-지사 매핑 로드 (서버 컴포넌트/API용) — 실패 시 하드코딩 fallback
export async function loadTfByBranch(): Promise<Record<string, string[]>> {
  try {
    const { prisma } = await import('@/lib/prisma')
    const branches = await (prisma as any).branch.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: 'asc' },
    })
    const map: Record<string, string[]> = {}
    branches.forEach((b: any) => {
      map[b.name] = (b.assignedTFs as string[]) || []
    })
    return Object.keys(map).length > 0 ? map : TF_BY_BRANCH
  } catch {
    return TF_BY_BRANCH
  }
}
