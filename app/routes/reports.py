from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from typing import Dict, Any, List

from database import get_db
from app.models import Post, User, Report, Visit
from app.schemas import PostReportCreate, PostReportResponse
from app.utils.auth import get_current_active_user
from app.utils.content_moderator import content_moderator

router = APIRouter(tags=["reports"])


@router.post("/users/{reported_user_id}/report", response_model=Dict[str, Any], status_code=status.HTTP_201_CREATED)
async def create_user_report(
    reported_user_id: str,
    report_data: PostReportCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    ユーザー通報エンドポイント

    - 自分以外のユーザーのみ通報可能
    - サーバー側で以下の情報を集約して保存:
        * ユーザー名 / ユーザーID
        * アイコンURL
        * 過去の投稿の要約（直近数件）
        * 直近10件のチェックイン情報の要約
    """
    # 通報対象ユーザーの存在確認
    reported_user = db.query(User).filter(User.id == reported_user_id).first()
    if not reported_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="通報対象のユーザーが見つかりません",
        )

    # 自分自身は通報不可
    if reported_user.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="自分自身を通報することはできません",
        )

    # 同一対象ユーザーに対する重複通報を防止（任意仕様）
    # Reportモデルに user_id カラムがないため、description 内スナップショットで識別
    existing_report = (
        db.query(Report)
        .filter(
            Report.reporter_id == current_user.id,
            Report.description.contains(f"対象ユーザーID: {reported_user.id}"),
        )
        .first()
    )
    if existing_report:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="このユーザーは既に通報済みです",
        )

    # 通報対象ユーザーの最近の投稿を取得（過去ツイート相当）
    recent_posts: List[Post] = (
        db.query(Post)
        .filter(Post.user_id == reported_user.id)
        .order_by(Post.created_at.desc())
        .limit(20)
        .all()
    )

    # 通報対象ユーザーの直近10件のチェックイン情報を取得
    recent_visits: List[Visit] = (
        db.query(Visit)
        .filter(Visit.user_id == reported_user.id)
        .order_by(Visit.visit_date.desc())
        .limit(10)
        .all()
    )

    # サマリ文字列を生成（管理画面で確認しやすいように）
    def summarize_posts(posts: List[Post]) -> str:
        if not posts:
            return "最近の投稿は取得できませんでした。"
        summaries: List[str] = []
        for p in posts:
            content = (p.content or "")[:80].replace("\n", " ")
            summaries.append(f"[{p.id}] {content}")
        return " / ".join(summaries)

    def summarize_visits(visits: List[Visit]) -> str:
        if not visits:
            return "直近10件のチェックイン情報は取得できませんでした。"
        summaries: List[str] = []
        for v in visits:
            shop_name = getattr(v, "shop_name", None) or ""
            if hasattr(v, "shop") and getattr(v.shop, "name", None):
                shop_name = v.shop.name
            summaries.append(f"[{v.id}] {shop_name} @ {v.visit_date}")
        return " / ".join(summaries)

    profile_snapshot = {
        "reported_user_id": reported_user.id,
        "reported_username": reported_user.username,
        "reported_profile_image_url": getattr(
            reported_user, "profile_image_url", None
        ),
        "recent_posts_summary": summarize_posts(recent_posts),
        "recent_checkins_summary": summarize_visits(recent_visits),
    }

    try:
        # 既存 Report モデルを流用し、description にスナップショットを埋め込む
        snapshot_text = (
            "[ユーザー通報]\n"
            f"対象ユーザーID: {profile_snapshot['reported_user_id']}\n"
            f"対象ユーザー名: {profile_snapshot['reported_username']}\n"
            f"アイコンURL: {profile_snapshot['reported_profile_image_url']}\n"
            f"--- 過去投稿サマリ ---\n{profile_snapshot['recent_posts_summary']}\n"
            f"--- 直近10件チェックインサマリ ---\n{profile_snapshot['recent_checkins_summary']}\n"
            f"--- 通報理由 ---\n{report_data.reason}\n"
            f"--- 補足説明 ---\n{report_data.description or ''}\n"
        )

        report = Report(
            reporter_id=current_user.id,
            reason=report_data.reason,
            description=snapshot_text,
        )

        db.add(report)
        db.commit()
        db.refresh(report)

        # 必要であれば AI 審査をバックグラウンドで実行（対象ユーザーの投稿パターン等を審査）
        if hasattr(content_moderator, "review_reported_user"):
            background_tasks.add_task(
                content_moderator.review_reported_user,
                db,
                reported_user.id,
                report_data.reason,
            )

        return {
            "id": report.id,
            "reported_user_id": reported_user.id,
            "reporter_id": current_user.id,
            "reason": report.reason,
            "description": report.description,
            "created_at": report.created_at,
        }

    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="ユーザー通報の送信に失敗しました",
        )


@router.post("/posts/{post_id}/report", response_model=PostReportResponse, status_code=status.HTTP_201_CREATED)
async def create_report(
    post_id: int,
    report_data: PostReportCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """投稿通報エンドポイント"""
    # 投稿の存在確認
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="投稿が見つかりません",
        )

    # 自分の投稿は通報できない
    if post.user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="自分の投稿を通報することはできません",
        )

    # 既に同じ投稿を通報しているか確認
    existing_report = (
        db.query(Report)
        .filter(
            Report.post_id == post_id,
            Report.reporter_id == current_user.id,
        )
        .first()
    )

    if existing_report:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="この投稿は既に通報されています",
        )

    try:
        report = Report(
            post_id=post_id,
            reporter_id=current_user.id,
            reason=report_data.reason,
            description=report_data.description,
        )

        db.add(report)
        db.commit()
        db.refresh(report)

        # バックグラウンドでAIによるコンテンツ審査を実行
        if hasattr(content_moderator, "review_reported_post"):
            background_tasks.add_task(
                content_moderator.review_reported_post,
                db,
                post_id,
                report_data.reason,
            )

        return report

    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="通報の送信に失敗しました",
        )


@router.get("/reports", response_model=Dict[str, Any])
async def get_reports(
    page: int = 1,
    per_page: int = 20,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """通報一覧取得エンドポイント（管理者用）"""
    # TODO: 管理者権限のチェックを実装

    try:
        total = db.query(Report).count()
        pages = (total + per_page - 1) // per_page

        reports = (
            db.query(Report)
            .filter(
                Report.post_id == Post.id,
                Report.reporter_id == User.id,
            )
            .order_by(Report.created_at.desc())
            .offset((page - 1) * per_page)
            .limit(per_page)
            .all()
        )

        report_responses = []
        for report in reports:
            report_responses.append(
                {
                    "id": report.id,
                    "post_id": report.post_id,
                    "post_content": report.post.content,
                    "post_author": report.post.author.username,
                    "reporter_id": report.reporter_id,
                    "reporter_name": report.reporter.username,
                    "reason": report.reason,
                    "description": report.description,
                    "created_at": report.created_at,
                }
            )

        return {
            "reports": report_responses,
            "total": total,
            "pages": pages,
            "current_page": page,
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"通報一覧の取得に失敗しました: {e}",
        )


@router.post("/moderate/post/{post_id}", response_model=Dict[str, Any])
async def moderate_post(
    post_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """特定の投稿をAI審査するエンドポイント（管理者用）"""
    # TODO: 管理者権限のチェックを実装

    # 投稿の存在確認
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="投稿が見つかりません",
        )

    try:
        # この投稿に対する通報を取得
        reports = db.query(Report).filter(Report.post_id == post_id).all()
        if not reports:
            # 通報がない場合は一般的な審査を実行
            if hasattr(content_moderator, "review_reported_post"):
                result = await content_moderator.review_reported_post(
                    db, post_id, "手動審査"
                )
            else:
                result = {"status": "no_moderator", "post_id": post_id}
        else:
            # 最新の通報理由を使用
            latest_reason = reports[-1].reason
            if hasattr(content_moderator, "review_reported_post"):
                result = await content_moderator.review_reported_post(
                    db, post_id, latest_reason
                )
            else:
                result = {
                    "status": "no_moderator",
                    "post_id": post_id,
                    "reason": latest_reason,
                }

        result["post_id"] = post_id
        return result

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"投稿の審査に失敗しました: {e}",
        )