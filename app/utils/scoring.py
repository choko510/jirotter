from __future__ import annotations

from typing import Dict, Optional, Tuple

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models import User, UserPointLog
from app.utils.achievements import evaluate_new_titles, serialize_title_record


RANK_DEFINITIONS = [
    {
        "name": "味覚ビギナー",
        "min_points": 0,
        "badge_color": "#9CA3AF",
        "description": "初めての一杯を記録し始めた初心者",
    },
    {
        "name": "麺道サーチャー",
        "min_points": 80,
        "badge_color": "#60A5FA",
        "description": "街の人気店を巡る探求者",
    },
    {
        "name": "スープナビゲーター",
        "min_points": 180,
        "badge_color": "#34D399",
        "description": "味の違いを言葉にできる案内人",
    },
    {
        "name": "麺匠キュレーター",
        "min_points": 320,
        "badge_color": "#FBBF24",
        "description": "地域のラーメン情報を牽引するキュレーター",
    },
    {
        "name": "伝説のローカルガイド",
        "min_points": 520,
        "badge_color": "#F97316",
        "description": "多くの人に愛される伝説の案内人",
    },
]


POINT_RULES: Dict[str, Dict[str, object]] = {
    "checkin": {"points": 15, "internal": 1, "reason": "チェックインボーナス"},
    "waittime_report": {"points": 12, "internal": 2, "reason": "待ち時間の共有"},
    "image_post": {"points": 18, "internal": 1, "reason": "写真付き投稿"},
    "video_post": {"points": 22, "internal": 2, "reason": "動画付き投稿"},
    "new_follower": {"points": 20, "internal": 1, "reason": "フォロワー獲得"},
}


PENALTY_RULES: Dict[str, Dict[str, Dict[str, object]]] = {
    "content_violation": {
        "low": {"points": -20, "internal": -25, "reason": "軽微なガイドライン違反"},
        "medium": {"points": -40, "internal": -35, "reason": "ガイドライン違反"},
        "high": {"points": -70, "internal": -50, "reason": "重大なガイドライン違反"},
    },
    "false_information": {
        "default": {"points": -25, "internal": -30, "reason": "誤情報の投稿"},
    },
}


STATUS_THRESHOLDS = {
    "warning": 70,
    "restricted": 45,
    "banned": 25,
}


STATUS_MESSAGES = {
    "active": "健全な貢献状態です。次のランクを目指して投稿を続けましょう！",
    "warning": "コミュニティスコアが低下しています。より正確で安全な投稿を心掛けてください。",
    "restricted": "現在は投稿・チェックインが制限されています。コミュニティガイドラインに沿った利用を心掛けてください。",
    "banned": "利用規約違反によりアカウントが停止されています。サポートまでお問い合わせください。",
}


def _clamp(value: int, minimum: int, maximum: int) -> int:
    return max(minimum, min(value, maximum))


def _determine_rank(points: int) -> Tuple[Dict[str, object], Optional[Dict[str, object]]]:
    current_rank = RANK_DEFINITIONS[0]
    next_rank: Optional[Dict[str, object]] = None

    for rank in RANK_DEFINITIONS:
        if points >= int(rank["min_points"]):
            current_rank = rank
        else:
            next_rank = rank
            break

    return current_rank, next_rank


def _determine_account_status(internal_score: int) -> str:
    if internal_score <= STATUS_THRESHOLDS["banned"]:
        return "banned"
    if internal_score <= STATUS_THRESHOLDS["restricted"]:
        return "restricted"
    if internal_score <= STATUS_THRESHOLDS["warning"]:
        return "warning"
    return "active"


def _calculate_progress(points: int, current_rank: Dict[str, object], next_rank: Optional[Dict[str, object]]) -> float:
    if not next_rank:
        return 100.0

    span = int(next_rank["min_points"]) - int(current_rank["min_points"])
    if span <= 0:
        return 100.0

    earned = points - int(current_rank["min_points"])
    return round(min(100.0, max(0.0, earned / span * 100)), 2)


