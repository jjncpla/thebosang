# .github/ — TBSS GitHub Actions 셋업 안내

> qa-tester 서브에이전트 상시 운영을 위한 자동화 트리거.
> 2단계 구성: ① 정적 점검(secret 불필요) ② Claude API 호출(secret 필요).

---

## 워크플로 목록

### 1. `workflows/pr-validation.yml` — 정적 점검 (즉시 작동)

PR open/synchronize 시 + main push 시 자동 실행. **secret 필요 없음**.

**점검 항목**:
- ESLint (`npm run lint`)
- Prisma generate + Next.js build (TypeScript 컴파일 검증)
- `.env` 파일 git 추적 감지 → 발견 시 실패
- 클라이언트 컴포넌트의 비공개 env 노출 감지 → 발견 시 실패
- 실주민번호 형식 패턴 감지 → 경고 (수동 확인)
- `package.json` 변경 감지 → 경고 (신규 패키지 컨펌 필요)

**실패 시**: PR에 빨간색 X 표시. 머지 전 해결 권장.

### 2. `workflows/claude-qa-review.yml` — qa-tester 자동 리뷰 (secret 필요)

다음 4가지 트리거에서 작동. **`ANTHROPIC_API_KEY` secret 필요**.

| 트리거 | 시점 | 결과 위치 |
|-------|------|----------|
| ① **PR open/synchronize/reopened** | PR 만들거나 업데이트 | PR 코멘트 |
| ② **main push** ⭐ | main에 직접 푸시 (이정준 fast-forward 흐름) | commit comment |
| ③ **PR 댓글 `@claude`** | PR에서 멘션 | PR 코멘트 |
| ④ **수동 (workflow_dispatch)** | Actions UI "Run workflow" | run summary |

> **⭐ main push 트리거가 핵심**: 이정준 운영 방식이 PR 안 만들고 main에 직접 fast-forward 푸시하기 때문. 이 트리거 없으면 워크플로가 거의 발동 안 함.

**작동**:
- `.claude/agents/qa-tester.md` 매뉴얼 따라 변경 사항 자동 리뷰
- 4영역(테스트/디버깅/더미/보안) 점검
- 결과를 PR 코멘트 또는 commit comment로
- Critical/High 이슈 발견 시 병합 보류/롤백 권고
- 코드 자동 수정 안 함 (제안만)
- 단순 변경(typo/주석/문서)은 "리뷰 통과" 한 줄로 종료 (비용 절약)

**secret 미설정 시**: 본 워크플로만 실패. `pr-validation.yml`은 정상 작동.

---

## ANTHROPIC_API_KEY 셋업 (claude-qa-review.yml 활성화 위해)

### Step 1. API 키 발급
1. https://console.anthropic.com 접속 (Anthropic 계정 필요)
2. 좌측 메뉴 "API Keys" → "Create Key"
3. 이름: `tbss-github-actions` (자유)
4. 발급된 `sk-ant-...` 키 복사 (한 번만 표시되니 즉시 다음 단계로)

### Step 2. GitHub Secret 등록
1. https://github.com/jjncpla/thebosang/settings/secrets/actions 접속
2. "New repository secret" 클릭
3. **Name**: `ANTHROPIC_API_KEY` (정확히 이 이름)
4. **Secret**: 위에서 복사한 `sk-ant-...` 키 붙여넣기
5. "Add secret" 클릭

### Step 3. 동작 확인 (3가지 방법 중 택1)

**방법 A. 수동 실행 (가장 빠름, 추천)**
1. https://github.com/jjncpla/thebosang/actions/workflows/claude-qa-review.yml 접속
2. 우측 "Run workflow" 클릭 → 브랜치 `main` 선택 → "Run workflow"
3. 1~2분 후 run summary에 qa-tester 결과 표시

**방법 B. main 직접 푸시 (이정준 일상 흐름)**
- 평소처럼 main에 fast-forward 푸시하면 자동 발동
- commit comment(GitHub repo > Commits > 해당 커밋)에 결과 표시

**방법 C. PR 만들기 (선택적)**
- 다음 PR 열면 자동 실행
- PR 코멘트에 결과 표시

---

## 비용 예상 (Claude API)

이정준 운영 패턴(main fast-forward) 기준 — **트리거당 1회 호출**.

| 항목 | 예상 비용 |
|------|----------|
| 트리거 1회 (변경 적음, typo/문서만) | ~$0.01 (조기 종료) |
| 트리거 1회 (변경 적음, 코드) | ~$0.05 |
| 트리거 1회 (변경 많음, 50+ 파일) | ~$0.30 |
| **이정준 일 평균 푸시 5~10회 가정** | **월 $5 ~ $30** |

> Claude Sonnet 기준. 단순 변경은 prompt에서 "리뷰 통과" 한 줄로 조기 종료하도록 지시되어 비용 절감됨.

### 비용 더 줄이고 싶을 때

**옵션 1**: main push 트리거 제거 — `claude-qa-review.yml`의 `on:` 섹션에서 `push: branches: [main]` 4줄 삭제. 그러면 PR + 댓글 멘션 + 수동만 발동.

**옵션 2**: 댓글 멘션 전용 — `on:` 섹션에서 `pull_request:`와 `push:` 모두 삭제. `@claude` 멘션 시에만 호출됨.

**옵션 3**: 사용 한도 설정 — Anthropic console > Settings > Spend limits에서 월 $10/$30 등 한도 설정. 초과 시 자동 차단.

---

## 비활성화 방법

### claude-qa-review.yml만 끄고 싶을 때
- 옵션 1: 파일 이름을 `claude-qa-review.yml.disabled`로 변경
- 옵션 2: `on:` 섹션을 `on: workflow_dispatch:`로만 두면 수동 실행만 됨

### 전체 끄고 싶을 때
- GitHub Repo → Settings → Actions → General → "Disable actions"

---

## 향후 추가 예정 (별도 PR)

- **`workflows/daily-qa.yml`** — 매일 아침 9시 (KST) 어제 머지 커밋 자동 점검 (Claude Code schedule 또는 cron schedule)
- **`workflows/health-check.yml`** — Railway 운영 환경 health endpoint 5분 간격 점검 (Repository Dispatch 또는 외부 cron)
- **branch protection** — main 브랜치에 PR Validation 통과 필수 설정 (Repo Settings에서 수동 설정)

---

## 트러블슈팅

**Q. pr-validation의 build가 환경변수 부족으로 실패합니다.**
- `pr-validation.yml`의 `env:` 섹션에 추가 환경변수 더미값 추가. 단 빌드 단계에서만 필요한 값에 한정.

**Q. claude-qa-review가 같은 PR에 여러 번 코멘트를 남깁니다.**
- `on: pull_request: types`에서 `synchronize`를 제거하면 PR open 시 1회만 실행됨.

**Q. ESLint가 새 파일에서 너무 많은 경고를 냅니다.**
- `npm run lint -- --max-warnings 50` 같이 임계치 조정 가능. 단 이는 표준 운영 결정이라 사용자 컨펌 사항.

**Q. Anthropic API 사용량이 갑자기 증가했습니다.**
- Anthropic console의 Usage 탭 확인
- 가장 흔한 원인: 봇 PR / 자동 머지 + 매번 트리거. `if:` 조건에 작성자 필터 추가 권장.
