"""
dialogs_dump → telegram-whitelist.draft.json 자동 분류기.

이름 기반 휴리스틱으로 1차 분류, 결과를 카테고리별로 출력.
"""
from __future__ import annotations

import json
import re
import sys
from collections import defaultdict
from pathlib import Path

HERE = Path(__file__).parent.resolve()


CATEGORIES = [
    "patient_1to1",
    "patient_family",
    "kosha_officer",
    "internal_branch",
    "internal_tf",
    "internal_topic",
    "external_partner",
    "personal",
    "needs_review",
]


def classify(d: dict) -> tuple[str, str]:
    """(category, reason) 반환."""
    name = (d.get("name") or "").strip()
    ent = d.get("entity") or {}
    kind = ent.get("kind", "?")
    is_bot = ent.get("bot")
    username = (ent.get("username") or "")

    lower = name.lower()

    # 봇 / 채널 → 사적 구독으로 간주
    if is_bot:
        return "personal", "bot account"
    if kind == "channel":
        return "personal", "broadcast channel"

    # ------ 그룹 패턴 (group / supergroup) ------
    if kind in ("group", "supergroup"):
        # 0순위: 친목/사적/테스트 그룹 (인입 OFF)
        if re.search(r"풋살|사커|축구|워크샵|워크숍|여행|투어|선물교환|특공대|사랑방|알쓸신잡|먼작귀|사대천왕", name):
            return "personal", "social/club group"
        if re.search(r"TBSS|TBS\s|아마란스|테스트.*피드백|피드백.*테스트", name):
            return "personal", "system testing group"
        if re.search(r"^!+$|^@+|^\?+", name) or name.count("!") >= 5 or name.count("@") >= 3:
            return "personal", "informal-name group"
        if "고도크한" in name or "영슈증" in name:
            return "personal", "informal/joke group"

        # 공단 관련
        if re.search(r"공단|근로복지|판정위|심사위", name):
            if "더보상" in name or "고독한" in name:
                return "internal_topic", "internal topic about kosha"
            return "kosha_officer", "kosha-related group"
        # 지통실 = 근복지공단 지사 통합실
        if re.search(r"지통실", name):
            return "kosha_officer", "kosha branch office"

        # TF 그룹 (지역명+TF, 본부TF, 사커TF는 위에서 거름)
        if re.search(r"TF|tf|티에프", name):
            return "internal_tf", "TF group"

        # 더보상 권역/지사/본사/송무
        if re.search(r"더보상|본사|지사|권역|송무|간부|지사장", name):
            return "internal_branch", "branch/regional internal group"

        # 신입/교육/홍보/영업기획
        if re.search(r"신입|교육방|홍보|영업기획|블로그|커뮤니티|대나무숲|핵심간부", name):
            return "internal_branch", "internal HR/edu/comm group"

        # 산재 칼럼/뉴스/리딩
        if re.search(r"산재칼럼|산재기사|리딩방", name):
            return "internal_branch", "internal news/column group"

        # 고독한 시리즈 → 토픽방
        if "고독한" in name:
            return "internal_topic", "topic-specific internal group"

        # 질환 / 상병 토픽
        if re.search(r"폐질환|난청|근골|소음성|진폐|COPD|중증|유족|직업병|상담소", name):
            return "internal_topic", "disease-topic group"

        # 소송 / 민사 / 근재
        if re.search(r"소송|민사|근재|감정서|문답", name):
            return "internal_topic", "litigation/topic group"

        # 일정/접수/리스트업/공유방 일반 토픽
        if re.search(r"일정방|접수|리스트업|공유방|보고방|정산|관리방|결정통지서|재결서|진찰요구|의무기록", name):
            return "internal_topic", "operational topic group"

        # 사보험 영업
        if re.search(r"사보험|영업", name):
            return "internal_branch", "sales/insurance group"

        # 프로젝트 / 프로그램 / 그룹웨어
        if re.search(r"프로젝트|프로그램|연구원|어선원", name):
            return "internal_branch", "internal project group"

        # 병원 / 의료기관
        if re.search(r"병원|의원|의료원|정형외과|이비인후과|내과|클리닉|메디컬|닥터", name):
            return "external_partner", "medical facility"

        # 사건방 패턴 (이름에 "사건" 들어감)
        if "사건" in name or re.search(r"재해자|환자", name):
            return "patient_family", "case/family group"

        # 가족 패턴
        if re.search(r"가족|아버지|어머니|부모|아드님|따님|배우자|남편|아내", name):
            return "patient_family", "family group"

        return "needs_review", f"group, no rule matched: {name}"

    # ------ 1:1 (user) ------
    if kind == "user":
        first = ent.get("first_name") or ""
        last = ent.get("last_name") or ""
        full = f"{last}{first}".strip() or name

        # 채널 봇/공식
        if username and re.search(r"bot$|official|news|notify", username, re.I):
            return "personal", f"public/bot username: {username}"

        # 공단 직원/주무관/팀장
        if re.search(r"공단|주무관|팀장|과장|차장|부장|본부장|소장|국장", full + " " + name):
            return "kosha_officer", "kosha officer 1:1"

        # 더보상 동료 (성+이름이 더보상 직원으로 추정 — 단, 룰만으로는 못 거름)
        if re.search(r"더보상|노무사|사무장|실장|이사|대표", full + " " + name):
            return "internal_branch", "internal staff 1:1"

        # 병원 직원
        if re.search(r"병원|의원|선생님|원장|코디|상담사", full + " " + name):
            return "external_partner", "medical contact 1:1"

        # 그 외 1:1 → 재해자 1:1로 일단 가정 (검수 필요)
        return "patient_1to1", "default for 1:1"

    return "needs_review", f"unknown kind: {kind}"


def main() -> int:
    dump_path = HERE / "dialogs_dump.json"
    if not dump_path.exists():
        # fallback: tool-results 파일
        alt = Path(
            r"C:\Users\jjakg\.claude\projects\C--Users-jjakg-thebosang--claude-worktrees-nifty-hawking-17f965\fe1ef77b-a0db-4c6e-817d-66fb603189f9\tool-results\mcp-telegram-tbss-list_dialogs-1777872497354.txt"
        )
        if alt.exists():
            data = json.loads(alt.read_text(encoding="utf-8"))
            dialogs = data["result"]
        else:
            print(f"❌ dump 파일 없음: {dump_path}", file=sys.stderr)
            return 1
    else:
        dialogs = json.loads(dump_path.read_text(encoding="utf-8"))

    buckets: dict[str, list[dict]] = defaultdict(list)
    for d in dialogs:
        cat, reason = classify(d)
        buckets[cat].append(
            {
                "id": d["id"],
                "name": d.get("name"),
                "kind": (d.get("entity") or {}).get("kind"),
                "username": (d.get("entity") or {}).get("username"),
                "unread": d.get("unread", 0),
                "last_message_date": d.get("last_message_date"),
                "reason": reason,
            }
        )

    out = {cat: buckets.get(cat, []) for cat in CATEGORIES}
    out_path = HERE / "telegram-whitelist.draft.json"
    out_path.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"[OK] {out_path}")
    for cat in CATEGORIES:
        print(f"  {cat:20s} {len(out[cat]):4d}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
