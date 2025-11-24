from __future__ import annotations

from datetime import datetime, timezone
from typing import Dict, List, Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import (
    Checkin,
    Follow,
    Post,
    User,
    UserPointLog,
    UserTitle,
    JST,
)


METRIC_LABELS: Dict[str, str] = {
    "points": "累計ポイント",
    "checkins": "チェックイン数",
    "waittime_reports": "待ち時間報告数",
    "image_posts": "写真投稿数",
    "video_posts": "動画投稿数",
    "posts": "投稿数",
    "followers": "フォロワー数",
    "contribution_actions": "総アクション数",
    "reviews": "総レビュー数",
}


TITLE_DEFINITIONS: List[Dict[str, object]] = [
    {
        "key": "first_checkin",
        "name": "スープの呼び声",
        "description": "最初の一杯を記録しました。ここからラーメンガイドの旅が始まります。",
        "category": "checkin",
        "icon": "📍",
        "theme_color": "#3B82F6",
        "criteria": {"checkins": 1},
        "progress_label": "チェックイン数",
        "prestige": 10,
    },
    {
        "key": "checkin_scout",
        "name": "全国汁統一計画",
        "description": "10店舗をチェックインして街のラーメン事情を熟知してきました。",
        "category": "checkin",
        "icon": "🧭",
        "theme_color": "#0EA5E9",
        "criteria": {"checkins": 10},
        "progress_label": "チェックイン数",
        "prestige": 40,
    },
    {
        "key": "waittime_guardian",
        "name": "行列観測者",
        "description": "待ち時間情報を5回共有し、混雑緩和に貢献しました。",
        "category": "community",
        "icon": "⏱️",
        "theme_color": "#8B5CF6",
        "criteria": {"waittime_reports": 5},
        "progress_label": "待ち時間の投稿数",
        "prestige": 45,
    },
    {
        "key": "photo_curator",
        "name": "盛りの化身",
        "description": "写真投稿を5回行い、魅力的な一杯を届けました。",
        "category": "creation",
        "icon": "📸",
        "theme_color": "#F59E0B",
        "criteria": {"image_posts": 5},
        "progress_label": "写真付き投稿数",
        "prestige": 35,
    },
    {
        "key": "video_storyteller",
        "name": "湯気のストーリーテラー",
        "description": "動画投稿を3回共有してライブ感を伝えました。",
        "category": "creation",
        "icon": "🎬",
        "theme_color": "#F97316",
        "criteria": {"video_posts": 3},
        "progress_label": "動画付き投稿数",
        "prestige": 50,
    },
    {
        "key": "ramen_columnist",
        "name": "味覚データベース・ジロ型",
        "description": "30件の投稿で味の体験を記録に残しました。",
        "category": "creation",
        "icon": "📝",
        "theme_color": "#10B981",
        "criteria": {"posts": 30},
        "progress_label": "投稿数",
        "prestige": 55,
    },
    {
        "key": "community_builder",
        "name": "教団形成済み",
        "description": "フォロワーが20人以上になり、仲間の輪を広げました。",
        "category": "community",
        "icon": "🤝",
        "theme_color": "#EC4899",
        "criteria": {"followers": 20},
        "progress_label": "フォロワー数",
        "prestige": 65,
    },
    {
        "key": "ramen_legend",
        "name": "ジロリアンとしての活動",
        "description": "累計ポイントが600ptに到達。あなたの活動が皆を導いています。",
        "category": "milestone",
        "icon": "🏆",
        "theme_color": "#FACC15",
        "criteria": {"points": 600},
        "progress_label": "累計ポイント",
        "prestige": 90,
    },
    {
        "key": "all_round_contributor",
        "name": "完全マシマシ行動派",
        "description": "チェックイン・投稿・待ち時間報告で50アクションを達成しました。",
        "category": "community",
        "icon": "🌐",
        "theme_color": "#14B8A6",
        "criteria": {"contribution_actions": 50},
        "progress_label": "総アクション数",
        "prestige": 70,
    },
    {
        "key": "reviewer_extraordinaire",
        "name": "レビューの達人",
        "description": "10店舗でレビューを達成しました。",
        "category": "community",
        "icon": "📝",
        "theme_color": "#14B822",
        "criteria": {"reviews": 10},
        "progress_label": "総レビュー数",
        "prestige": 70,
    },
]


