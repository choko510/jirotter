from __future__ import annotations

from datetime import datetime, timezone
from typing import Dict, Optional, Tuple

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models import User, UserPointLog, JST
from app.utils.achievements import evaluate_new_titles, serialize_title_record


RANK_DEFINITIONS = [
    
    {
        "name": "啜りし者",
        "min_points": 0,
        "badge_color": "#9CA3AF",
        "description": "初めての一杯を記録し始めた初心者。すべてはここから始まる。"
    },
    {
        "name": "スープの底を覗く者",
        "min_points": 150,
        "badge_color": "#60A5FA",
        "description": "街の人気店を巡り、スープの深淵を覗き始めた探求者。"
    },
    {
        "name": "天地返し中毒者",
        "min_points": 300,
        "badge_color": "#FBBF24",
        "description": "天地返しの快感に取り憑かれ、麺とスープを一体化させる者"
    },
    {
        "name": "呪文詠唱 ニンニクヤサイアブラ",
        "min_points": 500,
        "badge_color": "#C084FC",
        "description": "唱えれば己を覚醒させる禁断のコールを会得した者"
    },
    {
        "name": "真のジロリアン",
        "min_points": 1000,
        "badge_color": "#34D399",
        "description": "味、量、雰囲気…二郎の全てを理解した者"
    },
    {
        "name": "人類ジロリアン化計画",
        "min_points": 2000,
        "badge_color": "#F59E0B",
        "description": "新しいジロリアンを生むための研究員の一員"
    },
    {
        "name": "人間やめますか",
        "min_points": 5000,
        "badge_color": "#F97316",
        "description": "常識を捨て、二郎と共に生きることを選んだ伝説のジロリアン"
    },
    {
        "name": "私は完璧で究極のジロリアン",
        "min_points": 10000,
        "badge_color": "#EF4444",
        "description": "すべてのジロリアンを見守る、神の領域に到達した究極の存在。"
    },
    {
        "name": "二郎の歴史を刻むもの",
        "min_points": 20000,
        "badge_color": "#0044FF",
        "description": "その名を聞くだけで列が伸びる。二郎界の頂点に最も近い者。"
    },
    {
        "name": "万象を二郎へ帰す者",
        "min_points": 30000,
        "badge_color": "#F43F5E",
        "description": "食・文化・哲学・雑踏……この世界に存在する万物を、二郎という一つの原理に還元して捉える域へ到達した者。その視点はすでに人間では理解し得ない、万象帰一の境地。"
    },
    {
        "name": "二郎法則の外側に立つ者",
        "min_points": 40000,
        "badge_color": "#7F1D1D",
        "description": "二郎を生む宇宙すら、その法則すら、この存在の前では一つの揺らぎにすぎない。原初を超え、創造を超え、因果の外側から二郎という現象そのものを“観測”する唯一の存在。ジロリアンという概念を超え、二郎という体系を超え、あらゆる物語の外側に立つ終極点。"
    },
    {
        "name": "二郎法則の外側に立つ者",
        "min_points": 50000,
        "badge_color": "#A306FE",
        "description": "二郎を生む宇宙すら、その法則すら、この存在の前では一つの揺らぎにすぎない。原初を超え、創造を超え、因果の外側から二郎という現象そのものを“観測”する唯一の存在。ジロリアンという概念を超え、二郎という体系を超え、あらゆる物語の外側に立つ終極点。"
    },
]


