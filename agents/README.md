# agents/ 폴더 — Deprecated (v1)

> **상태**: 2026.04.30부로 deprecated. 보존 목적으로만 유지.
>
> **새 위치**: `.claude/agents/` (Claude Code 표준 서브에이전트 메커니즘)

## 마이그레이션 매핑

| v1 (이 폴더) | v2 (`.claude/agents/`) | 변경 사항 |
|-------------|----------------------|----------|
| `dev.md` | `code.md` | 흡수 + 확장 (design + security 포함) |
| `design.md` | `code.md` 내부 "UI / 디자인 룰" 섹션 | 흡수 |
| `security.md` | `code.md` 내부 "API Route 작성 시 보안 체크리스트" 섹션 | 흡수 |
| `planning.md` | `planning.md` | 동일 역할 (frontmatter 추가) |
| `orchestrator.md` | (없음) | 메인 Claude가 직접 위임 — 별도 오케스트레이터 불필요 |
| (없음) | `ocr-parser.md` | **신설** — OCR 텍스트 파싱 + DB 인입 specialist |
| (없음) | `form-pdf.md` | **신설** — 양식 PDF 자동생성 specialist |

## 왜 v1을 deprecated 했나

1. **실제로 작동하지 않았음**: v1은 frontmatter 없는 일반 md 파일이라 Claude Code가 서브에이전트로 인식하지 못함. 문서 가이드로만 동작.
2. **5개는 과다**: 실제 작업의 90%가 dev 영역. design/security/orchestrator는 호출 빈도가 낮거나 사람이 대신 했음.
3. **진짜 specialist가 빠져있었음**: 작업이력에서 가장 큰 비중인 OCR 파싱과 양식 PDF가 별도 에이전트가 아니었음.

자세한 분석: 2026.04.30 세션 (서브에이전트 진단 + B안 채택)

## 사용하지 마세요

이 폴더의 파일은 더 이상 참조되지 않습니다. 새 작업은 `.claude/agents/`의 4개 에이전트를 사용하세요:

- `code` — 코드 작업 전반
- `ocr-parser` — OCR 인입
- `form-pdf` — 양식 PDF 자동생성
- `planning` — PRD / Phase / 기획서

Claude Code가 자동으로 적절한 에이전트에 위임하며, 호출 흔적은 UI에 별도 turn으로 표시됩니다.
