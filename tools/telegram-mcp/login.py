"""
첫 로그인 스크립트 — 한 번만 실행하면 됩니다.

이 스크립트가 하는 일:
  1. .env에서 api_id / api_hash / phone 읽기
  2. 텔레그램 서버에 로그인 요청 → 본인 텔레그램 앱에 인증 코드 도착
  3. 콘솔에서 코드 입력 → 2FA 비밀번호 입력 (켜놨으면)
  4. 세션 파일(.session) 저장 — 이후 server.py가 이걸 재사용

실행 방법:
  cd tools/telegram-mcp
  python login.py

세션 파일이 한 번 만들어진 후엔 다시 실행할 필요 없음.
세션 파일 이름은 .env의 TELEGRAM_SESSION_NAME 값 (기본: tbss_main).

⚠️  세션 파일 = 본인 계정 풀권한. 절대 공유/커밋 금지.
"""
import asyncio
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from telethon import TelegramClient

# .env 로드 (이 파일 옆에 있는 .env)
HERE = Path(__file__).parent.resolve()
load_dotenv(HERE / ".env")

API_ID = os.getenv("TELEGRAM_API_ID")
API_HASH = os.getenv("TELEGRAM_API_HASH")
PHONE = os.getenv("TELEGRAM_PHONE")
SESSION_NAME = os.getenv("TELEGRAM_SESSION_NAME", "tbss_main")


def fail(msg: str) -> None:
    print(f"❌ {msg}")
    sys.exit(1)


async def main() -> None:
    # 환경변수 검증
    if not API_ID or not API_HASH:
        fail(".env에 TELEGRAM_API_ID / TELEGRAM_API_HASH 설정 필요")
    if not PHONE:
        fail(".env에 TELEGRAM_PHONE 설정 필요 (예: +821012345678)")
    try:
        api_id_int = int(API_ID)
    except ValueError:
        fail(f"TELEGRAM_API_ID는 숫자여야 함 (현재: {API_ID!r})")
        return  # for type checker

    session_path = HERE / SESSION_NAME
    if (HERE / f"{SESSION_NAME}.session").exists():
        print(f"⚠️  세션 파일이 이미 존재: {SESSION_NAME}.session")
        print("   재로그인하려면 그 파일을 먼저 삭제하세요. 보통은 그냥 server.py 실행하면 됩니다.")
        # 그래도 진행 (재인증 흐름)

    # 세션 파일은 절대경로 기준으로 생성 (실행 위치 무관)
    client = TelegramClient(str(session_path), api_id_int, API_HASH)

    print(f"🔌 텔레그램 서버에 연결 중... (phone: {PHONE})")
    print("   잠시 후 본인 텔레그램 앱에 인증 코드가 옵니다.")
    print("   (SMS 아님 — Telegram 공식 계정에서 도착)")
    print()

    await client.start(phone=PHONE)

    me = await client.get_me()
    print()
    print("✅ 로그인 성공!")
    print(f"   계정: {me.first_name} {me.last_name or ''} (@{me.username or '—'})")
    print(f"   ID: {me.id}")
    print(f"   세션 파일: {session_path}.session")
    print()
    print("이제 다음 단계:")
    print("  1. python list_dialogs.py  — 채팅방 목록 출력 (화이트리스트 매핑용)")
    print("  2. ~/.claude.json에 MCP 서버 등록 후 Claude Code 재시작")

    await client.disconnect()


if __name__ == "__main__":
    asyncio.run(main())
