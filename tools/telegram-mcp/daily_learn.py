"""
매일 학습 보고서 자동화.

흐름:
  1. fetch_corpus 실행 (lock 시 skip)
  2. corpus 메시지 + 첨부 메타데이터 분석
  3. 어제 대비 신규 메시지/패턴 추출
  4. docs/daily-reports/learning-{YYYY-MM-DD}.md 작성
  5. (옵션) 본인 텔레그램으로 요약 발송 — TELEGRAM_USER_ID, TELEGRAM_BOT_TOKEN 있을 때만

실행:
  python tools/telegram-mcp/daily_learn.py

스케줄링:
  Windows Task Scheduler 또는 cron으로 매일 1회 실행 권장.
  install_daily_task.ps1 참조.
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from collections import Counter
from datetime import datetime, timedelta
from pathlib import Path

from dotenv import load_dotenv

HERE = Path(__file__).parent.resolve()
load_dotenv(HERE / ".env")

REPO_ROOT = HERE.parent.parent
CORPUS_ROOT = HERE / "corpus"
REPORT_DIR = REPO_ROOT / "docs" / "daily-reports"
STATE_FILE = HERE / ".daily_state.json"  # 마지막 처리한 message id 추적

TODAY = datetime.now()
DATE_TAG = TODAY.strftime("%Y-%m-%d")
REPORT_PATH = REPORT_DIR / f"learning-{DATE_TAG}.md"


def load_state() -> dict:
    if STATE_FILE.exists():
        try:
            return json.loads(STATE_FILE.read_text(encoding="utf-8"))
        except Exception:
            return {}
    return {}


def save_state(state: dict) -> None:
    STATE_FILE.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")


def try_fetch() -> tuple[bool, str]:
    """fetch_corpus.py 실행. lock 시 실패해도 OK (기존 corpus로 분석 진행)."""
    plan = HERE / "fetch_plan.json"
    if not plan.exists():
        return False, "fetch_plan.json 없음 — fetch 스킵"
    try:
        r = subprocess.run(
            [sys.executable, str(HERE / "fetch_corpus.py")],
            capture_output=True, text=True, timeout=600,
            env={**os.environ, "PYTHONIOENCODING": "utf-8"},
        )
        if r.returncode != 0:
            return False, f"fetch 실패 (lock 가능성): {r.stderr[-300:]}"
        return True, r.stdout[-500:]
    except subprocess.TimeoutExpired:
        return False, "fetch 타임아웃"
    except Exception as e:
        return False, f"fetch 예외: {type(e).__name__}: {e}"


def analyze_corpus(state: dict) -> dict:
    """
    corpus 전체 + 어제 대비 신규 추출.
    state['last_seen'] = { chat_id: last_msg_id } 로 다음 실행 시 신규만 잡음.
    """
    last_seen = state.get("last_seen", {})
    new_state_seen: dict[str, int] = dict(last_seen)

    summary = {
        "total_chats": 0,
        "total_messages": 0,
        "total_attachments": 0,
        "total_attachment_mb": 0.0,
        "new_since_last": 0,
        "new_attachments": 0,
        "per_chat": [],
        "new_message_samples": [],
        "form_keyword_distribution": Counter(),
    }

    FORM_KEYWORDS = {
        "진찰요구서": r"진찰요구|특별진찰|특진|전문조사",
        "결정통지서": r"결정통지|승인.*통지|불승인.*통지",
        "평균임금": r"평균임금|임금산정|임금내역",
        "심사청구": r"심사청구|이의제기|재심사",
        "재결서": r"재결서",
        "위임장": r"위임장|약정서",
        "유족자료": r"유족",
        "결정자료": r"승인 자료|불승인 자료|승인자료|불승인자료",
    }

    if not CORPUS_ROOT.exists():
        return summary

    for cat_dir in sorted(CORPUS_ROOT.iterdir()):
        if not cat_dir.is_dir() or cat_dir.name.startswith("_"):
            continue
        for chat_dir in sorted(cat_dir.iterdir()):
            if not chat_dir.is_dir():
                continue
            msgs_path = chat_dir / "messages.jsonl"
            if not msgs_path.exists():
                continue
            chat_id_str = chat_dir.name.split("__", 1)[0]
            chat_title = chat_dir.name.split("__", 1)[1] if "__" in chat_dir.name else chat_dir.name

            msgs = [json.loads(l) for l in msgs_path.open(encoding="utf-8")]
            summary["total_chats"] += 1
            summary["total_messages"] += len(msgs)

            attachments = [m for m in msgs if m.get("media")]
            summary["total_attachments"] += len(attachments)
            for a in attachments:
                summary["total_attachment_mb"] += (a["media"].get("size") or 0) / 1024 / 1024

            # 신규 메시지 (last_seen 이후)
            last_id = last_seen.get(chat_id_str, 0)
            new_msgs = [m for m in msgs if m["id"] > last_id]
            summary["new_since_last"] += len(new_msgs)
            new_attachments = [m for m in new_msgs if m.get("media")]
            summary["new_attachments"] += len(new_attachments)

            if msgs:
                new_state_seen[chat_id_str] = max(m["id"] for m in msgs)

            # 신규 메시지 샘플 (텍스트 있는 것 중 5건)
            for m in new_msgs[:5]:
                text = (m.get("text") or "").replace("\n", " / ")[:160]
                fn = m.get("media", {}).get("file_name") if m.get("media") else None
                if text or fn:
                    summary["new_message_samples"].append({
                        "chat": chat_title[:40],
                        "date": (m.get("date") or "")[:16],
                        "text": text,
                        "filename": fn,
                    })

            # 양식 키워드 분포 (전체 corpus 기준)
            for m in msgs:
                fn = m.get("media", {}).get("file_name", "") if m.get("media") else ""
                text = m.get("text", "") or ""
                hay = fn + " " + text
                for form, pat in FORM_KEYWORDS.items():
                    if re.search(pat, hay):
                        summary["form_keyword_distribution"][form] += 1

            summary["per_chat"].append({
                "category": cat_dir.name,
                "title": chat_title,
                "messages": len(msgs),
                "attachments": len(attachments),
                "new_messages": len(new_msgs),
                "new_attachments": len(new_attachments),
            })

    summary["form_keyword_distribution"] = dict(summary["form_keyword_distribution"].most_common())
    return summary


def write_report(summary: dict, fetch_status: str) -> str:
    REPORT_DIR.mkdir(parents=True, exist_ok=True)

    # 신규 메시지 샘플 30건 제한
    samples = summary["new_message_samples"][:30]

    lines = []
    lines.append(f"# 텔레그램 학습 일일 보고서 — {DATE_TAG}\n")
    lines.append(f"_생성 시각: {TODAY.strftime('%Y-%m-%d %H:%M:%S')}_\n")
    lines.append(f"\n## fetch 상태\n\n```\n{fetch_status.strip()}\n```\n")
    lines.append(f"\n## 코퍼스 누적\n")
    lines.append(f"- 채팅방: **{summary['total_chats']}개**")
    lines.append(f"- 메시지: **{summary['total_messages']:,}건**")
    lines.append(f"- 첨부: **{summary['total_attachments']:,}건 / {summary['total_attachment_mb']:.0f} MB**")
    lines.append(f"\n## 어제 대비 신규\n")
    lines.append(f"- 신규 메시지: **{summary['new_since_last']:,}건**")
    lines.append(f"- 신규 첨부: **{summary['new_attachments']:,}건**\n")

    if summary["per_chat"]:
        lines.append("\n## 채팅방별 누적/신규\n")
        lines.append("| 카테고리 | 채팅방 | 누적msg | 누적첨부 | 신규msg | 신규첨부 |")
        lines.append("|---------|-------|--------|---------|--------|---------|")
        for c in summary["per_chat"]:
            lines.append(f"| {c['category']} | {c['title'][:30]} | {c['messages']} | {c['attachments']} | {c['new_messages']} | {c['new_attachments']} |")

    if summary["form_keyword_distribution"]:
        lines.append("\n## 양식 키워드 분포 (코퍼스 누적)\n")
        for k, v in summary["form_keyword_distribution"].items():
            lines.append(f"- **{k}**: {v}")

    if samples:
        lines.append(f"\n## 신규 메시지 샘플 ({len(samples)}건)\n")
        for s in samples:
            fn_part = f" 📎 `{s['filename']}`" if s.get('filename') else ""
            text_part = f" — {s['text']}" if s.get('text') else ""
            lines.append(f"- `[{s['date']}]` _{s['chat']}_{fn_part}{text_part}")

    lines.append("\n---\n")
    lines.append("*분석 기준: `tools/telegram-mcp/corpus/`의 누적 messages.jsonl. 원본은 gitignored.*")
    lines.append("*본 보고서는 `tools/telegram-mcp/daily_learn.py`로 매일 자동 생성.*\n")

    REPORT_PATH.write_text("\n".join(lines), encoding="utf-8")
    return str(REPORT_PATH)


def maybe_send_telegram(report_path: str, summary: dict) -> str:
    """봇 토큰이 있으면 텔레그램으로 요약 송신."""
    bot_token = os.getenv("TELEGRAM_BOT_TOKEN")
    user_chat_id = os.getenv("TELEGRAM_USER_CHAT_ID")
    if not bot_token or not user_chat_id:
        return "텔레그램 발송 스킵 (TELEGRAM_BOT_TOKEN / TELEGRAM_USER_CHAT_ID 미설정)"

    try:
        import urllib.request, urllib.parse
        text = (
            f"📚 텔레그램 학습 일일 보고서 ({DATE_TAG})\n\n"
            f"누적: {summary['total_messages']:,}건 메시지 / {summary['total_attachments']:,}첨부 ({summary['total_attachment_mb']:.0f}MB)\n"
            f"신규: {summary['new_since_last']:,}메시지 / {summary['new_attachments']:,}첨부\n\n"
            f"전체 보고서: {report_path}"
        )
        url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
        data = urllib.parse.urlencode({
            "chat_id": user_chat_id,
            "text": text,
        }).encode()
        with urllib.request.urlopen(url, data=data, timeout=15) as r:
            r.read()
        return "텔레그램 발송 OK"
    except Exception as e:
        return f"텔레그램 발송 실패: {type(e).__name__}: {e}"


def main():
    print(f"[daily_learn] start {DATE_TAG}")
    state = load_state()

    print("  [1] fetch_corpus 실행")
    ok, fetch_status = try_fetch()
    print(f"    -> {'OK' if ok else 'SKIP'}: {fetch_status[:200]}")

    print("  [2] corpus 분석")
    summary = analyze_corpus(state)
    print(f"    누적 {summary['total_messages']}건 / 신규 {summary['new_since_last']}건")

    print("  [3] 보고서 작성")
    report_path = write_report(summary, fetch_status)
    print(f"    -> {report_path}")

    print("  [4] 텔레그램 발송 시도")
    result = maybe_send_telegram(report_path, summary)
    print(f"    -> {result}")

    # state 갱신
    state["last_seen"] = state.get("last_seen", {})
    # write_report 호출 후 갱신 (중간 실패 시 재시도 가능)
    new_seen: dict = {}
    if CORPUS_ROOT.exists():
        for cat_dir in CORPUS_ROOT.iterdir():
            if not cat_dir.is_dir() or cat_dir.name.startswith("_"):
                continue
            for chat_dir in cat_dir.iterdir():
                msgs_path = chat_dir / "messages.jsonl"
                if not msgs_path.exists(): continue
                cid = chat_dir.name.split("__",1)[0]
                msgs = [json.loads(l) for l in msgs_path.open(encoding="utf-8")]
                if msgs:
                    new_seen[cid] = max(m["id"] for m in msgs)
    state["last_seen"] = new_seen
    state["last_run"] = TODAY.isoformat()
    save_state(state)
    print(f"[daily_learn] done")


if __name__ == "__main__":
    main()
