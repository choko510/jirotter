from fastapi import APIRouter, Depends, HTTPException, status, Query, File, UploadFile, Form
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc, func, or_
from typing import Dict, Any, List, Optional, Set
import re
import shutil
import os
import time

from database import get_db
from app.models import Post, User, Like, Reply, RamenShop, Follow
from app.schemas import PostCreate, PostResponse, PostsResponse
from app.utils.auth import get_current_user, get_current_active_user, get_current_user_optional
from app.utils.security import validate_post_content
from app.utils.image_processor import process_image
from app.utils.image_validation import validate_image_file
from app.utils.video_validation import validate_video_file
from app.utils.scoring import award_points, ensure_user_can_contribute
from app.utils.rate_limiter import rate_limiter
from app.utils.spam_detector import spam_detector
from app.utils.moderation_tasks import schedule_post_moderation
from app.utils.ai_responder import (
    AI_USER_ID,
    ensure_ai_responder_user,
    generate_ai_reply,
)

router = APIRouter(tags=["posts"])



UPLOAD_DIR = "uploads"
VIDEO_DIR = os.path.join(UPLOAD_DIR, "videos")
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(VIDEO_DIR, exist_ok=True)

MENTION_PATTERN = re.compile(r"@([A-Za-z0-9_]{1,30})")

