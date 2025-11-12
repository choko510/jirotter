from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional

from database import get_db
from app.models import Reply, Post, User
from app.schemas import ReplyCreate, ReplyResponse
from app.utils.auth import get_current_active_user, get_current_user_optional
from app.utils.security import validate_reply_content, escape_html
from app.utils.scoring import ensure_user_can_contribute
from app.utils.rate_limiter import rate_limiter
from app.utils.spam_detector import spam_detector

router = APIRouter(tags=["replies"])

@router.post("/posts/{post_id}/replies", response_model=ReplyResponse, status_code=status.HTTP_201_CREATED)
async def create_reply_for_post(
    post_id: int,
    reply_data: ReplyCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """返信作成エンドポイント

    NOTE:
    - 投稿(create_post)では app.utils.moderation_tasks.schedule_post_moderation() による
      非同期AIモデレーションを行っている。
    - 返信も同様にAIモデレーション対象とするため、ここでコンテンツモデレータを呼び出し、
      違反と高信頼度で判断された場合はシャドウバンではなく即座に違反扱いとして保存しない。
    """
    ensure_user_can_contribute(current_user)
    await rate_limiter.hit(f"reply:{current_user.id}", limit=20, window_seconds=60)

    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")

    # 返信内容のバリデーションとサニタイズ
    errors, sanitized_content = validate_reply_content(reply_data.content)
    if errors:
        error_messages = [message for _, message in errors.items()]
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_messages[0] if error_messages else "返信内容に誤りがあります"
        )

    # スパム検知（従来どおり）
    spam_result = spam_detector.evaluate_reply(db, current_user.id, sanitized_content, post_id)
    is_shadow_banned = spam_result.is_spam
    shadow_ban_reason = " / ".join(spam_result.reasons) if spam_result.reasons else None

    # Geminiモデレーションによる追加チェック
    # - APIキー未設定 or エラー時は is_violation=False で返る実装なので安全側に倒れる
    from app.utils.content_moderator import content_moderator

    try:
        analysis = await content_moderator.analyze_content(
            sanitized_content,
            reason="reply_creation",
            user_history=""
        )
    except Exception:
        analysis = {"is_violation": False, "confidence": 0.0}

    if analysis.get("is_violation") and analysis.get("confidence", 0) >= 0.7:
        # 明確な違反コンテンツと判断された場合は保存せずエラーとして返す
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="コミュニティガイドラインに違反する可能性が高いため、返信を投稿できません"
        )

    reply = Reply(
        content=sanitized_content,
        user_id=current_user.id,
        post_id=post_id,
        is_shadow_banned=is_shadow_banned,
        shadow_ban_reason=shadow_ban_reason
    )

    db.add(reply)
    db.commit()
    db.refresh(reply)
    return reply

@router.get("/posts/{post_id}/replies", response_model=List[ReplyResponse])
async def get_replies_for_post(
    post_id: int,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """返信一覧取得エンドポイント"""
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")

    visible_replies = [
        reply
        for reply in post.replies
        if not reply.is_shadow_banned
        or (current_user and reply.user_id == current_user.id)
    ]

    return visible_replies


@router.delete("/replies/{reply_id}", response_model=dict)
async def delete_reply(
    reply_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    返信削除エンドポイント
    - ログインユーザー本人が作成した返信のみ削除可能
    - （将来拡張用に）管理者は任意の返信を削除できるよう考慮
    """
    reply = db.query(Reply).filter(Reply.id == reply_id).first()
    if not reply:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Reply not found",
        )

    is_admin = getattr(current_user, "is_admin", False)
    if reply.user_id != current_user.id and not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="この返信を削除する権限がありません",
        )

    try:
        db.delete(reply)
        db.commit()
        return {"message": "返信を削除しました"}
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="返信の削除に失敗しました",
        )
