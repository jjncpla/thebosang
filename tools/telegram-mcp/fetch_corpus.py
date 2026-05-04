"""
학습 코퍼스 수집기.

지정한 채팅방 목록에서 최근 메시지 N개와 첨부파일을 다운로드.
- corpus/{category}/{chat_id}__{safe_title}/messages.jsonl
- corpus/{category}/{chat_id}__{safe_title}/media/{message_id}__{filename}

읽기 전용. 본인 텔레그램 자료를 학습용 로컬 코퍼스로만 사용.
PII 포함 가능 — git ignored.
"""
from __future__ import annotations

import asyncio
import json
import os
import re
import sys
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv
from telethon import TelegramClient

HERE = Path(__file__).parent.resolve()
load_dotenv(HERE / ".env")

API_ID = os.getenv("TELEGRAM_API_ID")
API_HASH = os.getenv("TELEGRAM_API_HASH")
SESSION_NAME = os.getenv("TELEGRAM_SESSION_NAME", "tbss_main")

CORPUS_ROOT = HERE / "corpus"


def safe_filename(s: str) -> str:
    s = re.sub(r"[\\/:*?\"<>|\r\n\t]", "_", s).strip()
    return s[:80] or "untitled"


@dataclass
class Target:
    chat_id: int
    title: str
    category: str
    limit: int = 200          # 최근 메시지 N개
    download_media: bool = True


async def fetch_one(client: TelegramClient, t: Target) -> dict:
    chat_dir = CORPUS_ROOT / t.category / f"{t.chat_id}__{safe_filename(t.title)}"
    media_dir = chat_dir / "media"
    chat_dir.mkdir(parents=True, exist_ok=True)
    if t.download_media:
        media_dir.mkdir(exist_ok=True)

    msgs_path = chat_dir / "messages.jsonl"
    msg_count = 0
    media_count = 0
    media_bytes = 0
    skipped_existing_media = 0

    with msgs_path.open("w", encoding="utf-8") as f:
        async for m in client.iter_messages(t.chat_id, limit=t.limit):
            row: dict = {
                "id": m.id,
                "date": m.date.isoformat() if m.date else None,
                "sender_id": m.sender_id,
                "text": m.message or "",
                "out": bool(m.out),
                "reply_to": getattr(m.reply_to, "reply_to_msg_id", None) if m.reply_to else None,
                "edit_date": m.edit_date.isoformat() if m.edit_date else None,
            }
            if m.media is not None:
                file_name = getattr(m.file, "name", None) if m.file else None
                mime = getattr(m.file, "mime_type", None) if m.file else None
                size = getattr(m.file, "size", None) if m.file else None
                row["media"] = {
                    "type": type(m.media).__name__,
                    "file_name": file_name,
                    "mime_type": mime,
                    "size": size,
                }
                # 사진은 file_name 없을 수 있음
                if t.download_media:
                    target_name = f"{m.id}__{safe_filename(file_name or 'photo')}"
                    target_path = media_dir / target_name
                    # 이미 있으면 skip (idempotent)
                    if any(media_dir.glob(f"{m.id}__*")):
                        skipped_existing_media += 1
                    else:
                        try:
                            saved = await client.download_media(m, file=str(target_path))
                            if saved:
                                media_count += 1
                                p = Path(saved)
                                if p.exists():
                                    media_bytes += p.stat().st_size
                                row["media"]["saved_path"] = str(Path(saved).relative_to(chat_dir))
                        except Exception as e:
                            row["media"]["download_error"] = f"{type(e).__name__}: {e}"
            f.write(json.dumps(row, ensure_ascii=False) + "\n")
            msg_count += 1

    return {
        "chat_id": t.chat_id,
        "title": t.title,
        "category": t.category,
        "messages": msg_count,
        "media_downloaded": media_count,
        "media_skipped_existing": skipped_existing_media,
        "media_bytes": media_bytes,
        "path": str(chat_dir),
    }


async def main():
    if not API_ID or not API_HASH:
        print("[ERR] .env 누락", file=sys.stderr); sys.exit(1)

    plan_path = HERE / "fetch_plan.json"
    if not plan_path.exists():
        print(f"[ERR] {plan_path} 없음. 채팅방 리스트 작성 필요.", file=sys.stderr)
        sys.exit(1)
    plan = json.loads(plan_path.read_text(encoding="utf-8"))
    targets = [Target(**t) for t in plan["targets"]]

    session_path = HERE / SESSION_NAME
    client = TelegramClient(str(session_path), int(API_ID), API_HASH)
    await client.connect()
    if not await client.is_user_authorized():
        print("[ERR] 세션 만료 — login.py 재실행", file=sys.stderr); sys.exit(1)

    print(f"[INFO] {len(targets)}개 채팅방 수집 시작 → {CORPUS_ROOT}")
    summary = []
    for i, t in enumerate(targets, 1):
        print(f"  [{i}/{len(targets)}] {t.category} :: {t.title} (limit={t.limit}, media={t.download_media})")
        try:
            r = await fetch_one(client, t)
            print(f"    msgs={r['messages']} media={r['media_downloaded']} (+{r['media_skipped_existing']} skipped) {r['media_bytes']/1024/1024:.1f}MB")
            summary.append(r)
        except Exception as e:
            print(f"    [ERR] {type(e).__name__}: {e}")
            summary.append({"chat_id": t.chat_id, "title": t.title, "error": str(e)})

    (CORPUS_ROOT / "_fetch_summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    await client.disconnect()
    print(f"[DONE] summary → {CORPUS_ROOT / '_fetch_summary.json'}")


if __name__ == "__main__":
    asyncio.run(main())