@router.post("/posts", response_model=PostResponse, status_code=status.HTTP_201_CREATED)
async def create_post(
    content: str = Form(...),
    image: Optional[UploadFile] = File(None),
    video: Optional[UploadFile] = File(None),
    video_duration: Optional[float] = Form(None),
    shop_id: Optional[int] = Form(None),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """投稿作成エンドポイント"""
    ensure_user_can_contribute(current_user)
    # 投稿頻度の制限
    await rate_limiter.hit(f"post:{current_user.id}", limit=5, window_seconds=60)

    # 投稿内容のバリデーションとサニタイズ
    errors, sanitized_content = validate_post_content(content)
    if errors:
        error_messages = []
        for field, message in errors.items():
            error_messages.append(message)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_messages[0] if error_messages else "投稿内容に誤りがあります"
        )

    spam_result = spam_detector.evaluate_post(db, current_user.id, sanitized_content)
    is_shadow_banned = spam_result.is_spam
    shadow_ban_reason = " / ".join(spam_result.reasons) if spam_result.reasons else None
    spam_score = spam_result.score  # スパムスコアを保存

    mentioned_handles: Set[str] = set()
    ai_responder_user: Optional[User] = None
    if sanitized_content:
        mentioned_handles = {
            match.group(1)
            for match in MENTION_PATTERN.finditer(sanitized_content)
        }

    if mentioned_handles:
        unique_handles = list(mentioned_handles)
        existing_users = db.query(User).filter(User.id.in_(unique_handles)).all()
        found_ids = {user.id.lower() for user in existing_users}
        ai_mentioned = any(handle.lower() == AI_USER_ID for handle in mentioned_handles)

        if ai_mentioned:
            ai_responder_user = next(
                (user for user in existing_users if user.id.lower() == AI_USER_ID),
                None,
            )
            if ai_responder_user is None:
                ai_responder_user = ensure_ai_responder_user(db)
                if ai_responder_user:
                    found_ids.add(ai_responder_user.id.lower())

        missing_handles = sorted(
            handle
            for handle in mentioned_handles
            if handle.lower() not in found_ids
        )
        if missing_handles:
            missing_labels = ", ".join(f"@{handle}" for handle in missing_handles)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"メンションしたユーザーが存在しません: {missing_labels}",
            )
    
    # 店舗IDのバリデーション
    if shop_id is not None:
        shop = db.query(RamenShop).filter(RamenShop.id == shop_id).first()
        if not shop:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="指定された店舗が存在しません"
            )
    image_url = None
    thumbnail_url = None
    original_image_url = None
    video_url = None
    processed_video_duration: Optional[float] = None
    
    if image:
        # ファイルバリデーション
        validation_result = validate_image_file(image)
        if not validation_result["is_valid"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=validation_result["error"]
            )
        
        # 画像処理（WebP変換とリサイズ）
        try:
            thumbnail_url, original_image_url = process_image(image, current_user.id)
            
            if not thumbnail_url or not original_image_url:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="画像の処理に失敗しました"
                )
            
        except Exception as e:
            print(f"画像処理エラー: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="画像の処理に失敗しました"
            )

    if video:
        validation_result = validate_video_file(video)
        if not validation_result["is_valid"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=validation_result["error"]
            )

        if video_duration is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="動画の長さを指定してください"
            )

        try:
            processed_video_duration = float(video_duration)
        except (TypeError, ValueError):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="動画の長さが不正です"
            )

        if processed_video_duration <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="動画の長さが不正です"
            )

        if processed_video_duration > 10:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="動画は10秒以内にしてください"
            )

        original_filename = os.path.basename(video.filename) if video.filename else "video.mp4"
        name, ext = os.path.splitext(original_filename)
        if not ext:
            ext = ".mp4"
        safe_name = "".join(c for c in name if c.isalnum() or c in ('-', '_')) or "video"
        timestamp = int(time.time())
        video_filename = f"{current_user.id}_{safe_name}_{timestamp}{ext}"
        video_path = os.path.join(VIDEO_DIR, video_filename)

        try:
            video.file.seek(0)
            with open(video_path, "wb") as buffer:
                shutil.copyfileobj(video.file, buffer)
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="動画の保存に失敗しました"
            )

        video_url = f"/uploads/videos/{video_filename}"

    try:
        post = Post(
            content=sanitized_content,
            user_id=current_user.id,
            thumbnail_url=thumbnail_url,
            original_image_url=original_image_url,
            video_url=video_url,
            video_duration=processed_video_duration,
            shop_id=shop_id,
            is_shadow_banned=is_shadow_banned,
            shadow_ban_reason=shadow_ban_reason,
            spam_score=spam_score  # スパムスコアを保存
        )

        db.add(post)
        db.flush()

        if not post.is_shadow_banned and video_url:
            award_points(
                db,
                current_user,
                "video_post",
                metadata={
                    "post_id": post.id,
                    "shop_id": shop_id,
                    "video_duration": processed_video_duration,
                },
            )
        elif not post.is_shadow_banned and (original_image_url or thumbnail_url):
            award_points(
                db,
                current_user,
                "image_post",
                metadata={
                    "post_id": post.id,
                    "shop_id": shop_id,
                },
            )

        # AIレスポンダーへのメンションがあり、投稿がシャドウバンされていない場合は
        # 返信生成をバックグラウンドで行う（投稿処理をブロックしない）
        if ai_responder_user and not post.is_shadow_banned:
            from app.utils.moderation_tasks import schedule_task

            async def _generate_and_save_ai_reply(post_id: int, content: str, author_id: str):
                from database import SessionLocal
                from app.models import Reply as ReplyModel
                from app.utils.ai_responder import (
                    ensure_ai_responder_user as _ensure_ai_user,
                    generate_ai_reply as _generate_ai_reply,
                )

                db_session = SessionLocal()
                try:
                    ai_user = _ensure_ai_user(db_session)
                    if not ai_user:
                        return

                    ai_reply_content = await _generate_ai_reply(content, author_id)
                    if not ai_reply_content:
                        return

                    ai_reply = ReplyModel(
                        content=ai_reply_content,  # 200文字制限なし
                        user_id=ai_user.id,
                        post_id=post_id,
                    )
                    db_session.add(ai_reply)
                    db_session.commit()
                except Exception as e:
                    db_session.rollback()
                    print(f"AI返信バックグラウンド処理中にエラーが発生しました: {e}")
                finally:
                    db_session.close()

            try:
                await schedule_task(
                    _generate_and_save_ai_reply(
                        post.id,
                        sanitized_content,
                        current_user.id,
                    )
                )
            except Exception as e:
                # AI返信生成は付加的機能のため、失敗しても投稿処理自体は継続
                print(f"AI返信バックグラウンドスケジュールに失敗しました: {e}")

        db.commit()
        db.refresh(post)

        # スパム判定、低スコアユーザー、またはスパムスコアに基づく投稿のみモデレーションをスケジュール
        should_moderate = False
        moderation_reason = ""
        
        if post.is_shadow_banned:
            should_moderate = True
            moderation_reason = "スパム判定"
            print(f"投稿ID {post.id} はスパム判定されているためモデレーションをスケジュールします")
        elif (current_user.internal_score or 100) <= 70:
            should_moderate = True
            moderation_reason = "低スコアユーザー"
            print(f"ユーザーID {current_user.id} は低スコア(internal_score: {current_user.internal_score})のためモデレーションをスケジュールします")
        elif spam_score >= 1.5:  # 閾値を1.5に引き下げて低リスクも含める
            should_moderate = True
            moderation_reason = f"スパムスコア({spam_score})"
            if spam_score >= 3.5:
                print(f"投稿ID {post.id} は高スパムスコア({spam_score})のためモデレーションをスケジュールします")
            elif spam_score >= 2.5:
                print(f"投稿ID {post.id} は中スパムスコア({spam_score})のためモデレーションをスケジュールします")
            else:
                print(f"投稿ID {post.id} は低スパムスコア({spam_score})のためモデレーションをスケジュールします")
        
        if should_moderate:
            await schedule_post_moderation(post.id, db)
        else:
            print(f"投稿ID {post.id} はモデレーション対象外です")

        return post
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="投稿に失敗しました"
        )

