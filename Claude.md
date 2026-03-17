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

*이 파일은 Claude.ai 프로젝트의 `thebosang_기획서.md`를 기반으로 자동 생성되었습니다.*
*기획서 원본이 업데이트되면 이 파일도 함께 갱신하세요.*