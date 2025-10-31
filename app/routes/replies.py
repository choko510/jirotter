from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from database import get_db
from app.models import Reply, Post, User
from app.schemas import ReplyCreate, ReplyResponse
from app.utils.auth import get_current_active_user
from app.utils.security import validate_reply_content, escape_html
from app.utils.scoring import ensure_user_can_contribute

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

    reply = Reply(
        content=sanitized_content,
        user_id=current_user.id,
        post_id=post_id
    )
    db.add(reply)
    db.commit()
    db.refresh(reply)
    return reply

@router.get("/posts/{post_id}/replies", response_model=List[ReplyResponse])
async def get_replies_for_post(post_id: int, db: Session = Depends(get_db)):
    """返信一覧取得エンドポイント"""
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")

    return post.replies