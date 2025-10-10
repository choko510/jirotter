from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from database import get_db
from app.models import Reply, Post, User
from app.schemas import ReplyCreate, ReplyResponse
from app.utils.auth import get_current_active_user

router = APIRouter(tags=["replies"])

@router.post("/posts/{post_id}/replies", response_model=ReplyResponse, status_code=status.HTTP_201_CREATED)
async def create_reply_for_post(
    post_id: int,
    reply_data: ReplyCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """返信作成エンドポイント"""
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")

    reply = Reply(**reply_data.model_dump(), user_id=current_user.id, post_id=post_id)
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