def _build_user_metrics(db: Session, user: User) -> Dict[str, int]:
    """ユーザーの行動統計を集計する"""
    user_id = user.id

    checkins = db.query(func.count(Checkin.id)).filter(Checkin.user_id == user_id).scalar() or 0
    posts = db.query(func.count(Post.id)).filter(Post.user_id == user_id).scalar() or 0
    followers = db.query(func.count(Follow.follower_id)).filter(Follow.followed_id == user_id).scalar() or 0

    waittime_reports = (
        db.query(func.count(UserPointLog.id))
        .filter(UserPointLog.user_id == user_id, UserPointLog.event_type == "waittime_report")
        .scalar()
        or 0
    )
    image_posts = (
        db.query(func.count(UserPointLog.id))
        .filter(UserPointLog.user_id == user_id, UserPointLog.event_type == "image_post")
        .scalar()
        or 0
    )
    video_posts = (
        db.query(func.count(UserPointLog.id))
        .filter(UserPointLog.user_id == user_id, UserPointLog.event_type == "video_post")
        .scalar()
        or 0
    )

    contribution_actions = checkins + posts + waittime_reports

    # レビュー数: UserPointLog 等ではなく Review モデル側で管理されている想定
    # 「10店舗でレビューを達成」の達成条件評価のため、レビュー合計数を集計する。
    # Review モデルが存在しない環境ではインポートエラーとなるため、その場合は 0 として扱う。
    try:
        from app.models import Review  # 遅延インポートで循環依存を回避
    except ImportError:  # pragma: no cover - Review 未導入環境向けフォールバック
        reviews = 0
    else:
        reviews = (
            db.query(func.count(Review.id))
            .filter(Review.user_id == user_id)
            .scalar()
            or 0
        )

    return {
        "points": user.points or 0,
        "checkins": int(checkins),
        "posts": int(posts),
        "followers": int(followers),
        "waittime_reports": int(waittime_reports),
        "image_posts": int(image_posts),
        "video_posts": int(video_posts),
        "contribution_actions": int(contribution_actions),
        "reviews": int(reviews),
    }


def _meets_criteria(criteria: Dict[str, int], metrics: Dict[str, int]) -> bool:
    for metric, target in criteria.items():
        if metrics.get(metric, 0) < int(target):
            return False
    return True


def _calculate_progress(criteria: Dict[str, int], metrics: Dict[str, int]) -> float:
    if not criteria:
        return 100.0

    ratios: List[float] = []
    for metric, target in criteria.items():
        required = max(1, int(target))
        current = metrics.get(metric, 0)
        ratios.append(current / required if required else 1.0)

    if not ratios:
        return 100.0

    progress = min(ratios)
    return round(max(0.0, min(1.0, progress)) * 100, 1)


def _build_requirements(criteria: Dict[str, int], metrics: Dict[str, int]) -> List[Dict[str, object]]:
    requirements: List[Dict[str, object]] = []
    for metric, target in criteria.items():
        requirements.append(
            {
                "metric": metric,
                "label": METRIC_LABELS.get(metric, metric),
                "current": metrics.get(metric, 0),
                "required": int(target),
            }
        )
    return requirements


def _progress_label_for(requirements: List[Dict[str, object]]) -> str:
    if not requirements:
        return "達成率"
    if len(requirements) == 1:
        return str(requirements[0]["label"])
    return "複数条件の達成率"


def evaluate_new_titles(db: Session, user: User) -> List[UserTitle]:
    """現在の行動に基づき新しく獲得した称号を付与する"""
    existing_keys = {title.title_key for title in user.titles}
    metrics = _build_user_metrics(db, user)
    newly_awarded: List[UserTitle] = []

    for definition in TITLE_DEFINITIONS:
        key = str(definition["key"])
        if key in existing_keys:
            continue
        criteria = definition.get("criteria", {})
        if not isinstance(criteria, dict):
            continue

        if _meets_criteria(criteria, metrics):
            title = UserTitle(
                user_id=user.id,
                title_key=key,
                title_name=str(definition.get("name", key)),
                title_description=str(definition.get("description", "")),
                category=str(definition.get("category", "general")),
                icon=definition.get("icon"),
                theme_color=str(definition.get("theme_color", "#f97316")),
                prestige=int(definition.get("prestige", 0)),
                earned_at=datetime.now(JST),
            )
            user.titles.append(title)
            db.add(title)
            newly_awarded.append(title)
            existing_keys.add(key)

    return newly_awarded


