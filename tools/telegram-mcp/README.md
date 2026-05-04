# TBSS Telegram MCP

> 본인 텔레그램 계정을 Claude Code의 MCP 도구로 노출 (read-only).
> 이정준 산재 실무 자료(대화·첨부 PDF) 자동 인입 기반 인프라.

---

## 작동 구조

```
[텔레그램 서버]
      │  MTProto user session
      ▼
[telegram-mcp/server.py]   ← 본 디렉토리
      │  stdio MCP 프로토콜
      ▼
[Claude Code]              ← 도구로 노출됨 (mcp__telegram-tbss__*)
```

세션 파일(`tbss_main.session`)은 **본인 계정 풀권한 자격증명**과 같음.
- ❌ git 커밋 / 클라우드 동기화 / 카카오톡 공유 절대 금지
- ✅ 로컬 PC에만 보관. `.gitignore`로 보호됨.

---

## 셋업 절차 (한 번만)

### 0. 사전 조건

- Python 3.10+ (현재 환경 확인됨: 3.14.4)
- 본인 텔레그램 계정 (실명 아니어도 됨)
- 휴대폰 번호 (텔레그램 가입한 번호)
- 인터넷 연결

### 1. API 키 발급 (이정준 직접)

1. https://my.telegram.org 접속
2. 텔레그램 가입 번호로 로그인 (인증 코드는 텔레그램 앱으로 옴 — SMS 아님!)
3. **API development tools** 메뉴
4. 폼 작성:
   - App title: `TBSS Ingest`
   - Short name: `tbss_ingest`
   - URL: 비워둠
   - Platform: `Desktop`
   - Description: `노무법인 더보상 업무 자동 인입`
5. **Create application** 클릭
6. 발급된 **api_id** (숫자), **api_hash** (32자) 즉시 안전한 곳에 복사

### 2. 의존성 설치

```bash
cd tools/telegram-mcp
python -m pip install --user -r requirements.txt
```

(이미 `telethon`, `mcp[cli]`, `python-dotenv`가 사용자 환경에 설치됨)

### 3. `.env` 파일 작성

```bash
cp .env.example .env
```

`.env` 파일을 메모장으로 열어 다음 값 채우기:

```env
TELEGRAM_API_ID=12345678                              # 위에서 발급받은 숫자
TELEGRAM_API_HASH=abcdef0123456789abcdef0123456789    # 위에서 발급받은 32자
TELEGRAM_PHONE=+821012345678                          # 본인 텔레그램 번호 (국가코드 포함)
TELEGRAM_SESSION_NAME=tbss_main                       # 그대로 두면 됨
```

### 4. 첫 로그인 (한 번만)

```bash
cd tools/telegram-mcp
python login.py
```

흐름:
1. 텔레그램 서버에 연결
2. **본인 텔레그램 앱**으로 5자리 인증 코드 도착 (SMS 아님)
3. 콘솔에 코드 입력
4. **2FA 비밀번호** 켜놨으면 그것도 입력
5. `tbss_main.session` 파일 자동 생성 → 이후 자동 로그인

성공 시 화면에 본인 계정 정보 출력.

### 5. 채팅방 목록 확인 (화이트리스트 매핑용)

```bash
python list_dialogs.py
```

다음과 같은 표가 출력됩니다:

```
ID                     TYPE             UNREAD   LAST  TITLE
---------------------- ---------------- ------ ------  ----------------------------------------
-100123456789          supergroup            3    1d   더보상 본사 단톡
-100987654321          supergroup            0    3h   소음성난청 TF
789012345              private (1:1)         0    2h   공단 △△주무관
-456789012             group (basic)         0    5h   김○○ 사건방
...
```

이 ID 값을 카테고리별로 분류해두면 다음 단계가 빠릅니다 (재해자방 / 공단방 / 내부방 / 사적방).

### 6. Claude Code에 MCP 서버 등록

