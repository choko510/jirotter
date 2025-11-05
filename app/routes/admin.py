from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from database import get_db
from app.models import Post, Report, RamenShop, RamenShopSubmission, User
from app.schemas import (
    AdminOverviewResponse,
    AdminShopCreate,
    AdminShopDetail,
    AdminShopListResponse,
    AdminShopSummary,
    AdminShopUpdate,
    AdminUserDetail,
    AdminUserListResponse,
    AdminUserModerationUpdate,
    AdminUserSummary,
)
from app.utils.auth import get_current_admin_user
from app.utils.scoring import compute_effective_account_status, update_user_account_status

router = APIRouter(tags=["admin"], prefix="/admin")


def _build_user_summary(db: Session, user: User) -> AdminUserSummary:
    posts_count = db.query(func.count(Post.id)).filter(Post.user_id == user.id).scalar() or 0
    reports_submitted = (
        db.query(func.count(Report.id)).filter(Report.reporter_id == user.id).scalar() or 0
    )
    reports_received = (
        db.query(func.count(Report.id))
        .join(Post, Post.id == Report.post_id)
        .filter(Post.user_id == user.id)
        .scalar()
        or 0
    )

    effective_status = compute_effective_account_status(user)
    update_user_account_status(user)

    return AdminUserSummary(
        id=user.id,
        username=user.username,
        email=user.email,
        created_at=user.created_at,
        points=user.points,
        internal_score=user.internal_score,
        rank=user.rank,
        account_status=user.account_status,
        effective_account_status=effective_status,
        account_status_override=user.account_status_override,
        posting_restriction_expires_at=user.posting_restriction_expires_at,
        ban_expires_at=user.ban_expires_at,
        moderation_note=user.moderation_note,
        moderation_updated_at=user.moderation_updated_at,
        moderated_by_id=user.moderated_by_id,
        is_admin=user.is_admin,
        posts_count=posts_count,
        reports_submitted=reports_submitted,
        reports_received=reports_received,
    )


def _build_user_detail(db: Session, user: User) -> AdminUserDetail:
    summary = _build_user_summary(db, user)
    followers_count = user.followers.count() if hasattr(user.followers, "count") else 0
    following_count = user.following.count() if hasattr(user.following, "count") else 0
    submissions_count = (
        db.query(func.count(RamenShopSubmission.id))
        .filter(RamenShopSubmission.proposer_id == user.id)
        .scalar()
        or 0
    )

    return AdminUserDetail(
        **summary.model_dump(),
        bio=user.bio,
        profile_image_url=user.profile_image_url,
        followers_count=followers_count,
        following_count=following_count,
        shop_submissions_count=submissions_count,
    )


def _build_shop_summary(db: Session, shop: RamenShop) -> AdminShopSummary:
    posts_count = db.query(func.count(Post.id)).filter(Post.shop_id == shop.id).scalar() or 0
    pending_submissions = (
        db.query(func.count(RamenShopSubmission.id))
        .filter(
            RamenShopSubmission.shop_id == shop.id,
            RamenShopSubmission.status == "pending",
        )
        .scalar()
        or 0
    )

    return AdminShopSummary(
        id=shop.id,
        name=shop.name,
        address=shop.address,
        business_hours=shop.business_hours,
        closed_day=shop.closed_day,
        seats=shop.seats,
        latitude=shop.latitude,
        longitude=shop.longitude,
        wait_time=shop.wait_time,
        last_update=shop.last_update,
        posts_count=posts_count,
        pending_submissions=pending_submissions,
    )


def _build_shop_detail(db: Session, shop: RamenShop) -> AdminShopDetail:
    summary = _build_shop_summary(db, shop)
    submissions_total = (
        db.query(func.count(RamenShopSubmission.id))
        .filter(RamenShopSubmission.shop_id == shop.id)
        .scalar()
        or 0
    )

    return AdminShopDetail(
        **summary.model_dump(),
        submissions_total=submissions_total,
    )


@router.get("/overview", response_model=AdminOverviewResponse)
async def get_admin_overview(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin_user),
):
    total_users = db.query(func.count(User.id)).scalar() or 0
    active_users = db.query(func.count(User.id)).filter(User.account_status == "active").scalar() or 0
    restricted_users = (
        db.query(func.count(User.id)).filter(User.account_status == "restricted").scalar() or 0
    )
    banned_users = db.query(func.count(User.id)).filter(User.account_status == "banned").scalar() or 0
    one_week_ago = datetime.utcnow() - timedelta(days=7)
    new_users_last_week = (
        db.query(func.count(User.id)).filter(User.created_at >= one_week_ago).scalar() or 0
    )
    total_shops = db.query(func.count(RamenShop.id)).scalar() or 0
    pending_shop_submissions = (
        db.query(func.count(RamenShopSubmission.id))
        .filter(RamenShopSubmission.status == "pending")
        .scalar()
        or 0
    )
    reports_last_week = (
        db.query(func.count(Report.id)).filter(Report.created_at >= one_week_ago).scalar() or 0
    )

    return AdminOverviewResponse(
        total_users=total_users,
        active_users=active_users,
        restricted_users=restricted_users,
        banned_users=banned_users,
        new_users_last_week=new_users_last_week,
        total_shops=total_shops,
        pending_shop_submissions=pending_shop_submissions,
        reports_last_week=reports_last_week,
    )


