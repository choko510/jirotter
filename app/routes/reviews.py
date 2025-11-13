from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from database import get_db
from app.models import RamenShop, ShopReview, User
from app.schemas import ShopReviewCreate, ShopReviewResponse, ShopReviewListResponse
from app.utils.auth import get_current_active_user
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
):
    """店舗レビュー一覧を取得する"""
    shop = db.query(RamenShop).filter(RamenShop.id == shop_id).first()
    if not shop:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="指定された店舗が存在しません",
        )

    query = (
        db.query(ShopReview)
        .filter(
            ShopReview.shop_id == shop_id,
            ShopReview.moderation_status == "approved",
        )
        .order_by(ShopReview.created_at.desc())
    )

    total = query.count()
    reviews = query.offset(offset).limit(limit).all()

    return ShopReviewListResponse(reviews=reviews, total=total)