@router.get("/posts", response_model=PostsResponse)
async def get_posts(
    page: int = Query(1, ge=1, description="ページ番号"),
    per_page: int = Query(20, ge=1, le=100, description="1ページあたりの投稿数"),
    timeline_type: str = Query("recommend", description="タイムラインの種類: recommend または following"),
    keyword: Optional[str] = Query(None, description="投稿本文に含まれるキーワード"),
    shop_id: Optional[int] = Query(None, ge=1, description="紐づく店舗ID"),
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """投稿一覧取得エンドポイント"""
    try:
        # 基本のクエリを準備
        posts_query = db.query(Post).options(
            joinedload(Post.author),
            joinedload(Post.replies).joinedload(Reply.author),
            joinedload(Post.shop)
        )

        filter_conditions = []

        if current_user:
            filter_conditions.append(
                or_(Post.is_shadow_banned.is_(False), Post.user_id == current_user.id)
            )
        else:
            filter_conditions.append(Post.is_shadow_banned.is_(False))

        # フォロー中のタイムラインを取得する場合
        if timeline_type == "following":
            if not current_user:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="フォロー中のタイムラインを表示するにはログインが必要です"
                )

            # フォロー中のユーザーIDリストを取得
            following_ids = db.query(Follow.followed_id).filter(
                Follow.follower_id == current_user.id
            ).all()
            following_ids = [fid[0] for fid in following_ids]

            # 自分自身も含める
            following_ids.append(current_user.id)

            filter_conditions.append(Post.user_id.in_(following_ids))

        shop = None
        or_conditions = []

        if shop_id is not None:
            shop = db.query(RamenShop).filter(RamenShop.id == shop_id).first()
            if not shop:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="指定されたラーメン店が見つかりません"
                )
            or_conditions.append(Post.shop_id == shop_id)

        # 店舗名や指定キーワードで投稿本文を検索
        text_terms = []
        if keyword:
            cleaned_keyword = keyword.strip()
            if cleaned_keyword:
                text_terms.append(cleaned_keyword)

        if shop and shop.name:
            shop_name = shop.name.strip()
            if shop_name:
                text_terms.append(shop_name)

        if text_terms:
            unique_terms = []
            seen_terms = set()
            for term in text_terms:
                if term not in seen_terms:
                    seen_terms.add(term)
                    unique_terms.append(term)

            or_conditions.extend(
                Post.content.ilike(f"%{term}%") for term in unique_terms
            )

        if or_conditions:
            filter_conditions.append(or_(*or_conditions))

        if filter_conditions:
            posts_query = posts_query.filter(*filter_conditions)

        total = posts_query.count()
        pages = (total + per_page - 1) // per_page if total else 0

        posts = posts_query.order_by(desc(Post.created_at)).offset(
            (page - 1) * per_page
        ).limit(per_page).all()
        
        post_ids = [post.id for post in posts]

        # いいね数を一括で取得
        likes_counts = db.query(
            Like.post_id, func.count(Like.id).label('likes_count')
        ).filter(Like.post_id.in_(post_ids)).group_by(Like.post_id).all()
        likes_map = {post_id: count for post_id, count in likes_counts}

        # 現在のユーザーがいいねした投稿IDを一括で取得
        liked_post_ids = set()
        if current_user:
            user_likes = db.query(Like.post_id).filter(
                Like.user_id == current_user.id,
                Like.post_id.in_(post_ids)
            ).all()
            liked_post_ids = {like.post_id for like in user_likes}

        # Pydanticモデルに直接マッピング
        post_responses = []
        for post in posts:
            visible_replies = [
                reply
                for reply in post.replies
                if not reply.is_shadow_banned
                or (current_user and reply.user_id == current_user.id)
            ]
            response_data = {
                "id": post.id,
                "content": post.content,
                "user_id": post.user_id,
                # username は任意入力のため None の場合は id をフォールバック
                "author_username": post.author.username or post.author.id,
                "author_profile_image_url": post.author.profile_image_url,
                "thumbnail_url": post.thumbnail_url,
                "original_image_url": post.original_image_url,
                "video_url": post.video_url,
                "video_duration": post.video_duration,
                "shop_id": post.shop_id,
                "shop_name": post.shop.name if post.shop else None,
                "shop_address": post.shop.address if post.shop else None,
                "created_at": post.created_at,
                "likes_count": likes_map.get(post.id, 0),
                "replies_count": len(visible_replies),
                "replies": visible_replies,
                "is_liked_by_current_user": post.id in liked_post_ids,
                "is_shadow_banned": post.is_shadow_banned,
                "shadow_ban_reason": post.shadow_ban_reason,
            }
            post_responses.append(PostResponse.model_validate(response_data))
        
        return PostsResponse(
            posts=post_responses,
            total=total,
            pages=pages,
            current_page=page
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"投稿の取得に失敗しました: {e}"
        )