def serialize_title_record(title: UserTitle) -> Dict[str, object]:
    return {
        "key": title.title_key,
        "name": title.title_name,
        "description": title.title_description,
        "category": title.category,
        "icon": title.icon,
        "theme_color": title.theme_color,
        "prestige": title.prestige,
        "earned_at": title.earned_at,
    }


def get_user_titles_summary(db: Session, user: User) -> List[Dict[str, object]]:
    metrics = _build_user_metrics(db, user)
    existing = {title.title_key: title for title in user.titles}

    summaries: List[Dict[str, object]] = []
    for definition in TITLE_DEFINITIONS:
        key = str(definition["key"])
        criteria = definition.get("criteria", {})
        requirements = _build_requirements(criteria, metrics)
        record = existing.get(key)

        entry = {
            "key": key,
            "name": str(definition.get("name", key)),
            "description": str(definition.get("description", "")),
            "category": str(definition.get("category", "general")),
            "icon": definition.get("icon"),
            "theme_color": str(definition.get("theme_color", "#f97316")),
            "prestige": int(definition.get("prestige", 0)),
            "requirements": requirements,
            "progress": 100.0 if record else _calculate_progress(criteria, metrics),
            "progress_label": str(definition.get("progress_label", _progress_label_for(requirements))),
            "unlocked": record is not None,
            "earned_at": record.earned_at if record else None,
        }

        if record:
            entry.update(
                {
                    "name": record.title_name,
                    "description": record.title_description,
                    "category": record.category,
                    "icon": record.icon,
                    "theme_color": record.theme_color,
                    "prestige": record.prestige,
                }
            )

        summaries.append(entry)

    summaries.sort(
        key=lambda item: (
            0 if item["unlocked"] else 1,
            -int(item.get("prestige", 0)),
            item.get("earned_at") or datetime.max,
        )
    )
    return summaries


def select_featured_title(summary: List[Dict[str, object]]) -> Optional[Dict[str, object]]:
    unlocked = [entry for entry in summary if entry.get("unlocked")]
    if not unlocked:
        return None
    return max(
        unlocked,
        key=lambda item: (
            int(item.get("prestige", 0)),
            item.get("earned_at") or datetime.min,
        ),
    )


def serialize_title_brief(entry: Optional[Dict[str, object]]) -> Optional[Dict[str, object]]:
    if not entry:
        return None
    return {
        "key": entry.get("key"),
        "name": entry.get("name"),
        "description": entry.get("description"),
        "icon": entry.get("icon"),
        "theme_color": entry.get("theme_color"),
        "earned_at": entry.get("earned_at"),
        "prestige": entry.get("prestige", 0),
    }


def get_recent_titles(user: User, limit: int = 3) -> List[Dict[str, object]]:
    titles = sorted(user.titles, key=lambda t: (t.prestige, t.earned_at), reverse=True)
    return [serialize_title_record(title) for title in titles[:limit]]


def build_default_title_catalog() -> List[Dict[str, object]]:
    """未ログインユーザー向けに称号一覧を返す"""
    zero_metrics: Dict[str, int] = {}
    catalog: List[Dict[str, object]] = []

    for definition in TITLE_DEFINITIONS:
        criteria = definition.get("criteria", {})
        requirements = _build_requirements(criteria, zero_metrics)

        catalog.append(
            {
                "key": str(definition.get("key")),
                "name": str(definition.get("name", definition.get("key"))),
                "description": str(definition.get("description", "")),
                "category": str(definition.get("category", "general")),
                "icon": definition.get("icon"),
                "theme_color": str(definition.get("theme_color", "#f97316")),
                "prestige": int(definition.get("prestige", 0)),
                "unlocked": False,
                "earned_at": None,
                "progress": 0.0,
                "progress_label": str(definition.get("progress_label", _progress_label_for(requirements))),
                "requirements": requirements,
            }
        )

    catalog.sort(
        key=lambda item: (
            -int(item.get("prestige", 0)),
            item.get("name") or item.get("key"),
        )
    )
    return catalog