@router.get("/users", response_model=AdminUserListResponse)
async def list_users(
    search: Optional[str] = Query(None, description="ユーザーID・名前・メールでの検索"),
    status_filter: Optional[str] = Query(
        None, regex="^(active|warning|restricted|banned)$", description="アカウント状態のフィルタ"
    ),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin_user),
):
    query = db.query(User)

    if search:
        keyword = f"%{search}%"
        query = query.filter(
            or_(
                User.id.ilike(keyword),
                User.username.ilike(keyword),
                User.email.ilike(keyword),
            )
        )

    if status_filter:
        query = query.filter(User.account_status == status_filter)

    total = query.count()

    users = (
        query.order_by(User.created_at.desc()).offset(offset).limit(limit).all()
    )

    summaries = [_build_user_summary(db, user) for user in users]

    return AdminUserListResponse(users=summaries, total=total)


@router.get("/users/{user_id}", response_model=AdminUserDetail)
async def get_user_detail(
    user_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin_user),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ユーザーが見つかりません")

    return _build_user_detail(db, user)


@router.patch("/users/{user_id}", response_model=AdminUserDetail)
async def update_user_moderation(
    user_id: str,
    payload: AdminUserModerationUpdate,
    db: Session = Depends(get_db),
    admin_user: User = Depends(get_current_admin_user),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ユーザーが見つかりません")

    if user.id == admin_user.id and payload.is_admin is False:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="自分自身の管理者権限は取り消せません",
        )

    now = datetime.utcnow()
    updated = False

    if payload.revert_account_status_override:
        user.account_status_override = None
        updated = True
    elif payload.account_status_override is not None:
        user.account_status_override = payload.account_status_override
        updated = True

    if payload.clear_posting_restriction:
        user.posting_restriction_expires_at = None
        updated = True
    elif payload.posting_restriction_expires_at is not None:
        if payload.posting_restriction_expires_at <= now:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="投稿制限の終了日時は未来の時刻を指定してください",
            )
        user.posting_restriction_expires_at = payload.posting_restriction_expires_at
        updated = True

    if payload.clear_ban_schedule:
        user.ban_expires_at = None
        updated = True
    elif payload.ban_expires_at is not None:
        if payload.ban_expires_at <= now:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="BANの解除予定日時は未来の時刻を指定してください",
            )
        user.ban_expires_at = payload.ban_expires_at
        updated = True

    if payload.moderation_note is not None:
        user.moderation_note = payload.moderation_note
        updated = True

    if payload.is_admin is not None:
        user.is_admin = payload.is_admin
        updated = True

    if updated:
        user.moderation_updated_at = now
        user.moderated_by_id = admin_user.id
        update_user_account_status(user, now=now)
        db.add(user)
        db.commit()
        db.refresh(user)

    return _build_user_detail(db, user)


@router.get("/shops", response_model=AdminShopListResponse)
async def list_shops(
    search: Optional[str] = Query(None, description="店名・住所での検索"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin_user),
):
    query = db.query(RamenShop)

    if search:
        keyword = f"%{search}%"
        query = query.filter(
            or_(
                RamenShop.name.ilike(keyword),
                RamenShop.address.ilike(keyword),
            )
        )

    total = query.count()
    shops = (
        query.order_by(RamenShop.name.asc()).offset(offset).limit(limit).all()
    )

    summaries = [_build_shop_summary(db, shop) for shop in shops]
    return AdminShopListResponse(shops=summaries, total=total)


@router.get("/shops/{shop_id}", response_model=AdminShopDetail)
async def get_shop_detail(
    shop_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin_user),
):
    shop = db.query(RamenShop).filter(RamenShop.id == shop_id).first()
    if not shop:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="店舗が見つかりません")

    return _build_shop_detail(db, shop)


@router.post("/shops", response_model=AdminShopDetail, status_code=status.HTTP_201_CREATED)
async def create_shop(
    payload: AdminShopCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin_user),
):
    shop = RamenShop(
        name=payload.name,
        address=payload.address,
        business_hours=payload.business_hours,
        closed_day=payload.closed_day,
        seats=payload.seats,
        latitude=payload.latitude,
        longitude=payload.longitude,
        wait_time=payload.wait_time or 0,
    )
    db.add(shop)
    db.commit()
    db.refresh(shop)
    return _build_shop_detail(db, shop)


@router.patch("/shops/{shop_id}", response_model=AdminShopDetail)
async def update_shop(
    shop_id: int,
    payload: AdminShopUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin_user),
):
    shop = db.query(RamenShop).filter(RamenShop.id == shop_id).first()
    if not shop:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="店舗が見つかりません")

    if payload.name is not None:
        shop.name = payload.name
    if payload.address is not None:
        shop.address = payload.address
    if payload.business_hours is not None:
        shop.business_hours = payload.business_hours
    if payload.closed_day is not None:
        shop.closed_day = payload.closed_day
    if payload.seats is not None:
        shop.seats = payload.seats
    if payload.latitude is not None:
        shop.latitude = payload.latitude
    if payload.longitude is not None:
        shop.longitude = payload.longitude
    if payload.wait_time is not None:
        shop.wait_time = payload.wait_time

    shop.last_update = datetime.utcnow()

    db.add(shop)
    db.commit()
    db.refresh(shop)
    return _build_shop_detail(db, shop)
