from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
from app.models import Post, Like, User
from app.schemas import LikeResponse
from app.utils.auth import get_current_active_user

router = APIRouter(tags=["likes"])

@router.post("/posts/{post_id}/like", response_model=LikeResponse, status_code=status.HTTP_201_CREATED)
async def like_post(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """いいね作成エンドポイント"""
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")

    like = db.query(Like).filter(Like.post_id == post_id, Like.user_id == current_user.id).first()
    if like:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Post already liked")

    like = Like(user_id=current_user.id, post_id=post_id)
    db.add(like)
    db.commit()
    db.refresh(like)
    return like

@router.delete("/posts/{post_id}/like", status_code=status.HTTP_204_NO_CONTENT)
async def unlike_post(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """いいね削除エンドポイント"""
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")

    like = db.query(Like).filter(Like.post_id == post_id, Like.user_id == current_user.id).first()
    if not like:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Post not liked")

    db.delete(like)
    db.commit()