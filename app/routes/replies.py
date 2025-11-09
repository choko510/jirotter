from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional

from database import get_db
from app.models import Reply, Post, User
from app.schemas import ReplyCreate, ReplyResponse
from app.utils.auth import get_current_active_user, get_current_user_optional
from app.utils.security import validate_reply_content
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
    """返信作成エンドポイント"""
    ensure_user_can_contribute(current_user)
    await rate_limiter.hit(f"reply:{current_user.id}", limit=20, window_seconds=60)
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")

    # 返信内容のバリデーションとサニタイズ
    errors, sanitized_content = validate_reply_content(reply_data.content)
    if errors:
        error_messages = []
        for field, message in errors.items():
            error_messages.append(message)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_messages[0] if error_messages else "返信内容に誤りがあります"
        )

    spam_result = spam_detector.evaluate_reply(db, current_user.id, sanitized_content, post_id)
    is_shadow_banned = spam_result.is_spam
    shadow_ban_reason = " / ".join(spam_result.reasons) if spam_result.reasons else None

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