@router.get("/posts/{post_id}", response_model=PostResponse)
async def get_post(
    post_id: int,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """特定の投稿取得エンドポイント"""
    post = db.query(Post).options(
        joinedload(Post.author),
        joinedload(Post.replies).joinedload(Reply.author),
        joinedload(Post.shop)
    ).filter(Post.id == post_id).first()

    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="投稿が見つかりません"
        )

    if post.is_shadow_banned and (not current_user or current_user.id != post.user_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="投稿が見つかりません"
        )

    # いいね数を取得
    likes_count = db.query(Like).filter(Like.post_id == post_id).count()

    # 現在のユーザーがいいねしているか
    is_liked = False
    if current_user:
        is_liked = db.query(Like).filter(
            Like.user_id == current_user.id,
            Like.post_id == post_id
        ).first() is not None

    visible_replies = [
        reply
        for reply in post.replies
        if not reply.is_shadow_banned
        or (current_user and reply.user_id == current_user.id)
    ]

    response_data = {
        "id": post.id,
        "content": post.content,
        "user_id": post.user_id,
        # username は任意入力のため None の場合は id をフォールバック
        "author_username": post.author.username or post.author.id,
        "author_profile_image_url": post.author.profile_image_url,
        "thumbnail_url": post.thumbnail_url,
        "original_image_url": post.original_image_url,
        "video_url": post.video_url,
        "video_duration": post.video_duration,
        "shop_id": post.shop_id,
        "shop_name": post.shop.name if post.shop else None,
        "shop_address": post.shop.address if post.shop else None,
        "created_at": post.created_at,
        "likes_count": likes_count,
        "replies_count": len(visible_replies),
        "replies": visible_replies,
        "is_liked_by_current_user": is_liked,
        "is_shadow_banned": post.is_shadow_banned,
        "shadow_ban_reason": post.shadow_ban_reason,
    }
    
    return PostResponse.model_validate(response_data)

@router.delete("/posts/{post_id}", response_model=Dict[str, str])
async def delete_post(
    post_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """投稿削除エンドポイント"""
    post = db.query(Post).filter(Post.id == post_id).first()
    
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="投稿が見つかりません"
        )
    
    if post.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="この投稿を削除する権限がありません"
        )
    
    try:
        db.delete(post)
        db.commit()
        
        return {"message": "投稿を削除しました"}
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="投稿の削除に失敗しました"
        )

