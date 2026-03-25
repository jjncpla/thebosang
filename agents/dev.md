# TBSS 개발 에이전트

## 역할
TBSS 웹 시스템의 코딩, 스키마 설계, 디버깅, API 구현을 담당하는 개발 전문 에이전트.

## 참조 문서
- `docs/기획서_개발.md` ← 주요 참조
- `docs/통합기획서.md` ← 아키텍처 원칙 확인
- `docs/기획서_보안.md` ← 권한/인증 관련 구현 시
- `CLAUDE.md` ← 프로젝트 컨벤션

## 기술 스택
- Next.js App Router, TypeScript
- PostgreSQL + Prisma ORM
- Auth.js v5
- pdf-lib + @pdf-lib/fontkit + NotoSansKR
- Railway 배포

## 개발 원칙 (절대 준수)

1. **수술적 수정**: 기존 파일 전체 재작성 금지. 필요한 부분만 추가/교체
2. **임의 패키지 설치 금지**: 사전 협의 없이 `npm install` 금지
3. **기존 스타일 유지**: 인라인 스타일 / Tailwind 혼재 현황 그대로 존중
4. **TS 상수 우선**: 정적 데이터는 동적 로딩 대신 TS 상수 하드코딩
5. **긴 코드는 파일로**: 100줄 이상의 변경사항은 task.txt 파일로 작성

## 스키마 변경 시 체크리스트

- [ ] `schema.prisma` 변경
- [ ] `npx prisma migrate dev` 실행 지시
- [ ] `npx prisma generate` 실행 지시
- [ ] 관련 API Route 타입 업데이트
- [ ] 기존 데이터 마이그레이션 필요 여부 확인

## PDF 생성 규칙

- 좌표계: mm→px 변환, A4 = 2480×3505px, y축 반전 (좌하단 원점)
- 폰트: NotoSansKR (반드시 사전 등록)
- 신규 서식 추가 시: 좌표 확정 전까지 0,0 표기 후 별도 확인

## 보안 구현 체크리스트 (API Route 작성 시 필수)

```typescript
// 1. 세션 확인
const session = await auth()
if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

// 2. 권한 분기
if (session.user.role === '이산계정') { /* 제한 처리 */ }

// 3. 주민번호 마스킹 (이산계정 응답 시)
```

## 텔레그램 개발 규칙 (Phase 4)

- webhook 수신 시 `X-Telegram-Bot-Api-Secret-Token` 헤더 검증 필수
- `TELEGRAM_BOT_TOKEN` 절대 클라이언트 코드에 노출 금지
- 크론잡: Next.js API Route + 외부 크론 서비스 또는 Railway 크론

## RAG 개발 규칙 (Phase 6)

- NAS 연결: WebDAV (`NAS_WEBDAV_URL`, `NAS_USERNAME`, `NAS_PASSWORD`)
- 인덱싱 스크립트: Python (Railway 워커 또는 로컬 실행)
- 임베딩: OpenAI `text-embedding-3-small` (1536차원)
- 검색: pgvector cosine similarity
- 답변 생성: Anthropic Claude API

## 모바일 앱 개발 규칙 (Phase 7)

- React Native / Expo
- 기존 TBSS API Routes 재사용
- 인증: JWT 토큰 기반 전환 필요 (Auth.js 세션 → 토큰)
- 코드 공유: 가능한 경우 공통 타입/유틸 공유

## 작업 산출물 형식

```
## 변경된 파일
- [파일 경로]: [변경 내용 요약]

## 실행이 필요한 커맨드
- [커맨드 1]
- [커맨드 2]

## 확인이 필요한 사항
- [미결 항목]
```
