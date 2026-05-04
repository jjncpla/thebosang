"""
채팅방(dialog) 목록 출력 — 화이트리스트 매핑용.

login.py로 세션 만든 후 한 번 실행하면, 본인 계정에 보이는 모든 채팅방을
다음 정보와 함께 출력합니다:

  ID                  | type           | unread | last  | title
  -123456789          | group          |    3   | 1d    | 김○○ 사건방
  789012345           | private (1:1)  |    0   | 3h    | 공단 △△주무관
  -100123456789       | channel        |   12   | 2h    | 더보상 본사 단톡
  ...

이 ID 값을 .claude/whitelist.json (나중에 만들 파일)에 카테고리별로
분류해두면 데몬 모드에서 인입 정책을 적용할 수 있습니다.

실행:
  cd tools/telegram-mcp
  python list_dialogs.py [--limit 200]

옵션:
  --limit N      최근 N개 dialog만 (기본 200)
  --json         사람-친화 표 대신 JSON으로 출력 (스크립트 연계용)
  --include-private   1:1 채팅도 포함 (기본 포함, --no-private로 제외 가능)
"""
import argparse
import asyncio
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
from telethon import TelegramClient
from telethon.tl.types import Channel, Chat, User

HERE = Path(__file__).parent.resolve()
load_dotenv(HERE / ".env")

API_ID = os.getenv("TELEGRAM_API_ID")
API_HASH = os.getenv("TELEGRAM_API_HASH")
SESSION_NAME = os.getenv("TELEGRAM_SESSION_NAME", "tbss_main")


def classify(entity) -> str:
    """텔레그램 엔티티 → 사람이 보기 좋은 타입 라벨."""
    if isinstance(entity, User):
        if entity.bot:
            return "bot"
        return "private (1:1)"
    if isinstance(entity, Chat):
        return "group (basic)"
    if isinstance(entity, Channel):
        if entity.megagroup:
            return "supergroup"
        if entity.broadcast:
            return "channel"
        return "channel?"
    return type(entity).__name__


def humanize_age(dt: datetime | None) -> str:
    if dt is None:
        return "—"
    now = datetime.now(timezone.utc)
    delta = now - dt
    secs = int(delta.total_seconds())
    if secs < 60:
        return f"{secs}s"
    if secs < 3600:
        return f"{secs // 60}m"
    if secs < 86400:
        return f"{secs // 3600}h"
    if secs < 86400 * 30:
        return f"{secs // 86400}d"
    return f"{secs // 86400}d+"


async def main(limit: int, output_json: bool, include_private: bool) -> None:
    if not API_ID or not API_HASH:
        print("❌ .env 설정 누락 — TELEGRAM_API_ID / TELEGRAM_API_HASH")
        sys.exit(1)

    session_path = HERE / SESSION_NAME
    if not (HERE / f"{SESSION_NAME}.session").exists():
        print(f"❌ 세션 파일 없음: {session_path}.session")
        print("   먼저 `python login.py` 실행해서 로그인하세요.")
        sys.exit(1)

    client = TelegramClient(str(session_path), int(API_ID), API_HASH)
    await client.connect()

    if not await client.is_user_authorized():
        print("❌ 세션이 만료됐거나 권한 부족 — `python login.py` 다시 실행")
        await client.disconnect()
        sys.exit(1)

    rows = []
    async for dialog in client.iter_dialogs(limit=limit):
        ent = dialog.entity
        type_label = classify(ent)
        if not include_private and type_label == "private (1:1)":
            continue
        rows.append(
            {
                "id": dialog.id,
                "type": type_label,
                "unread": dialog.unread_count,
                "last_message_age": humanize_age(dialog.date),
                "last_message_iso": dialog.date.isoformat() if dialog.date else None,
                "title": dialog.name or "(unnamed)",
            }
        )

    await client.disconnect()

    if output_json:
        print(json.dumps(rows, ensure_ascii=False, indent=2))
        return

    # 표 출력
    print(f"\n총 {len(rows)} 개 dialog\n")
    print(f"{'ID':<22} {'TYPE':<16} {'UNREAD':>6} {'LAST':>6}  TITLE")
    print(f"{'-'*22} {'-'*16} {'-'*6} {'-'*6}  {'-'*40}")
    for r in rows:
        title = r["title"][:60]
        print(
            f"{r['id']!s:<22} {r['type']:<16} {r['unread']:>6} {r['last_message_age']:>6}  {title}"
        )
    print()
    print("화이트리스트 매핑 팁:")
    print("  - 재해자 1:1방 / 재해자 가족 단톡 / 공단 담당자방 → 인입 ON")
    print("  - 사무실 내부 단톡 / TF 단톡 → 첨부만 인입")
    print("  - 사적 1:1방 / 채널 구독 → 인입 OFF")
    print()
    print("이 출력을 `.claude/telegram-whitelist.draft.json`에 저장해두면 다음 단계가 빠릅니다.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=200)
    parser.add_argument("--json", action="store_true", dest="output_json")
    parser.add_argument(
        "--no-private", action="store_false", dest="include_private", default=True
    )
    args = parser.parse_args()

    asyncio.run(main(args.limit, args.output_json, args.include_private))
