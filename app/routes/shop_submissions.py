from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
from app.models import RamenShop, RamenShopSubmission
from app.schemas import (
    RamenShopSubmissionCreate,
    RamenShopSubmissionResponse,
    RamenShopSubmissionReview,
    SubmissionUserInfo,
)
from app.utils.auth import get_current_active_user, get_current_admin_user
from app.utils.scoring import award_points, ensure_user_can_contribute

router = APIRouter(prefix="/ramen/submissions", tags=["ramen"])


def _serialize_submission(submission: RamenShopSubmission) -> RamenShopSubmissionResponse:
    proposer = submission.proposer
    proposer_info = SubmissionUserInfo(
        id=proposer.id if proposer else submission.proposer_id,
        username=(proposer.username if proposer and proposer.username else submission.proposer_id),
    )

    reviewer_info = None
    if submission.reviewer:
        reviewer_info = SubmissionUserInfo(
            id=submission.reviewer.id,
            username=submission.reviewer.username,
        )

    return RamenShopSubmissionResponse(
        id=submission.id,
        change_type=submission.change_type,
        shop_id=submission.shop_id,
        status=submission.status,
        note=submission.note,
        proposed_changes=submission.proposed_changes or {},
        created_at=submission.created_at,
        reviewed_at=submission.reviewed_at,
        review_comment=submission.review_comment,
        proposer=proposer_info,
        reviewer=reviewer_info,
    )


@router.post("", response_model=RamenShopSubmissionResponse, status_code=status.HTTP_201_CREATED)
async def create_submission(
    submission_in: RamenShopSubmissionCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    ensure_user_can_contribute(current_user)

    if submission_in.change_type == "update":
        shop = db.query(RamenShop).filter(RamenShop.id == submission_in.shop_id).first()
        if not shop:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="指定された店舗が見つかりません",
            )

    proposed_changes = submission_in.collect_changes()

    submission = RamenShopSubmission(
        shop_id=submission_in.shop_id,
        proposer_id=current_user.id,
        change_type=submission_in.change_type,
        proposed_changes=proposed_changes,
        note=submission_in.note,
        status="pending",
    )

    db.add(submission)
    db.commit()
    db.refresh(submission)
    db.refresh(current_user)

    return _serialize_submission(submission)


@router.get("/me", response_model=List[RamenShopSubmissionResponse])
async def list_my_submissions(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    submissions = (
        db.query(RamenShopSubmission)
        .filter(RamenShopSubmission.proposer_id == current_user.id)
        .order_by(RamenShopSubmission.created_at.desc())
        .all()
    )

    return [_serialize_submission(submission) for submission in submissions]


@router.get("/pending", response_model=List[RamenShopSubmissionResponse])
async def list_pending_submissions(
    db: Session = Depends(get_db),
    current_admin=Depends(get_current_admin_user),
):
    _ = current_admin  # 明示的に未使用警告を抑制
    submissions = (
        db.query(RamenShopSubmission)
        .filter(RamenShopSubmission.status == "pending")
        .order_by(RamenShopSubmission.created_at.asc())
        .all()
    )
    return [_serialize_submission(submission) for submission in submissions]


@router.get("/{submission_id}", response_model=RamenShopSubmissionResponse)
async def get_submission_detail(
    submission_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    submission = db.query(RamenShopSubmission).filter(RamenShopSubmission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="申請が見つかりません")

    if submission.proposer_id != current_user.id and not getattr(current_user, "is_admin", False):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="閲覧権限がありません")

    return _serialize_submission(submission)


@router.post("/{submission_id}/approve", response_model=RamenShopSubmissionResponse)
async def approve_submission(
    submission_id: int,
    review: RamenShopSubmissionReview | None = None,
    db: Session = Depends(get_db),
    current_admin=Depends(get_current_admin_user),
):
    submission = db.query(RamenShopSubmission).filter(RamenShopSubmission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="申請が見つかりません")

    if submission.status != "pending":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="この申請は審査済みです")

    proposed_changes = submission.proposed_changes or {}

    if submission.change_type == "update":
        shop = db.query(RamenShop).filter(RamenShop.id == submission.shop_id).first()
        if not shop:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="対象の店舗が見つかりません")

        for key, value in proposed_changes.items():
            if hasattr(shop, key):
                setattr(shop, key, value)
        shop.last_update = datetime.utcnow()
    else:
        required_fields = ["name", "address", "latitude", "longitude"]
        missing_fields = [field for field in required_fields if field not in proposed_changes]
        if missing_fields:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="新規店舗には店舗名、住所、緯度、経度が必要です",
            )

        new_shop = RamenShop(
            name=proposed_changes.get("name"),
            address=proposed_changes.get("address"),
            latitude=float(proposed_changes.get("latitude")),
            longitude=float(proposed_changes.get("longitude")),
            business_hours=proposed_changes.get("business_hours"),
            closed_day=proposed_changes.get("closed_day"),
            seats=proposed_changes.get("seats"),
            wait_time=0,
            last_update=datetime.utcnow(),
        )
        db.add(new_shop)
        db.flush()
        submission.shop_id = new_shop.id

    submission.status = "approved"
    submission.reviewed_at = datetime.utcnow()
    submission.reviewer_id = current_admin.id
    submission.review_comment = review.comment if review else None

    award_points(
        db,
        submission.proposer,
        "shop_submission_approved",
        metadata={
            "submission_id": submission.id,
            "change_type": submission.change_type,
        },
    )

    db.commit()
    db.refresh(submission)

    return _serialize_submission(submission)


@router.post("/{submission_id}/reject", response_model=RamenShopSubmissionResponse)
async def reject_submission(
    submission_id: int,
    review: RamenShopSubmissionReview | None = None,
    db: Session = Depends(get_db),
    current_admin=Depends(get_current_admin_user),
):
    submission = db.query(RamenShopSubmission).filter(RamenShopSubmission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="申請が見つかりません")

    if submission.status != "pending":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="この申請は審査済みです")

    submission.status = "rejected"
    submission.reviewed_at = datetime.utcnow()
    submission.reviewer_id = current_admin.id
    submission.review_comment = review.comment if review else None

    db.commit()
    db.refresh(submission)

    return _serialize_submission(submission)
