import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['@sparticuz/chromium-min', 'puppeteer-core'],
  experimental: {
    serverActions: {
      bodySizeLimit: '20mb',
    },
  },
  // 빌드 차단 해제 — 소스 코드의 ESLint 에러는 GitHub Actions(pr-validation.yml)에서 점검.
  // Why: Railway 배포 차단 상태였고, 룰 위반은 동작 영향 없는 코드 품질 항목 (any, prefer-const 등).
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
