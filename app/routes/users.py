from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from database import get_db
from app.models import User, Follow
from app.schemas import UserProfileResponse, UserResponse, UserUpdate
from app.utils.auth import get_current_user, get_current_user_optional

router = APIRouter(tags=["users"])

@router.get("/users/{user_id}", response_model=UserProfileResponse)
async def get_user_profile(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_optional)
):
    """ユーザープロフィール取得エンドポイント"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="ユーザーが見つかりません"
        )

    followers_count = user.followers.count()
    following_count = user.following.count()
    posts_count = len(user.posts)

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
        bio=user.bio,
        profile_image_url=user.profile_image_url,
        followers_count=followers_count,
        following_count=following_count,
        posts_count=posts_count,
        is_following=is_following
    )

@router.put("/users/me", response_model=UserProfileResponse)
async def update_user_profile(
    user_update: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """認証済みユーザーのプロフィールを更新する"""
    if user_update.username is not None:
        current_user.username = user_update.username
    if user_update.bio is not None:
        current_user.bio = user_update.bio
    if user_update.profile_image_url is not None:
        current_user.profile_image_url = user_update.profile_image_url

    db.commit()
    db.refresh(current_user)

    # UserProfileResponseに必要な情報を再計算
    followers_count = current_user.followers.count()
    following_count = current_user.following.count()
    posts_count = len(current_user.posts)

    return UserProfileResponse(
        id=current_user.id,
        username=current_user.username,
        email=current_user.email,
        created_at=current_user.created_at,
        bio=current_user.bio,
        profile_image_url=current_user.profile_image_url,
        followers_count=followers_count,
        following_count=following_count,
        posts_count=posts_count,
        is_following=False # 自分自身なので常にFalse
    )

@router.post("/users/{user_id}/follow", status_code=status.HTTP_204_NO_CONTENT)
async def follow_user(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_optional)
):
    """ユーザーをフォローする"""
    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    user_to_follow = db.query(User).filter(User.id == user_id).first()
    if not user_to_follow:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if user_to_follow.id == current_user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You cannot follow yourself")

    follow = db.query(Follow).filter(
        Follow.follower_id == current_user.id,
        Follow.followed_id == user_to_follow.id
    ).first()

    if follow:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Already following")

    new_follow = Follow(follower_id=current_user.id, followed_id=user_to_follow.id)
    db.add(new_follow)
    db.commit()

@router.post("/users/{user_id}/unfollow", status_code=status.HTTP_204_NO_CONTENT)
async def unfollow_user(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_optional)
):
    """ユーザーのフォローを解除する"""
    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    user_to_unfollow = db.query(User).filter(User.id == user_id).first()
    if not user_to_unfollow:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    follow = db.query(Follow).filter(
        Follow.follower_id == current_user.id,
        Follow.followed_id == user_to_unfollow.id
    ).first()

    if not follow:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Not following")

    db.delete(follow)
    db.commit()

@router.get("/users/{user_id}/followers", response_model=List[UserResponse])
async def get_followers(user_id: str, db: Session = Depends(get_db)):
    """フォロワー一覧を取得する"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    followers = [UserResponse.model_validate(f.follower) for f in user.followers]
    return followers

@router.get("/users/{user_id}/following", response_model=List[UserResponse])
async def get_following(user_id: str, db: Session = Depends(get_db)):
    """フォロー中一覧を取得する"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    following = [UserResponse.model_validate(f.followed) for f in user.following]
    return following