POINT_RULES: Dict[str, Dict[str, object]] = {
    "checkin": {"points": 15, "internal": 1, "reason": "チェックインボーナス"},
    "waittime_report": {"points": 12, "internal": 2, "reason": "待ち時間の共有"},
    "image_post": {"points": 18, "internal": 1, "reason": "写真付き投稿"},
    "video_post": {"points": 22, "internal": 2, "reason": "動画付き投稿"},
    "new_follower": {"points": 20, "internal": 1, "reason": "フォロワー獲得"},
    "shop_submission_approved": {"points": 28, "internal": 3, "reason": "店舗情報の改善"},
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
    "banned": "利用規約違反によりアカウントが停止されています。",
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


def compute_effective_account_status(user: User, now: Optional[datetime] = None) -> str:
    """手動設定や期限付きの制限を考慮してアカウント状態を算出する
    全体仕様に合わせて JST (Asia/Tokyo) 前提で評価する。
    """
    now = now or datetime.now(JST)
    
    # 前回の状態を保存
    previous_status = getattr(user, '_previous_account_status', None)
    current_status = None

    if user.account_status_override:
        current_status = user.account_status_override
    elif user.ban_expires_at:
        if user.ban_expires_at > now:
            current_status = "banned"
        else:
            user.ban_expires_at = None
            current_status = _determine_account_status(user.internal_score or 0)
    elif user.posting_restriction_expires_at:
        if user.posting_restriction_expires_at > now:
            current_status = "restricted"
        else:
            user.posting_restriction_expires_at = None
            current_status = _determine_account_status(user.internal_score or 0)
    else:
        current_status = _determine_account_status(user.internal_score or 0)
    
    # 状態がbanに変更された場合、全投稿を削除
    if previous_status != "banned" and current_status == "banned":
        from app.utils.content_moderator import content_moderator
        from database import get_db
        
        # 非同期で投稿削除を実行（現在のDBセッションを使用）
        try:
            db = get_db()
            import asyncio
            loop = asyncio.get_event_loop()
            if loop.is_running():
                # イベントループが既に実行中の場合はタスクとしてスケジュール
                asyncio.create_task(content_moderator.delete_all_user_posts_on_ban(db, user.id))
            else:
                # イベントループが実行中でない場合は直接実行
                loop.run_until_complete(content_moderator.delete_all_user_posts_on_ban(db, user.id))
            print(f"ユーザー {user.id} がbanされたため、全投稿の削除をスケジュールしました")
        except Exception as e:
            print(f"ban時の投稿削除に失敗しました: {str(e)}")
    
    # 現在の状態を保存
    user._previous_account_status = current_status
    
    return current_status


def update_user_account_status(user: User, now: Optional[datetime] = None) -> str:
    """ユーザーのaccount_statusフィールドを最新化する"""
    status = compute_effective_account_status(user, now=now)
    user.account_status = status
    return status


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

    effective_status = update_user_account_status(user)
    status_message = STATUS_MESSAGES.get(effective_status, STATUS_MESSAGES["active"])

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
        "account_status": effective_status,
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
    update_user_account_status(user)

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

    now = datetime.now(JST)
    status_value = compute_effective_account_status(user, now=now)

    if status_value == "banned":
        message = "利用停止中のため操作できません"
        if user.ban_expires_at and user.ban_expires_at > now:
            message += f"（{user.ban_expires_at.isoformat()}まで）"
        elif user.account_status_override == "banned":
            message += "（管理者による停止）"
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=message,
        )

    if status_value == "restricted":
        message = "投稿・チェックインが制限されています"
        if user.posting_restriction_expires_at and user.posting_restriction_expires_at > now:
            message += f"（{user.posting_restriction_expires_at.isoformat()}まで）"
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=message,
        )


def get_status_message(user: User) -> str:
    snapshot = get_rank_snapshot(user)
    status = snapshot["account_status"]
    message = STATUS_MESSAGES.get(status, STATUS_MESSAGES["active"])
    now = datetime.now(JST)

    if status == "warning":
        diff = user.internal_score - STATUS_THRESHOLDS["restricted"]
        message += f"（あと{max(0, diff)}ポイントで制限が解除されます）"
    elif status == "restricted":
        if user.posting_restriction_expires_at and user.posting_restriction_expires_at > now:
            message += f"（{user.posting_restriction_expires_at.isoformat()}まで）"
        else:
            diff = STATUS_THRESHOLDS["restricted"] - user.internal_score
            message += f"（コミュニティスコアを{diff + 1}ポイント以上回復させましょう）"
    elif status == "banned" and user.ban_expires_at and user.ban_expires_at > now:
        message += f"（{user.ban_expires_at.isoformat()}まで）"

    return message
