"""
TBSS Telegram MCP 서버 (read-only).

stdio MCP 프로토콜로 Claude Code에게 텔레그램 조회 도구를 제공합니다.
보안 원칙상 메시지 송신 / 삭제 / 편집 도구는 일부러 노출하지 않음 (read-only).

노출되는 도구:
  - get_me                 — 어느 계정으로 연결됐는지 확인 (sanity check)
  - list_dialogs           — 채팅방 목록
  - get_messages           — 특정 채팅방의 메시지 페이징 조회
  - get_message            — 메시지 1건 상세
  - search_messages        — 채팅방 내 키워드 검색
  - download_media         — 첨부파일 다운로드 (지정 디렉토리)

세션 파일이 없으면 시작 시 즉시 종료. login.py로 한 번 로그인해야 함.

실행 (직접):
  python server.py     # stdio mode

Claude Code에 등록:
  ~/.claude.json의 mcpServers에 다음 추가:
  "telegram-tbss": {
    "command": "python",
    "args": ["C:/Users/jjakg/thebosang/tools/telegram-mcp/server.py"]
  }
"""
from __future__ import annotations

import asyncio
import os
import sys
from contextlib import asynccontextmanager
from dataclasses import dataclass
from pathlib import Path
from typing import Any, AsyncIterator

from dotenv import load_dotenv
from mcp.server.fastmcp import Context, FastMCP
from telethon import TelegramClient
from telethon.tl.types import Channel, Chat, Message, User

# ---------------------------------------------------------------------------
# 설정
# ---------------------------------------------------------------------------
HERE = Path(__file__).parent.resolve()
load_dotenv(HERE / ".env")

API_ID = os.getenv("TELEGRAM_API_ID")
API_HASH = os.getenv("TELEGRAM_API_HASH")
SESSION_NAME = os.getenv("TELEGRAM_SESSION_NAME", "tbss_main")

# 첨부 다운로드 기본 위치 (server cwd 무관하도록 절대경로)
DEFAULT_DOWNLOAD_DIR = HERE / "downloads"


@dataclass
class AppContext:
    client: TelegramClient


# ---------------------------------------------------------------------------
# 직렬화 helper — Telethon 객체를 MCP에 전달 가능한 dict로 변환
# ---------------------------------------------------------------------------
def serialize_entity(ent: Any) -> dict:
    """User / Chat / Channel → 공통 dict 표현."""
    if isinstance(ent, User):
        return {
            "kind": "user",
            "id": ent.id,
            "username": ent.username,
            "first_name": ent.first_name,
            "last_name": ent.last_name,
            "phone": ent.phone,
            "bot": bool(ent.bot),
        }
    if isinstance(ent, Chat):
        return {"kind": "group", "id": ent.id, "title": ent.title}
    if isinstance(ent, Channel):
        return {
            "kind": "supergroup" if ent.megagroup else "channel",
            "id": ent.id,
            "title": ent.title,
            "username": ent.username,
        }
    return {"kind": type(ent).__name__, "repr": repr(ent)}


def serialize_message(msg: Message) -> dict:
    """Telethon Message → JSON-friendly dict."""
    media_info = None
    if msg.media is not None:
        # 미디어 종류만 가볍게 표시. 실제 다운로드는 별도 도구로.
        media_info = {
            "type": type(msg.media).__name__,
            "has_document": getattr(msg, "document", None) is not None,
            "has_photo": getattr(msg, "photo", None) is not None,
        }
        # 파일명 / mime 추출 (가능한 경우)
        if getattr(msg, "file", None) is not None:
            media_info.update(
                {
                    "file_name": getattr(msg.file, "name", None),
                    "mime_type": getattr(msg.file, "mime_type", None),
                    "size": getattr(msg.file, "size", None),
                }
            )

    return {
        "id": msg.id,
        "chat_id": msg.chat_id,
        "date": msg.date.isoformat() if msg.date else None,
        "sender_id": msg.sender_id,
        "text": msg.message or "",
        "media": media_info,
        "reply_to_msg_id": getattr(msg.reply_to, "reply_to_msg_id", None) if msg.reply_to else None,
        "edit_date": msg.edit_date.isoformat() if msg.edit_date else None,
        "out": bool(msg.out),  # 본인 보낸 메시지인지
    }


# ---------------------------------------------------------------------------
# Lifespan — Telethon 클라이언트 수명 관리
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(_server: FastMCP) -> AsyncIterator[AppContext]:
    if not API_ID or not API_HASH:
        print(
            "❌ .env 누락: TELEGRAM_API_ID / TELEGRAM_API_HASH",
            file=sys.stderr,
        )
        sys.exit(1)

    session_path = HERE / SESSION_NAME
    if not (HERE / f"{SESSION_NAME}.session").exists():
        print(
            f"❌ 세션 파일 없음: {session_path}.session\n"
            "   먼저 `python login.py` 실행해서 로그인하세요.",
            file=sys.stderr,
        )
        sys.exit(1)

    client = TelegramClient(str(session_path), int(API_ID), API_HASH)
    await client.connect()
    if not await client.is_user_authorized():
        print(
            "❌ 세션 만료 — `python login.py`로 재로그인 필요",
            file=sys.stderr,
        )
        await client.disconnect()
        sys.exit(1)

    try:
        yield AppContext(client=client)
    finally:
        await client.disconnect()


# ---------------------------------------------------------------------------
# MCP 서버 + 도구
# ---------------------------------------------------------------------------
mcp = FastMCP("telegram-tbss", lifespan=lifespan)


