import os
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy.orm import Session

from database import get_db
from sqlalchemy import and_, func, or_

from app.models import Follow, Post, Report, User
from app.schemas import (
    UserProfileResponse,
    UserRankingEntry,
    UserRankingResponse,
    UserResponse,
    UserTitleSummary,
    UserUpdate,
)
from app.utils.auth import get_current_user, get_current_user_optional
from app.utils.image_processor import process_profile_icon
from app.utils.image_validation import validate_image_file
from app.utils.achievements import (
    build_default_title_catalog,
    get_recent_titles,
    get_user_titles_summary,
    select_featured_title,
    serialize_title_brief,
)
from app.utils.scoring import award_points, get_rank_snapshot, get_status_message

router = APIRouter(tags=["users"])


def _build_ranking_entry(db: Session, user: User, position: int) -> UserRankingEntry:
    rank_snapshot = get_rank_snapshot(user)
    titles_summary = get_user_titles_summary(db, user)
    featured_entry = select_featured_title(titles_summary)
    featured_title = serialize_title_brief(featured_entry)
    recent_titles = [
        brief
        for brief in (
            serialize_title_brief(record)
            for record in get_recent_titles(user, limit=3)
        )
        if brief is not None
    ]

    followers_count = user.followers.count() if hasattr(user.followers, "count") else 0

    return UserRankingEntry(
        id=user.id,
        username=user.username,
        profile_image_url=user.profile_image_url,
        points=rank_snapshot["points"],
        rank=rank_snapshot["rank"],
        rank_color=rank_snapshot["rank_color"],
        rank_description=rank_snapshot["rank_description"],
        position=position,
        rank_progress_percentage=rank_snapshot["rank_progress_percentage"],
        next_rank_name=rank_snapshot.get("next_rank_name"),
        points_to_next_rank=rank_snapshot.get("points_to_next_rank"),
        followers_count=followers_count,
        total_titles=sum(1 for entry in titles_summary if entry.get("unlocked")),
        featured_title=featured_title,
        recent_titles=recent_titles,
    )

@router.get("/users/rankings", response_model=UserRankingResponse)
async def get_user_rankings(
    limit: int = Query(20, ge=1, le=100, description="ランキング上位の取得件数"),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """ユーザーランキングと称号カタログを取得する"""
    top_users = (
        db.query(User)
        .order_by(User.points.desc(), User.created_at.asc())
        .limit(limit)
        .all()
    )

    top_entries = [
        _build_ranking_entry(db, user, index)
        for index, user in enumerate(top_users, start=1)
    ]

    total_users = db.query(func.count(User.id)).scalar() or 0

    you_entry = None
    if current_user:
        you_entry = next((entry for entry in top_entries if entry.id == current_user.id), None)
        if you_entry is None:
            current_points = current_user.points or 0
            higher_points = db.query(func.count(User.id)).filter(User.points > current_points).scalar() or 0
            same_points_earlier = (
                db.query(func.count(User.id))
                .filter(
                    User.points == current_points,
                    User.created_at < current_user.created_at,
                    User.id != current_user.id,
                )
                .scalar()
                or 0
            )
            position = int(higher_points + same_points_earlier + 1)
            you_entry = _build_ranking_entry(db, current_user, position)

    if current_user:
        title_catalog = get_user_titles_summary(db, current_user)
    else:
        title_catalog = build_default_title_catalog()

    return UserRankingResponse(
        top_users=top_entries,
        you=you_entry,
        total_users=int(total_users),
        last_updated=datetime.now(timezone.utc),
        title_catalog=title_catalog,
    )


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
    rank_snapshot = get_rank_snapshot(user)
    status_message = get_status_message(user)
    titles_summary = get_user_titles_summary(db, user)
    featured_entry = select_featured_title(titles_summary)
    featured_title = serialize_title_brief(featured_entry)

    is_following = False
    if current_user:
        is_following = db.query(Follow).filter(
            Follow.follower_id == current_user.id,
            Follow.followed_id == user.id
        ).first() is not None

    display_name = user.username if user.username else user.id
    return UserProfileResponse(
        id=user.id,
        username=display_name,
        email=user.email,
        created_at=user.created_at,
        bio=user.bio,
        profile_image_url=user.profile_image_url,
        points=user.points,
        rank=user.rank,
        internal_score=user.internal_score,
        account_status=user.account_status,
        rank_color=rank_snapshot["rank_color"],
        rank_description=rank_snapshot["rank_description"],
        next_rank_name=rank_snapshot["next_rank_name"],
        next_rank_points=rank_snapshot["next_rank_points"],
        points_to_next_rank=rank_snapshot["points_to_next_rank"],
        current_rank_floor=rank_snapshot["current_rank_floor"],
        rank_progress_percentage=rank_snapshot["rank_progress_percentage"],
        status_message=status_message,
        featured_title=featured_title,
        titles=titles_summary,
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
    # ニックネーム(username)は任意・重複可:
    # - バリデータ側で空文字はNoneに正規化済み
    # - Noneの場合は「未設定」として扱い、表示時はidをフォールバック
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
    posts_count = db.query(Post.id).filter(Post.user_id == current_user.id).count()
    rank_snapshot = get_rank_snapshot(current_user)
    status_message = get_status_message(current_user)
    titles_summary = get_user_titles_summary(db, current_user)
    featured_entry = select_featured_title(titles_summary)
    featured_title = serialize_title_brief(featured_entry)

    display_name = current_user.username if current_user.username else current_user.id
    return UserProfileResponse(
        id=current_user.id,
        username=display_name,
        email=current_user.email,
        created_at=current_user.created_at,
        bio=current_user.bio,
        profile_image_url=current_user.profile_image_url,
        points=current_user.points,
        rank=current_user.rank,
        internal_score=current_user.internal_score,
        account_status=current_user.account_status,
        rank_color=rank_snapshot["rank_color"],
        rank_description=rank_snapshot["rank_description"],
        next_rank_name=rank_snapshot["next_rank_name"],
        next_rank_points=rank_snapshot["next_rank_points"],
        points_to_next_rank=rank_snapshot["points_to_next_rank"],
        current_rank_floor=rank_snapshot["current_rank_floor"],
        rank_progress_percentage=rank_snapshot["rank_progress_percentage"],
        status_message=status_message,
        featured_title=featured_title,
        titles=titles_summary,
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

    award_points(
        db,
        user_to_follow,
        "new_follower",
        metadata={"follower_id": current_user.id},
    )

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
