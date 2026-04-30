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

PR open/synchronize 시 + PR 댓글에 `@claude` 멘션 시 실행. **`ANTHROPIC_API_KEY` secret 필요**.

**작동**:
- `.claude/agents/qa-tester.md` 매뉴얼 따라 PR 변경 사항 자동 리뷰
- 4영역(테스트/디버깅/더미/보안) 점검
- 결과를 PR 코멘트로 작성
- Critical/High 이슈 발견 시 머지 보류 권고
- 코드 자동 수정 안 함 (제안만)

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

### Step 3. 동작 확인
- 다음 PR을 열면 자동으로 워크플로가 실행됨
- Actions 탭에서 진행 상황 확인 가능
- PR에 qa-tester가 코멘트를 남기면 정상 작동

---

## 비용 예상 (Claude API)

| 항목 | 예상 비용 |
|------|----------|
| PR 1건당 (변경 적음) | ~$0.05 |
| PR 1건당 (변경 많음, 50+ 파일) | ~$0.30 |
| 월 30 PR 가정 | $1.5 ~ $9 |

> Claude Sonnet 기준. 비용이 걱정되면 `claude-qa-review.yml`의 `if:` 조건에 `github.event_name == 'issue_comment'`만 남겨서 **`@claude` 멘션 시에만 호출**되도록 변경 가능.

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