@router.get("/posts/user/{user_id}", response_model=PostsResponse)
async def get_user_posts(
    user_id: str,
    page: int = Query(1, ge=1, description="ページ番号"),
    per_page: int = Query(20, ge=1, le=100, description="1ページあたりの投稿数"),
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """特定のユーザーの投稿一覧取得エンドポイント"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="ユーザーが見つかりません"
        )
    
    try:
        base_query = db.query(Post).filter(Post.user_id == user_id)
        if not current_user or current_user.id != user_id:
            base_query = base_query.filter(Post.is_shadow_banned.is_(False))

        total = base_query.count()
        pages = (total + per_page - 1) // per_page

        posts_query = base_query.options(
            joinedload(Post.author),
            joinedload(Post.replies).joinedload(Reply.author),
            joinedload(Post.shop)
        )

        posts = posts_query.order_by(desc(Post.created_at)).offset(
            (page - 1) * per_page
        ).limit(per_page).all()

        post_ids = [post.id for post in posts]

        likes_counts = db.query(
            Like.post_id, func.count(Like.id).label('likes_count')
        ).filter(Like.post_id.in_(post_ids)).group_by(Like.post_id).all()
        likes_map = {post_id: count for post_id, count in likes_counts}

        liked_post_ids = set()
        if current_user:
            user_likes = db.query(Like.post_id).filter(
                Like.user_id == current_user.id,
                Like.post_id.in_(post_ids)
            ).all()
            liked_post_ids = {like.post_id for like in user_likes}

        post_responses = []
        for post in posts:
            visible_replies = [
                reply
                for reply in post.replies
                if not reply.is_shadow_banned
                or (current_user and reply.user_id == current_user.id)
            ]
            response_data = {
                "id": post.id,
                "content": post.content,
                "user_id": post.user_id,
                # username は任意入力のため None の場合は id をフォールバック
                "author_username": post.author.username or post.author.id,
                "author_profile_image_url": post.author.profile_image_url,
                "thumbnail_url": post.thumbnail_url,
                "original_image_url": post.original_image_url,
                "video_url": post.video_url,
                "video_duration": post.video_duration,
                "shop_id": post.shop_id,
                "shop_name": post.shop.name if post.shop else None,
                "shop_address": post.shop.address if post.shop else None,
                "created_at": post.created_at,
                "likes_count": likes_map.get(post.id, 0),
                "replies_count": len(visible_replies),
                "replies": visible_replies,
                "is_liked_by_current_user": post.id in liked_post_ids,
                "is_shadow_banned": post.is_shadow_banned,
                "shadow_ban_reason": post.shadow_ban_reason,
            }
            post_responses.append(PostResponse.model_validate(response_data))
        
        return PostsResponse(
            posts=post_responses,
            total=total,
            pages=pages,
            current_page=page
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"ユーザー投稿の取得に失敗しました: {e}"
        )

@router.delete("/posts/user/{user_id}", response_model=Dict[str, str])
async def delete_all_user_posts(
    user_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """特定のユーザーの全投稿を削除するエンドポイント（管理者用または自己ban用）"""
    # 管理者または本人のみが実行可能
    is_admin = getattr(current_user, "is_admin", False)
    if not is_admin and current_user.id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="この操作を実行する権限がありません"
        )
    
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="ユーザーが見つかりません"
        )
    
    try:
        # ユーザーの全投稿を削除
        deleted_count = db.query(Post).filter(Post.user_id == user_id).count()
        db.query(Post).filter(Post.user_id == user_id).delete()
        
        # 関連するいいねも削除（cascade設定で自動削除されるが明示的に実行）
        db.query(Like).filter(Like.post_id.in_(
            db.query(Post.id).filter(Post.user_id == user_id)
        )).delete(synchronize_session=False)
        
        db.commit()
        
        return {
            "message": f"ユーザー {user_id} の全投稿を削除しました",
            "deleted_count": deleted_count
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"投稿の削除に失敗しました: {e}"
        )