def _client(ctx: Context) -> TelegramClient:
    return ctx.request_context.lifespan_context.client


@mcp.tool()
async def get_me(ctx: Context) -> dict:
    """현재 연결된 텔레그램 계정 정보 (어느 계정인지 확인용)."""
    me = await _client(ctx).get_me()
    return serialize_entity(me)


@mcp.tool()
async def list_dialogs(
    ctx: Context,
    limit: int = 100,
    include_private: bool = True,
    include_archived: bool = False,
) -> list[dict]:
    """
    채팅방(dialog) 목록 조회.

    Args:
        limit: 최근 N개 (기본 100, 최대 500 권장)
        include_private: 1:1 채팅 포함 여부 (기본 포함)
        include_archived: 보관 처리된 채팅 포함 (기본 미포함)
    """
    if limit > 500:
        limit = 500
    rows: list[dict] = []
    async for d in _client(ctx).iter_dialogs(limit=limit, archived=include_archived):
        ent_dict = serialize_entity(d.entity)
        if not include_private and ent_dict.get("kind") == "user":
            continue
        rows.append(
            {
                "id": d.id,
                "name": d.name,
                "unread": d.unread_count,
                "last_message_date": d.date.isoformat() if d.date else None,
                "entity": ent_dict,
                "pinned": bool(d.pinned),
                "archived": bool(d.archived),
            }
        )
    return rows


@mcp.tool()
async def get_messages(
    ctx: Context,
    chat: str | int,
    limit: int = 30,
    offset_id: int = 0,
    min_id: int = 0,
) -> list[dict]:
    """
    특정 채팅방의 메시지 조회 (최신순).

    Args:
        chat: 채팅방 ID (정수) 또는 username (예: 'durumi_official')
        limit: 가져올 개수 (기본 30, 최대 200)
        offset_id: 이 ID보다 오래된 메시지부터 (페이지네이션용)
        min_id: 이 ID보다 새 메시지만 (워터마크용 — 데몬 백필 시 사용)
    """
    if limit > 200:
        limit = 200
    chat_arg = int(chat) if isinstance(chat, str) and chat.lstrip("-").isdigit() else chat
    msgs: list[dict] = []
    async for m in _client(ctx).iter_messages(
        chat_arg, limit=limit, offset_id=offset_id, min_id=min_id
    ):
        msgs.append(serialize_message(m))
    return msgs


@mcp.tool()
async def get_message(ctx: Context, chat: str | int, message_id: int) -> dict | None:
    """메시지 1건 상세 조회. 없으면 None."""
    chat_arg = int(chat) if isinstance(chat, str) and chat.lstrip("-").isdigit() else chat
    msg = await _client(ctx).get_messages(chat_arg, ids=message_id)
    if msg is None:
        return None
    return serialize_message(msg)


@mcp.tool()
async def search_messages(
    ctx: Context,
    chat: str | int,
    query: str,
    limit: int = 30,
) -> list[dict]:
    """
    채팅방 내 키워드 검색.

    Args:
        chat: 채팅방 ID 또는 username
        query: 검색어
        limit: 최대 결과 수 (기본 30)
    """
    if limit > 200:
        limit = 200
    chat_arg = int(chat) if isinstance(chat, str) and chat.lstrip("-").isdigit() else chat
    msgs: list[dict] = []
    async for m in _client(ctx).iter_messages(chat_arg, search=query, limit=limit):
        msgs.append(serialize_message(m))
    return msgs


@mcp.tool()
async def download_media(
    ctx: Context,
    chat: str | int,
    message_id: int,
    save_dir: str | None = None,
) -> dict:
    """
    메시지 첨부파일 다운로드.

    Args:
        chat: 채팅방 ID 또는 username
        message_id: 다운로드할 메시지 ID
        save_dir: 저장 디렉토리 절대경로. 미지정 시 tools/telegram-mcp/downloads/

    Returns:
        {"path": "...", "size": 12345, "mime_type": "..."}  성공 시
        {"error": "..."}  실패 시
    """
    chat_arg = int(chat) if isinstance(chat, str) and chat.lstrip("-").isdigit() else chat
    msg = await _client(ctx).get_messages(chat_arg, ids=message_id)
    if msg is None:
        return {"error": "message not found"}
    if msg.media is None:
        return {"error": "no media in this message"}

    target_dir = Path(save_dir) if save_dir else DEFAULT_DOWNLOAD_DIR
    target_dir.mkdir(parents=True, exist_ok=True)

    saved_path = await _client(ctx).download_media(msg, file=str(target_dir))
    if saved_path is None:
        return {"error": "download returned None"}

    p = Path(saved_path)
    return {
        "path": str(p),
        "size": p.stat().st_size if p.exists() else None,
        "mime_type": getattr(msg.file, "mime_type", None) if msg.file else None,
        "file_name": getattr(msg.file, "name", None) if msg.file else None,
    }


@mcp.tool()
async def resolve_chat(ctx: Context, query: str) -> dict | None:
    """
    채팅방 이름/사용자명/전화번호로 채팅방 ID 조회.

    Args:
        query: 채팅방 제목 일부, @username, 또는 +전화번호
    """
    try:
        ent = await _client(ctx).get_entity(query)
        return serialize_entity(ent)
    except Exception as e:
        return {"error": f"{type(e).__name__}: {e}"}


# ---------------------------------------------------------------------------
# 진입점
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    # FastMCP의 기본 transport는 stdio (Claude Code 등록 시 그대로 작동)
    mcp.run()
