from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc
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
    """
    指定された投稿に新しい返信を作成します。
    """
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="投稿が見つかりません")

    reply = Reply(**reply_data.model_dump(), user_id=current_user.id, post_id=post_id)
    db.add(reply)
    db.commit()
    db.refresh(reply)
    return reply

@router.get("/posts/{post_id}/replies", response_model=List[ReplyResponse])
async def get_replies_for_post(post_id: int, db: Session = Depends(get_db)):
    """
    指定された投稿の返信一覧を取得します。
    パフォーマンス向上のため、返信者情報を事前に読み込みます。
    """
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="投稿が見つかりません")

    replies = db.query(Reply).filter(Reply.post_id == post_id).options(
        joinedload(Reply.author)
    ).order_by(desc(Reply.created_at)).all()

    return replies

@router.delete("/replies/{reply_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_reply(
    reply_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    指定されたIDの返信を削除します。
    返信者本人のみが削除可能です。
    """
    reply = db.query(Reply).filter(Reply.id == reply_id).first()
    if not reply:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="返信が見つかりません")

    if reply.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="この返信を削除する権限がありません")

    db.delete(reply)
    db.commit()
    return None