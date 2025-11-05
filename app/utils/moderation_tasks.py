import asyncio
from contextlib import suppress
from datetime import datetime

from sqlalchemy.orm import Session, joinedload, sessionmaker

from app.models import Post, Report, User
from app.utils.content_moderator import content_moderator


async def _moderate_post(post_id: int, session_factory: sessionmaker) -> None:
    db = session_factory()
    try:
        post = (
            db.query(Post)
            .options(joinedload(Post.author))
            .filter(Post.id == post_id)
            .first()
        )
        if not post:
            return

        user_history = ""
        if post.author:
            # 直近の履歴を取得
            user_history = await content_moderator.get_user_history(db, post.author.id, limit=5)

        analysis = await content_moderator.analyze_content(
            post.content,
            reason="自動審査",
            user_history=user_history,
        )

        if analysis.get("is_violation") and analysis.get("confidence", 0) >= 0.75:
            reporter_id = post.author.id if post.author else "system"
            report = Report(
                post_id=post.id,
                reporter_id=reporter_id,
                reason="自動検出: AIによるガイドライン違反の可能性",
                description=analysis.get("reason", "AIがコンテンツを不適切と判断しました"),
            )
            db.add(report)

            offender: User | None = post.author
            if offender:
                offender.moderation_note = analysis.get("reason")
                offender.moderation_updated_at = datetime.utcnow()

            db.commit()
    except Exception as exc:  # noqa: BLE001
        print(f"自動モデレーション処理でエラーが発生しました: {exc}")
        db.rollback()
    finally:
        db.close()


async def schedule_post_moderation(post_id: int, db_session: Session) -> None:
    """イベントループ上で投稿の自動審査を非同期に実行する"""
    bind = db_session.get_bind()
    if bind is None:
        return

    session_factory = sessionmaker(autocommit=False, autoflush=False, bind=bind)

    try:
        asyncio.create_task(_moderate_post(post_id, session_factory))
    except RuntimeError:
        # テスト環境などでイベントループが存在しない場合は同期的に実行
        with suppress(Exception):
            asyncio.run(_moderate_post(post_id, session_factory))