def get_rank_snapshot(user: User) -> Dict[str, object]:
    current_rank, next_rank = _determine_rank(user.points or 0)
    progress = _calculate_progress(user.points or 0, current_rank, next_rank)

    points_to_next = 0
    next_rank_name = None
    next_rank_points = None

    if next_rank:
        next_rank_points = int(next_rank["min_points"])
        next_rank_name = str(next_rank["name"])
        points_to_next = max(0, next_rank_points - (user.points or 0))

    status_message = STATUS_MESSAGES.get(user.account_status, STATUS_MESSAGES["active"])

    return {
        "rank": current_rank["name"],
        "rank_color": current_rank["badge_color"],
        "rank_description": current_rank["description"],
        "points": user.points or 0,
        "current_rank_floor": int(current_rank["min_points"]),
        "next_rank_name": next_rank_name,
        "next_rank_points": next_rank_points,
        "points_to_next_rank": points_to_next,
        "rank_progress_percentage": progress,
        "account_status": user.account_status,
        "internal_score": user.internal_score,
        "status_message": status_message,
    }


def _create_point_log(user: User, delta: int, event_type: str, reason: str, metadata: Optional[Dict[str, object]]) -> UserPointLog:
    return UserPointLog(
        user_id=user.id,
        delta=delta,
        event_type=event_type,
        reason=reason,
        context=metadata,
    )


def _apply_point_delta(
    db: Session,
    user: User,
    *,
    delta: int,
    event_type: str,
    reason: str,
    metadata: Optional[Dict[str, object]] = None,
    internal_score_delta: int = 0,
    allow_titles: bool = True,
) -> Optional[Dict[str, object]]:
    if delta == 0 and internal_score_delta == 0:
        return None

    user.points = max(0, (user.points or 0) + delta)
    user.internal_score = _clamp((user.internal_score or 0) + internal_score_delta, 0, 120)

    current_rank, _ = _determine_rank(user.points)
    user.rank = current_rank["name"]
    user.account_status = _determine_account_status(user.internal_score)

    log = _create_point_log(user, delta, event_type, reason, metadata)
    db.add(log)

    snapshot = get_rank_snapshot(user)
    snapshot.update({
        "delta": delta,
        "internal_score_delta": internal_score_delta,
    })

    newly_awarded = evaluate_new_titles(db, user) if allow_titles else []
    if newly_awarded:
        snapshot["new_titles"] = [serialize_title_record(title) for title in newly_awarded]
    return snapshot


def award_points(db: Session, user: User, event_type: str, metadata: Optional[Dict[str, object]] = None) -> Optional[Dict[str, object]]:
    rule = POINT_RULES.get(event_type)
    if not rule or not user:
        return None

    return _apply_point_delta(
        db,
        user,
        delta=int(rule["points"]),
        event_type=event_type,
        reason=str(rule["reason"]),
        metadata=metadata,
        internal_score_delta=int(rule.get("internal", 0)),
        allow_titles=True,
    )


def apply_penalty(
    db: Session,
    user: User,
    event_type: str,
    severity: str,
    *,
    metadata: Optional[Dict[str, object]] = None,
    override_reason: Optional[str] = None,
) -> Optional[Dict[str, object]]:
    penalties = PENALTY_RULES.get(event_type)
    if not penalties or not user:
        return None

    penalty_rule = penalties.get(severity) or penalties.get("default")
    if not penalty_rule:
        return None

    reason = override_reason or str(penalty_rule["reason"])

    return _apply_point_delta(
        db,
        user,
        delta=int(penalty_rule["points"]),
        event_type=event_type,
        reason=reason,
        metadata=metadata,
        internal_score_delta=int(penalty_rule.get("internal", 0)),
        allow_titles=False,
    )


def ensure_user_can_contribute(user: User) -> None:
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="認証が必要です",
        )

    if user.account_status == "banned":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="利用停止中のため操作できません",
        )

    if user.account_status == "restricted":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="コミュニティスコア低下により投稿が制限されています",
        )


def get_status_message(user: User) -> str:
    snapshot = get_rank_snapshot(user)
    status = snapshot["account_status"]
    message = STATUS_MESSAGES.get(status, STATUS_MESSAGES["active"])

    if status == "warning":
        diff = user.internal_score - STATUS_THRESHOLDS["restricted"]
        message += f"（あと{max(0, diff)}ポイントで制限が解除されます）"
    elif status == "restricted":
        diff = STATUS_THRESHOLDS["restricted"] - user.internal_score
        message += f"（コミュニティスコアを{diff + 1}ポイント以上回復させましょう）"

    return message
