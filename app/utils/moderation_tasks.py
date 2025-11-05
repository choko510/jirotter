import asyncio
from contextlib import suppress
from datetime import datetime

from sqlalchemy.orm import Session, joinedload, sessionmaker

from app.models import Post, Report, User
from app.utils.content_moderator import content_moderator
from app.utils.scoring import apply_penalty


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

        # 多段階のモデレーション判定
        user_history = ""
        should_moderate = False
        moderation_level = "none"
        
        if post.author:
            # 直近の履歴を取得
            user_history = await content_moderator.get_user_history(db, post.author.id, limit=5)
            
            # 1. internal_scoreが70以下の場合は高優先度審査
            if (post.author.internal_score or 100) <= 70:
                should_moderate = True
                moderation_level = "high"
                print(f"ユーザーID {post.author.id} は低スコア(internal_score: {post.author.internal_score})のため高優先度審査対象")
            
            # 2. スパム判定された投稿は高優先度審査
            elif post.is_shadow_banned:
                should_moderate = True
                moderation_level = "high"
                print(f"投稿ID {post_id} はスパム判定されているため高優先度審査対象")
            
            # 3. spam_detectorスコアに基づく細分化審査
            elif hasattr(post, 'spam_score') and post.spam_score:
                if post.spam_score >= 3.5:  # 高スコア：高優先度審査
                    should_moderate = True
                    moderation_level = "high"
                    print(f"投稿ID {post_id} は高スパムスコア(spam_score: {post.spam_score})のため高優先度審査対象")
                elif post.spam_score >= 2.5:  # 中スコア：中優先度審査
                    should_moderate = True
                    moderation_level = "medium"
                    print(f"投稿ID {post_id} は中スパムスコア(spam_score: {post.spam_score})のため中優先度審査対象")
                elif post.spam_score >= 1.5:  # 低スコア：低優先度審査
                    should_moderate = True
                    moderation_level = "low"
                    print(f"投稿ID {post_id} は低スパムスコア(spam_score: {post.spam_score})のため低優先度審査対象")
        
        if not should_moderate:
            print(f"投稿ID {post_id} は審査対象外のためスキップします")
            return

        # モデレーションレベルに応じたAI分析設定
        if moderation_level == "high":
            temperature = 0.2
            confidence_threshold = 0.7
        elif moderation_level == "medium":
            temperature = 0.25
            confidence_threshold = 0.75
        else:  # low
            temperature = 0.3
            confidence_threshold = 0.8
        
        analysis = await content_moderator.analyze_content(
            post.content,
            reason=f"自動審査 ({moderation_level})",
            user_history=user_history,
        )

        if analysis.get("is_violation") and analysis.get("confidence", 0) >= confidence_threshold:
            print(f"投稿ID {post_id} を違反と判断し、投稿を削除します...")
            try:
                # ペナルティを適用
                offender: User | None = post.author
                if offender:
                    print(f"ユーザー {offender.id} にペナルティを適用します")
                    apply_penalty(
                        db,
                        offender,
                        "content_violation",
                        analysis.get("severity", "medium") or "medium",
                        metadata={
                            "post_id": post_id,
                            "moderation_level": moderation_level,
                        },
                        override_reason=analysis.get("reason"),
                    )

                # 関連する通報レコードを先に削除
                reports = db.query(Report).filter(Report.post_id == post_id).all()
                for report in reports:
                    db.delete(report)
                print(f"{len(reports)}件の関連通報レコードを削除しました")

                # 投稿を削除
                db.delete(post)
                print(f"投稿ID {post_id} を削除しました")
                
                db.commit()
                print(f"投稿ID {post_id} の削除が完了しました (レベル: {moderation_level})")
            except Exception as e:
                db.rollback()
                print(f"投稿ID {post_id} の削除に失敗しました: {str(e)}")
        else:
            db.commit()  # 適切と判断された場合もcommitを呼ぶ
            print(f"投稿ID {post_id} は適切と判断されました (レベル: {moderation_level})")
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