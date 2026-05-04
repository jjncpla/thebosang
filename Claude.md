# TBSS (더보상 업무지원시스템) — Claude Code 개발 기준 문서

> 이 파일은 Claude Code가 자동으로 읽는 프로젝트 컨텍스트 파일입니다.
> 코딩 시작 전 반드시 이 파일을 참조하고, 아래 원칙을 항상 준수하세요.

---

## 프로젝트 개요

- **시스템명**: TBSS (더보상 업무지원시스템)
- **운영사**: 노무법인 더보상 (전국 단위 산재 전문 노무법인)
- **목적**: 산재 사건 관리, 이의제기, TF 업무 등 내부 업무 전산화
- **배포**: Railway (`thebosang-production.up.railway.app`)
- **레포**: `github.com/jjncpla/thebosang` (main 브랜치 push → 자동 배포)

---

## 기술 스택

| 항목 | 내용 |
|------|------|
| Frontend | Next.js App Router, TypeScript |
| Backend | Next.js API Routes |
| DB | PostgreSQL (Prisma ORM) |
| Auth | Auth.js v5 (NextAuth) |
| PDF 생성 | pdf-lib + @pdf-lib/fontkit + NotoSansKR |
| 배포 | Railway |

- Prisma 스키마: `prisma/schema.prisma` (메인) + `prisma/auth.prisma`
- DB 접근: 항상 `lib/prisma.ts`의 Prisma Client 사용
- 인증: Auth.js v5 session 체크 (`auth()` 함수)

---

## 절대 원칙 (이것만은 반드시 지킬 것)

### ✅ 해야 할 것
- **수술적 수정만** — 필요한 부분만 `str_replace`로 최소 변경
- 새 기능은 **새 파일 추가** 방식으로 구현
- 기존 파일 수정 시 해당 블록만 교체, 나머지는 그대로 유지
- `schema.prisma` 변경 시 마지막에 `npx prisma db push` 명령 안내할 것
- 인라인 스타일 / Tailwind 혼재 현황 그대로 존중

### ❌ 하지 말 것
- **기존 파일 전체 재작성 금지** (명시적 요청 없으면)
- **기존 UI·로직·스타일 임의 변경 금지**
- **새 npm 패키지 임의 설치 금지** (반드시 먼저 물어볼 것)
- **`.env` 파일 수정 금지**
- **기존 컴포넌트 리팩토링 금지**
- **불확실한 부분을 임의로 채워넣기 금지** — 모르면 물어볼 것

---

## 판단 기준 (물어보지 말고 이렇게 할 것)

| 상황 | 처리 방법 |
|------|-----------|
| 새 페이지 | `app/[경로]/page.tsx` 생성 |
| DB 접근 | `lib/prisma.ts` import 후 Prisma Client 사용 |
| 인증 확인 | `import { auth } from '@/auth'` → `const session = await auth()` |
| API Route | `app/api/[경로]/route.ts` 생성 |
| 정적 데이터 | TS 상수 파일로 하드코딩 (`lib/constants/xxx.ts`) |
| 에러 처리 | `console.error()` 로깅 + 사용자에게 에러 메시지 표시 |
| 타입 정의 | `types/` 디렉토리 또는 해당 파일 상단에 선언 |
| Prisma 생성 파일 | `lib/generated/` — git 커밋 제외 (`.gitignore`에 포함됨) |

---

## 디렉토리 구조 컨벤션

```
app/
  (auth)/login/        # 로그인 페이지
  admin/               # 관리자 페이지 (ADMIN 전용)
  cases/               # 사건 목록 + 상세
  todo/                # To Do List (로그인 후 첫 화면)
  grade/               # 장해등급표
  wage/                # 임금 관련 계산기
api/
  cases/[caseId]/      # 사건 관련 API
lib/
  prisma.ts            # Prisma Client 싱글턴
  generated/           # Prisma 자동 생성 (git 제외)
prisma/
  schema.prisma        # 메인 스키마
  auth.prisma          # Auth.js 스키마
```

---

## 권한 체계