`~/.claude.json` 파일을 메모장으로 열어 `mcpServers` 섹션에 추가:

```json
{
  "mcpServers": {
    "telegram-tbss": {
      "command": "python",
      "args": ["C:/Users/jjakg/thebosang/tools/telegram-mcp/server.py"]
    }
  }
}
```

> 이미 다른 MCP 서버가 있으면 같은 객체 안에 한 키로 추가하세요.
> 경로는 OS의 절대경로. Windows backslash가 JSON 안에서 escape 필요할 경우 `/` 슬래시로 써도 됨.

### 7. Claude Code 재시작 → 동작 확인

Claude Code 종료 후 다시 실행. 새 세션에서:

```
@telegram-tbss get_me
```

또는 자연어로:

```
"내 텔레그램 계정 정보 확인해줘"
```

→ 본인 계정 정보가 출력되면 셋업 성공.

---

## 노출되는 MCP 도구 (read-only)

| 도구 | 용도 |
|------|------|
| `get_me` | 연결된 계정 정보 (sanity check) |
| `list_dialogs` | 채팅방 목록 (limit, include_private, include_archived) |
| `resolve_chat` | 이름/유저명으로 채팅방 ID 조회 |
| `get_messages` | 채팅방 메시지 페이징 조회 (limit/offset_id/min_id) |
| `get_message` | 메시지 1건 상세 |
| `search_messages` | 채팅방 내 키워드 검색 |
| `download_media` | 첨부파일 다운로드 (`downloads/` 또는 지정 경로) |

> **의도적으로 빠진 것**: 메시지 전송 / 삭제 / 편집. read-only 보안 정책.

---

## 사용 예시 (Claude Code 안에서)

자연어로 Claude에게 요청하면 MCP 도구가 자동으로 호출됩니다:

```
"내 텔레그램 채팅방 중 미읽은 메시지 있는 곳 다 알려줘"
"김○○ 사건방에서 어제 받은 PDF 첨부 다 다운받아"
"공단 △△주무관과의 대화에서 '결정통지서' 키워드 검색해서 최근 5개 보여줘"
```

---

## 문제 해결

### `세션 파일 없음` 에러
→ `python login.py` 다시 실행

### `세션 만료` 에러
→ `tbss_main.session` 삭제 후 `python login.py` 재실행

### `flood wait` 에러 (대량 조회 시)
→ Telegram이 N초 대기 강제. 그냥 기다리면 됨. 백필은 천천히.

### `Unauthorized` / `phone code invalid`
→ 인증 코드는 **텔레그램 앱**으로 옴 (SMS 아님). 5분 안에 입력해야 유효.

### 2FA 켜놨는데 비밀번호 틀렸다고 함
→ 텔레그램 cloud password (2단계 인증 비밀번호). 휴대폰 잠금 비밀번호 아님.

---

## 보안 체크리스트

- [ ] `.env` 파일이 git에 커밋되지 않았는지 (`.gitignore`로 보호됨)
- [ ] `*.session` 파일이 git에 커밋되지 않았는지
- [ ] 세션 파일이 클라우드 동기화 폴더(OneDrive 등)에 없는지
- [ ] api_hash를 채팅/이메일/스크린샷으로 공유한 적 없는지
- [ ] PC 분실/도난 대비 디스크 암호화 (BitLocker) 켜져있는지

---

## 다음 단계 (별도 작업)

이 MCP 서버는 **조회용**입니다. 다음 단계는:

1. **상시 데몬 모드**: `events.NewMessage` hook으로 신규 메시지 자동 감지
2. **TBSS API 인입**: `/api/telegram/ingest` Route 추가, Prisma `TelegramIngest` 모델
3. **검수 UI**: `/admin/telegram-inbox` 미분류 인입 검수 페이지
4. **자동 분류**: 파일명·OCR로 양식 종류 추정, 발신자로 Patient 자동 매칭

각 단계는 별도 PRD로 진행. 본 디렉토리는 인프라 기반.
