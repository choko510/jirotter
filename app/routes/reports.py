from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from typing import Dict, Any

from database import get_db
from app.models import Post, User, Report
from app.schemas import ReportCreate, ReportResponse
from app.utils.auth import get_current_active_user
from app.utils.content_moderator import content_moderator

router = APIRouter(tags=["reports"])

@router.post("/posts/{post_id}/report", response_model=ReportResponse, status_code=status.HTTP_201_CREATED)
async def create_report(
    post_id: int,
    report_data: ReportCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """投稿通報エンドポイント"""
    # 投稿の存在確認
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="投稿が見つかりません"
        )
    
    # 自分の投稿は通報できない
    if post.user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="自分の投稿を通報することはできません"
        )
    
    # 既に同じ投稿を通報しているか確認
    existing_report = db.query(Report).filter(
        Report.post_id == post_id,
        Report.reporter_id == current_user.id
    ).first()
    
    if existing_report:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="この投稿は既に通報されています"
        )
    
    try:
        report = Report(
            post_id=post_id,
            reporter_id=current_user.id,
            reason=report_data.reason,
            description=report_data.description
        )
        
        db.add(report)
        db.commit()
        db.refresh(report)
        
        # バックグラウンドでAIによるコンテンツ審査を実行
        background_tasks.add_task(
            content_moderator.review_reported_post,
            db,
            post_id,
            report_data.reason
        )
        
        return report
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="通報の送信に失敗しました"
        )

@router.get("/reports", response_model=Dict[str, Any])
async def get_reports(
    page: int = 1,
    per_page: int = 20,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """通報一覧取得エンドポイント（管理者用）"""
    # TODO: 管理者権限のチェックを実装
    
    try:
        total = db.query(Report).count()
        pages = (total + per_page - 1) // per_page
        
        reports = db.query(Report).filter(
            Report.post_id == Post.id,
            Report.reporter_id == User.id
        ).order_by(Report.created_at.desc()).offset(
            (page - 1) * per_page
        ).limit(per_page).all()
        
        report_responses = []
        for report in reports:
            report_responses.append({
                "id": report.id,
                "post_id": report.post_id,
                "post_content": report.post.content,
                "post_author": report.post.author.username,
                "reporter_id": report.reporter_id,
                "reporter_name": report.reporter.username,
                "reason": report.reason,
                "description": report.description,
                "created_at": report.created_at
            })
        
        return {
            "reports": report_responses,
            "total": total,
            "pages": pages,
            "current_page": page
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"通報一覧の取得に失敗しました: {e}"
        )

@router.post("/moderate/post/{post_id}", response_model=Dict[str, Any])
async def moderate_post(
    post_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """特定の投稿をAI審査するエンドポイント（管理者用）"""
    # TODO: 管理者権限のチェックを実装
    
    # 投稿の存在確認
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="投稿が見つかりません"
        )
    
    try:
        # この投稿に対する通報を取得
        reports = db.query(Report).filter(Report.post_id == post_id).all()
        if not reports:
            # 通報がない場合は一般的な審査を実行
            result = await content_moderator.review_reported_post(db, post_id, "手動審査")
        else:
            # 最新の通報理由を使用
            latest_reason = reports[-1].reason
            result = await content_moderator.review_reported_post(db, post_id, latest_reason)
        
        result["post_id"] = post_id
        return result
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"投稿の審査に失敗しました: {e}"
        )