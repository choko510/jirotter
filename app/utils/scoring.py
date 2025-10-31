"""ユーザーのポイントおよび内部スコア管理ユーティリティ"""
from datetime import datetime, timedelta
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models import User

# ポイント付与の定数
CHECKIN_RANKING_POINTS = 10
CHECKIN_REPUTATION_BONUS = 2

WAIT_TIME_RANKING_POINTS = 6
WAIT_TIME_REPUTATION_BONUS = 3

NEW_FOLLOWER_RANKING_POINTS = 12
NEW_FOLLOWER_REPUTATION_BONUS = 4

IMAGE_POST_RANKING_POINTS = 8
IMAGE_POST_REPUTATION_BONUS = 2

# 違反時の減点
VIOLATION_RANKING_PENALTIES = {
    "low": -10,
    "medium": -20,
    "high": -35,
}

VIOLATION_REPUTATION_PENALTIES = {
    "low": -20,
    "medium": -35,
    "high": -60,
}

# 内部スコアの閾値
REPUTATION_MAX = 100
REPUTATION_MIN = 0
RESTRICTION_THRESHOLD = 40
BAN_THRESHOLD = 15
RESTRICTION_DURATION_DAYS = 7


def _clamp(value: int, minimum: int, maximum: int) -> int:
    return max(minimum, min(maximum, value))


def _apply_restriction_state(user: User) -> None:
    """内部スコアに応じてユーザーの制限状態を更新する"""
    score = user.reputation_score if user.reputation_score is not None else REPUTATION_MAX

    if score <= BAN_THRESHOLD:
        user.is_banned = True
        user.is_restricted = True
        user.restricted_until = None
        return

    if score <= RESTRICTION_THRESHOLD:
        if not user.is_restricted:
            user.is_restricted = True
            user.restricted_until = datetime.utcnow() + timedelta(days=RESTRICTION_DURATION_DAYS)
        return

    # 十分にスコアが回復している場合は制限を解除
    if not user.is_banned:
        user.is_restricted = False
        user.restricted_until = None


def update_user_scores(
    db: Session,
    user: User,
    ranking_delta: int = 0,
    reputation_delta: int = 0,
) -> None:
    """ユーザーのランキングポイントと内部スコアを更新する"""
    if ranking_delta:
        current_ranking = user.ranking_points or 0
        user.ranking_points = max(0, current_ranking + ranking_delta)

    if reputation_delta:
        current_reputation = user.reputation_score if user.reputation_score is not None else REPUTATION_MAX
        user.reputation_score = _clamp(current_reputation + reputation_delta, REPUTATION_MIN, REPUTATION_MAX)

    if user.reputation_score is None:
        user.reputation_score = REPUTATION_MAX

    _apply_restriction_state(user)
    db.add(user)


def ensure_user_can_post(user: User, db: Optional[Session] = None) -> None:
    """投稿系アクションを実行できるかチェックする"""
    if user.is_banned:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="アカウントが停止されています")

    if user.is_restricted:
        if user.restricted_until and user.restricted_until <= datetime.utcnow():
            user.is_restricted = False
            user.restricted_until = None
            if db is not None:
                db.add(user)
        else:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="現在アカウントに投稿制限がかかっています")


def reward_checkin(db: Session, user: User) -> None:
    update_user_scores(db, user, CHECKIN_RANKING_POINTS, CHECKIN_REPUTATION_BONUS)


def reward_wait_time_report(db: Session, user: User) -> None:
    update_user_scores(db, user, WAIT_TIME_RANKING_POINTS, WAIT_TIME_REPUTATION_BONUS)


def reward_new_follower(db: Session, user: User) -> None:
    update_user_scores(db, user, NEW_FOLLOWER_RANKING_POINTS, NEW_FOLLOWER_REPUTATION_BONUS)


def reward_image_post(db: Session, user: User) -> None:
    update_user_scores(db, user, IMAGE_POST_RANKING_POINTS, IMAGE_POST_REPUTATION_BONUS)


def apply_violation_penalty(db: Session, user: User, severity: str) -> None:
    ranking_delta = VIOLATION_RANKING_PENALTIES.get(severity, VIOLATION_RANKING_PENALTIES["medium"])
    reputation_delta = VIOLATION_REPUTATION_PENALTIES.get(severity, VIOLATION_REPUTATION_PENALTIES["medium"])
    update_user_scores(db, user, ranking_delta, reputation_delta)
