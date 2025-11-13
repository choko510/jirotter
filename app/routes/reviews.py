from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from database import get_db
from app.models import RamenShop, ShopReview, User
from app.schemas import ShopReviewCreate, ShopReviewResponse, ShopReviewListResponse
from app.utils.auth import get_current_active_user, get_current_user_optional
from app.utils.scoring import ensure_user_can_contribute, award_points
from app.utils.rate_limiter import rate_limiter
from app.utils.content_moderator import content_moderator

router = APIRouter(tags=["shop_reviews"])


@router.post(
    "/shops/{shop_id}/reviews",
    response_model=ShopReviewResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_shop_review(
    shop_id: int,
    review_data: ShopReviewCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """店舗レビューを作成する"""
    ensure_user_can_contribute(current_user)
    await rate_limiter.hit(f"shop_review:{current_user.id}", limit=10, window_seconds=60)

    shop = db.query(RamenShop).filter(RamenShop.id == shop_id).first()
    if not shop:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="指定された店舗が存在しません",
        )

    existing = (
        db.query(ShopReview)
        .filter(ShopReview.shop_id == shop_id, ShopReview.user_id == current_user.id)
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="この店舗には既にレビューを投稿しています",
        )

    sanitized_comment = review_data.comment.strip()

    try:
        analysis = await content_moderator.analyze_content(
            sanitized_comment,
            reason="shop_review",
            user_history="",
        )
    except Exception:
        analysis = {"is_violation": False, "confidence": 0.0}

    if analysis.get("is_violation") and analysis.get("confidence", 0) >= 0.7:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="コミュニティガイドラインに違反する可能性が高いため、レビューを投稿できません",
        )

    review = ShopReview(
        shop_id=shop_id,
        user_id=current_user.id,
        rating=review_data.rating,
        comment=sanitized_comment,
        moderation_status="approved",
        moderation_reason=analysis.get("reason"),
        moderation_confidence=analysis.get("confidence"),
    )

    db.add(review)
    db.flush()

    award_points(
        db,
        current_user,
        "shop_review",
        metadata={"shop_id": shop_id, "review_id": review.id},
    )

    db.commit()
    db.refresh(review)
    return review


@router.get(
    "/shops/{shop_id}/reviews",
    response_model=ShopReviewListResponse,
)
async def list_shop_reviews(
    shop_id: int,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """店舗レビュー一覧を取得する"""
    shop = db.query(RamenShop).filter(RamenShop.id == shop_id).first()
    if not shop:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="指定された店舗が存在しません",
        )

    base_filter = (
        ShopReview.shop_id == shop_id,
        ShopReview.moderation_status == "approved",
    )

    query = (
        db.query(ShopReview)
        .filter(*base_filter)
        .order_by(ShopReview.created_at.desc())
    )

    total = query.count()
    reviews = query.offset(offset).limit(limit).all()

    average_rating: Optional[float] = None
    rating_distribution = {str(rating): 0 for rating in range(1, 6)}

    if total > 0:
        _, avg_value = (
            db.query(func.count(ShopReview.id), func.avg(ShopReview.rating))
            .filter(*base_filter)
            .first()
        )
        average_rating = float(avg_value) if avg_value is not None else None

        rating_rows = (
            db.query(ShopReview.rating, func.count(ShopReview.id))
            .filter(*base_filter)
            .group_by(ShopReview.rating)
            .all()
        )
        for rating_value, rating_count in rating_rows:
            rating_distribution[str(rating_value)] = rating_count

    user_review_id: Optional[int] = None
    if current_user:
        user_review = (
            db.query(ShopReview.id)
            .filter(*base_filter, ShopReview.user_id == current_user.id)
            .first()
        )
        if user_review:
            user_review_id = user_review[0]

    return ShopReviewListResponse(
        reviews=reviews,
        total=total,
        average_rating=average_rating,
        rating_distribution=rating_distribution,
        user_review_id=user_review_id,
    )