| 권한 | 대상 | 접근 범위 |
|------|------|-----------|
| ADMIN | 시스템 관리자 | 전체 + 관리자 페이지 |
| 조직관리자 | 대표·이사·지사장 등 | 지사장 관리 페이지 포함 |
| STAFF | 노무사·내근직·외근직 | 일반 업무 기능 |
| 이산계정 | 노무법인 이산 임직원 | 사건 조회만 (상세 불가) |

---

## 핵심 도메인 이해

### 사건(Case) 구조
- **Patient(재해자)** 가 최상위 엔티티 (1명이 복수 상병 가능)
- **Case(사건)** 은 항상 특정 상병에 귀속
- 상병 계열: 기획사건 (소음성 난청 / COPD / 진폐) / 일반산재
- 파생 사건: `parentCaseId` FK로 원본 연결 (평균임금 정정 청구 등)

### 상태값 (CaseStatus Enum)
기획사건 기준 주요 상태:
`CONSULTING → CONTRACTED → DOC_COLLECTING → SUBMITTED → EXAM_REQUESTED → EXAM_CLINIC_SELECTED → EXAM_SCHEDULED → IN_EXAM → EXAM_DONE → EXPERT_REQUESTED → EXPERT_CLINIC_SELECTED → EXPERT_DONE → BANK_REQUESTED → BANK_SUBMITTED → DECISION_RECEIVED → REVIEWING → APPROVED / REJECTED / OBJECTION / WAGE_CORRECTION → CLOSED`

### TF 개념
- TF = 사건군 (더보상TF / 이산TF로 구분)
- 각 지사가 담당하는 TF가 고정 배정됨

---

## 소음성 난청 핵심 테이블 (Phase 2 현재 개발 중)

- `HearingLossDetail`: 사건별 상세 정보 (초진, 직업력, 접수, 특진요구, 전문조사, 결정, 검토)
- `HearingLossExam`: 특진 회차별 검사 결과 (examSet: INITIAL/RE/RE2, examRound: 1/2/3)
- `workHistory` 필드: JSON 배열 (회사명, 부서, 작업내용, 소음노출 여부, 소음레벨 등)

---

## Railway 배포 주의사항

- `main` 브랜치 push → 자동 빌드·배포 (소요 2~4분)
- `lib/generated/` 디렉토리는 git 커밋 대상에서 제외
- `schema.prisma` 변경 후: `npx prisma db push` (Railway DB에 직접 반영)
- PDF 생성은 `pdf-lib` 기반 (Puppeteer 사용 금지 — Railway에서도 불필요)

---

## 긴 지시 파일 처리

- PowerShell 터미널에서 긴 텍스트 붙여넣기 시 잘릴 수 있음
- 긴 지시사항은 `.txt` 파일로 저장 후 `cat ./instruction.txt | claude` 방식 사용
- 또는 Claude Code 실행 후 `/read ./instruction.txt` 명령 사용

---

## 현재 개발 단계 (2026.03 기준)

- Phase 1 완료: 로그인, 관리자 페이지, To Do List, 장해등급 페이지
- Phase 2 진행 중: **소음성 난청 사건 상세 UI** (최우선)
  - schema.prisma 재설계 완료 (db push --force-reset 적용됨)
  - 다음 작업: 소음성 난청 사건 상세 페이지 구현

---

---

## 멀티 에이전트 팀 구성 (2026.03~ 적용)

### 개요
Claude Code CLI 오케스트레이션 기반 멀티 에이전트 방식으로 운영.
총괄 에이전트가 이정준의 요청을 받아 서브 에이전트들에게 Task를 위임하고 결과를 통합한다.

### 에이전트 목록 (v2 — 2026.04.30 개편)

Claude Code의 표준 서브에이전트 메커니즘(`.claude/agents/*.md` + frontmatter)으로 전환.
Task tool로 자동 위임되며, 호출 흔적이 Claude Code UI에 별도 turn으로 표시된다.

