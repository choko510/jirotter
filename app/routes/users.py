from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from database import get_db
from app.models import User, Follow, Post
from app.schemas import UserProfileResponse
from app.utils.auth import get_current_user_optional, get_current_active_user

router = APIRouter(tags=["users"])

def get_user_or_404(db: Session, user_id: str) -> User:
    """指定されたIDのユーザーを取得します。見つからない場合は404エラーを発生させます。"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="ユーザーが見つかりません"
        )
    return user

@router.get("/users/{user_id}", response_model=UserProfileResponse)
async def get_user_profile(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_optional)
):
    """
    指定されたユーザーのプロフィール情報を取得します。
    """
    user = get_user_or_404(db, user_id)

    followers_count = user.followers.count()
    following_count = user.following.count()
    posts_count = db.query(func.count(Post.id)).filter(Post.user_id == user.id).scalar()

    is_following = False
    if current_user:
        is_following = db.query(Follow).filter(
            Follow.follower_id == current_user.id,
            Follow.followed_id == user.id
        ).first() is not None

    return UserProfileResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        created_at=user.created_at,
        followers_count=followers_count,
        following_count=following_count,
        posts_count=posts_count,
        is_following=is_following
    )

@router.post("/users/{user_id}/follow", status_code=status.HTTP_204_NO_CONTENT)
async def follow_user(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    指定されたユーザーをフォローします。
    自分自身をフォロー、または既にフォロー済みの場合はエラーとなります。
    """
    user_to_follow = get_user_or_404(db, user_id)

    if user_to_follow.id == current_user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="自分自身をフォローすることはできません")

    follow = db.query(Follow).filter(
        Follow.follower_id == current_user.id,
        Follow.followed_id == user_to_follow.id
    ).first()

    if follow:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="すでにフォローしています")

    new_follow = Follow(follower_id=current_user.id, followed_id=user_to_follow.id)
    db.add(new_follow)
    db.commit()
    return None

@router.post("/users/{user_id}/unfollow", status_code=status.HTTP_204_NO_CONTENT)
async def unfollow_user(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    指定されたユーザーのフォローを解除します。
    """
    user_to_unfollow = get_user_or_404(db, user_id)

    follow = db.query(Follow).filter(
        Follow.follower_id == current_user.id,
        Follow.followed_id == user_to_unfollow.id
    ).first()

    if not follow:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="まだフォローしていません")

    db.delete(follow)
    db.commit()
    return None