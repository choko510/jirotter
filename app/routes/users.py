import os

from fastapi import APIRouter, Depends, HTTPException, Query, status, UploadFile, File
from sqlalchemy.orm import Session
from typing import List

from database import get_db
from sqlalchemy import or_

from app.models import User, Follow, Post, Report
from app.schemas import UserProfileResponse, UserResponse, UserUpdate, UserRankingEntry
from app.utils.auth import get_current_user, get_current_user_optional
from app.utils.image_validation import validate_image_file
from app.utils.image_processor import process_profile_icon
from app.utils.scoring import reward_new_follower

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
    posts_count = db.query(Post.id).filter(Post.user_id == user.id).count()

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
        ranking_points=user.ranking_points,
        reputation_score=user.reputation_score,
        is_restricted=user.is_restricted,
        restricted_until=user.restricted_until,
        is_banned=user.is_banned,
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
        # ユーザー名の重複チェック
        existing_user = db.query(User).filter(User.username == user_update.username).first()
        if existing_user and existing_user.id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="このニックネームは既に使用されています"
            )
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
    posts_count = db.query(Post.id).filter(Post.user_id == current_user.id).count()

    return UserProfileResponse(
        id=current_user.id,
        username=current_user.username,
        email=current_user.email,
        created_at=current_user.created_at,
        bio=current_user.bio,
        profile_image_url=current_user.profile_image_url,
        ranking_points=current_user.ranking_points,
        reputation_score=current_user.reputation_score,
        is_restricted=current_user.is_restricted,
        restricted_until=current_user.restricted_until,
        is_banned=current_user.is_banned,
        followers_count=followers_count,
        following_count=following_count,
        posts_count=posts_count,
        is_following=False # 自分自身なので常にFalse
    )


@router.post("/users/me/icon", status_code=status.HTTP_200_OK)
async def upload_profile_icon(
    icon: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """プロフィールアイコンをアップロードして更新する"""

    validation = validate_image_file(icon)
    if not validation["is_valid"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=validation["error"]
        )

    icon.file.seek(0)
    icon_url = process_profile_icon(icon, current_user.id)
    if not icon_url:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="アイコンの処理に失敗しました"
        )

    previous_icon = current_user.profile_image_url
    current_user.profile_image_url = icon_url

    db.commit()
    db.refresh(current_user)

    if previous_icon and previous_icon != icon_url and previous_icon.startswith("/uploads/profile_icons/"):
        try:
            old_path = previous_icon.lstrip("/")
            if os.path.exists(old_path):
                os.remove(old_path)
        except Exception as exc:  # pragma: no cover - 失敗しても致命的ではない
            print(f"旧プロフィールアイコンの削除に失敗: {exc}")

    return {"profile_image_url": icon_url}

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

    try:
        reward_new_follower(db, user_to_follow)
        db.commit()
    except Exception as exc:
        db.rollback()
        print(f"フォロワー増加のスコア更新に失敗しました: {exc}")

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


@router.get("/users/ranking", response_model=List[UserRankingEntry])
async def get_user_ranking(
    limit: int = Query(20, ge=1, le=100, description="取得するユーザー数"),
    db: Session = Depends(get_db)
):
    """ランキング上位のユーザーを取得"""
    users = db.query(User).order_by(User.ranking_points.desc(), User.created_at.asc()).limit(limit).all()

    ranking: List[UserRankingEntry] = []
    for index, user in enumerate(users, start=1):
        ranking.append(UserRankingEntry(
            rank=index,
            id=user.id,
            username=user.username,
            profile_image_url=user.profile_image_url,
            ranking_points=user.ranking_points,
            reputation_score=user.reputation_score,
            is_banned=user.is_banned
        ))

    return ranking

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

@router.delete("/users/me", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user_account(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """認証済みユーザーのアカウントを削除する"""
    try:
        # ユーザーに関連するデータを削除
        db.query(Follow).filter(
            or_(
                Follow.follower_id == current_user.id,
                Follow.followed_id == current_user.id,
            )
        ).delete(synchronize_session=False)

        db.query(Report).filter(Report.reporter_id == current_user.id).delete(synchronize_session=False)

        # 投稿と関連データ、いいね、返信はリレーションのカスケード設定に任せる
        db.delete(current_user)

        db.commit()

    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="アカウントの削除に失敗しました"
        )