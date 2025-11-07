from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import desc
from sqlalchemy.orm import Session, joinedload

from database import get_db
from app.models import RamenShop, User, Visit
from app.schemas import VisitCreate, VisitResponse, VisitsResponse
from app.utils.auth import get_current_active_user

router = APIRouter(tags=["visits"])


@router.post("/visits", response_model=VisitResponse, status_code=status.HTTP_201_CREATED)
def create_visit(
    visit_request: VisitCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """訪問記録を作成するエンドポイント"""
    shop = db.query(RamenShop).filter(RamenShop.id == visit_request.shop_id).first()
    if not shop:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="指定された店舗が存在しません"
        )

    visit = Visit(
        user_id=current_user.id,
        shop_id=visit_request.shop_id,
        visit_date=visit_request.visit_date,
        rating=visit_request.rating,
        comment=visit_request.comment,
        image_url=visit_request.image_url,
        wait_time_minutes=visit_request.wait_time_minutes,
        taste_rating=visit_request.taste_rating,
        flavor_notes=visit_request.flavor_notes,
    )

    try:
        db.add(visit)

        if visit.wait_time_minutes is not None:
            shop.wait_time = visit.wait_time_minutes
            shop.last_update = datetime.now(timezone.utc)

        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="訪問記録の保存に失敗しました"
        )

    visit_with_relations = db.query(Visit).options(
        joinedload(Visit.shop),
        joinedload(Visit.user)
    ).filter(Visit.id == visit.id).first()

    if not visit_with_relations:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="訪問記録の取得に失敗しました"
        )

    response_data = {
        "id": visit_with_relations.id,
        "user_id": visit_with_relations.user_id,
        "shop_id": visit_with_relations.shop_id,
        "visit_date": visit_with_relations.visit_date,
        "rating": visit_with_relations.rating,
        "comment": visit_with_relations.comment,
        "image_url": visit_with_relations.image_url,
        "wait_time_minutes": visit_with_relations.wait_time_minutes,
        "taste_rating": visit_with_relations.taste_rating,
        "flavor_notes": visit_with_relations.flavor_notes,
        "created_at": visit_with_relations.created_at,
        "shop_name": visit_with_relations.shop.name,
        "shop_address": visit_with_relations.shop.address,
        # username は任意入力のため None の場合は id をフォールバック
        "author_username": visit_with_relations.user.username or visit_with_relations.user.id,
    }

    return VisitResponse.model_validate(response_data)


@router.get("/visits/me", response_model=VisitsResponse)
def get_my_visits(
    page: int = Query(1, ge=1, description="ページ番号"),
    per_page: int = Query(20, ge=1, le=100, description="1ページあたりの訪問数"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """認証ユーザーの訪問店舗一覧を取得するエンドポイント"""
    base_query = db.query(Visit).options(
        joinedload(Visit.shop),
        joinedload(Visit.user)
    ).filter(Visit.user_id == current_user.id)

    total = base_query.count()

    visits: List[Visit] = base_query.order_by(desc(Visit.visit_date)).offset(
        (page - 1) * per_page
    ).limit(per_page).all()

    visit_responses = []
    for visit in visits:
        if not visit.shop or not visit.user:
            # 関連データが欠落している場合はスキップ
            continue

        visit_responses.append(
            VisitResponse.model_validate({
                "id": visit.id,
                "user_id": visit.user_id,
                "shop_id": visit.shop_id,
                "visit_date": visit.visit_date,
                "rating": visit.rating,
                "comment": visit.comment,
                "image_url": visit.image_url,
                "wait_time_minutes": visit.wait_time_minutes,
                "taste_rating": visit.taste_rating,
                "flavor_notes": visit.flavor_notes,
                "created_at": visit.created_at,
                "shop_name": visit.shop.name,
                "shop_address": visit.shop.address,
                # username は任意入力なので None の場合は id を返す
                "author_username": visit.user.username or visit.user.id,
            })
        )

    return VisitsResponse(
        visits=visit_responses,
        total=total
    )