| 에이전트 | 정의 파일 | 역할 |
|---------|----------|------|
| **code** | `.claude/agents/code.md` | TBSS 코드 작성·수정 전반 (Next.js / Prisma / React / 권한·인증 / UI). 일상 작업의 80%+ |
| **ocr-parser** | `.claude/agents/ocr-parser.md` | 산재 양식 OCR 파싱 + DB 인입 (평균임금산정내역서·결정통지서·자료보완 요청 등) |
| **form-pdf** | `.claude/agents/form-pdf.md` | 산재 신청 양식 PDF 자동생성 (pdf-lib + NotoSansKR + 좌표계) |
| **qa-tester** | `.claude/agents/qa-tester.md` | 테스트 시나리오, 디버깅, 더미 데이터, 보안 리뷰. 1인+직원 수동 테스트 한계 보완 |
| **planning** | `.claude/agents/planning.md` | PRD 작성, Phase 로드맵, 기획서 정합성. 코드 변경 안 함 |

**위임 우선순위**:
- 코드 작업 → 기본 `code`
- OCR 텍스트에서 필드 추출 / DB 인입 작업 → `ocr-parser`
- pdf-lib 좌표 / 한국어 폰트 / 양식 spec 작업 → `form-pdf`
- 테스트·디버깅·더미 데이터·보안 리뷰 → `qa-tester`
- 신규 기능 구상 / 기획서 업데이트 → `planning`

> **qa-tester 운영 방식**: 호출 시점에만 작동. 통합 작업 마지막 검증·품질 점검·디버깅·더미 데이터 생성 시 명시적으로 호출.
> 상시 트리거(GitHub Actions)는 2026-05-04 시도했으나 claude-code-action OIDC 인증 반복 실패로 롤백. 향후 재도입 시 다른 방식 검토.

> v1 (`agents/dev.md`, `agents/design.md`, `agents/security.md`, `agents/orchestrator.md`)은 deprecated.
> design / security는 `code` 에이전트 내부 체크리스트로 흡수됨. 이전 파일은 `agents/` 폴더에 보존.

### 기획서 구조

| 문서 | 경로 | 용도 |
|------|------|------|
| 통합기획서 | `docs/통합기획서.md` | **단일 진실의 원천 (SOT)** — 아키텍처, Phase, 권한, 메뉴 |
| 개발기획서 | `docs/기획서_개발.md` | 스키마 PRD, API 명세, 기술 결정 로그 |
| 디자인기획서 | `docs/기획서_디자인.md` | 디자인 시스템, 컬러, 페이지별 UI 스펙 |
| 보안기획서 | `docs/기획서_보안.md` | 권한 매트릭스, 인증 흐름, 환경변수 |
| 기획기획서 | `docs/기획서_기획.md` | Phase 체크리스트, PRD, 미결 사항 |
| 아카이브 | `docs/archive/` | 구 기획서 이력 보관 |

> **충돌 시 우선순위**: 통합기획서 > 개별기획서 > 코드

### 이정준의 역할
1. 기획 구상 및 방향 전달 (Claude Code에 직접 또는 Claude.ai 분해 후 전달)
2. 메인 Claude의 위임 계획 컨펌 (대규모 변경 시)
3. 결과 피드백 및 다음 작업 지시

### 작업 흐름 (v2)
```
이정준 (구상/요청 전달)
  → 메인 Claude (요청 분석 + 적절한 서브에이전트로 위임)
       ├─ code (코드 변경)
       ├─ ocr-parser (OCR 인입)
       ├─ form-pdf (양식 PDF)
       └─ planning (기획서 업데이트)
  → 메인 Claude 결과 통합 + 이정준에게 보고
  → 피드백 → 반복
```

> 큰 작업은 여전히 `cat task.txt | claude` 방식 가능. task.txt 안에서 명시적으로 "ocr-parser 에이전트로 작업해" 같은 지시도 가능.

### 기획서 업데이트 원칙
- 신규 기능 추가 시 반드시 해당 기획서 업데이트
- 아키텍처 변경 시 통합기획서 먼저 업데이트
- 기획서와 코드 불일치 발견 시 기획서를 기준으로 코드 수정