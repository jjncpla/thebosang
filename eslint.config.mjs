import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";
import { defineConfig, globalIgnores } from "eslint/config";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// eslint-config-next@15.5.x는 legacy .eslintrc 형식이라
// flat config에서 직접 spread가 안 됨. FlatCompat으로 호환 처리.
const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = defineConfig([
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  // 룰 강도 조정 — TBSS 1인 개발 페이스 + 프로토타입 단계 고려.
  // errors는 빌드/배포 차단이라 운영 영향 큰 항목만 error로 유지하고,
  // 코드 품질 개선 항목은 warn으로 강등 (가시성은 유지, 점진 정리).
  {
    rules: {
      // any 사용은 빠른 개발에 필요하지만 점진 제거 — error → warn
      "@typescript-eslint/no-explicit-any": "warn",
      // 일부 legacy script(.js) 파일이 require 사용 — error → warn
      "@typescript-eslint/no-require-imports": "warn",
      // 한글 텍스트의 따옴표 가독성 위해 의도적 사용 (`"(일용)"` 등) — error → warn
      "react/no-unescaped-entities": "warn",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "lib/generated/**",
  ]),
]);

export default eslintConfig;
