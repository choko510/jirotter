from fastapi import APIRouter, Depends, HTTPException, status, Query, File, UploadFile, Form
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc, func, or_
from typing import Dict, Any, List, Optional
import shutil
import os
import time

from database import get_db
from app.models import Post, User, Like, Reply, RamenShop, Follow
from app.schemas import PostCreate, PostResponse, PostsResponse
from app.utils.auth import get_current_user, get_current_active_user, get_current_user_optional
from app.utils.security import validate_post_content, escape_html
from app.utils.image_processor import process_image
from app.utils.image_validation import validate_image_file
from app.utils.video_validation import validate_video_file
from app.utils.scoring import ensure_user_can_post, reward_image_post

router = APIRouter(tags=["posts"])



UPLOAD_DIR = "uploads"
VIDEO_DIR = os.path.join(UPLOAD_DIR, "videos")
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(VIDEO_DIR, exist_ok=True)

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
    ensure_user_can_post(current_user, db)

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
            
            # 後方互換性のためにimage_urlにも設定
            image_url = thumbnail_url
            
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
            image_url=image_url,  # 後方互換性
            thumbnail_url=thumbnail_url,
            original_image_url=original_image_url,
            video_url=video_url,
            video_duration=processed_video_duration,
            shop_id=shop_id
        )

        db.add(post)
        db.commit()
        db.refresh(post)

        if original_image_url:
            try:
                reward_image_post(db, current_user)
                db.commit()
            except Exception as exc:
                db.rollback()
                print(f"画像投稿のスコア更新に失敗しました: {exc}")

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
            response_data = {
                "id": post.id,
                "content": post.content,
                "user_id": post.user_id,
                "author_username": post.author.username,
                "author_profile_image_url": post.author.profile_image_url,
                "image_url": post.image_url,  # 後方互換性
                "thumbnail_url": post.thumbnail_url,
                "original_image_url": post.original_image_url,
                "video_url": post.video_url,
                "video_duration": post.video_duration,
                "shop_id": post.shop_id,
                "shop_name": post.shop.name if post.shop else None,
                "shop_address": post.shop.address if post.shop else None,
                "created_at": post.created_at,
                "likes_count": likes_map.get(post.id, 0),
                "replies_count": len(post.replies),
                "replies": post.replies,
                "is_liked_by_current_user": post.id in liked_post_ids,
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
    
    # いいね数を取得
    likes_count = db.query(Like).filter(Like.post_id == post_id).count()

    # 現在のユーザーがいいねしているか
    is_liked = False
    if current_user:
        is_liked = db.query(Like).filter(
            Like.user_id == current_user.id,
            Like.post_id == post_id
        ).first() is not None

    response_data = {
        "id": post.id,
        "content": post.content,
        "user_id": post.user_id,
        "author_username": post.author.username,
        "author_profile_image_url": post.author.profile_image_url,
        "image_url": post.image_url,  # 後方互換性
        "thumbnail_url": post.thumbnail_url,
        "original_image_url": post.original_image_url,
        "video_url": post.video_url,
        "video_duration": post.video_duration,
        "shop_id": post.shop_id,
        "shop_name": post.shop.name if post.shop else None,
        "shop_address": post.shop.address if post.shop else None,
        "created_at": post.created_at,
        "likes_count": likes_count,
        "replies_count": len(post.replies),
        "replies": post.replies,
        "is_liked_by_current_user": is_liked,
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
        total = db.query(Post).filter(Post.user_id == user_id).count()
        pages = (total + per_page - 1) // per_page
        
        posts_query = db.query(Post).filter(Post.user_id == user_id).options(
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
            response_data = {
                "id": post.id,
                "content": post.content,
                "user_id": post.user_id,
                "author_username": post.author.username,
                "author_profile_image_url": post.author.profile_image_url,
                "image_url": post.image_url,  # 後方互換性
                "thumbnail_url": post.thumbnail_url,
                "original_image_url": post.original_image_url,
                "video_url": post.video_url,
                "video_duration": post.video_duration,
                "shop_id": post.shop_id,
                "shop_name": post.shop.name if post.shop else None,
                "shop_address": post.shop.address if post.shop else None,
                "created_at": post.created_at,
                "likes_count": likes_map.get(post.id, 0),
                "replies_count": len(post.replies),
                "replies": post.replies,
                "is_liked_by_current_user": post.id in liked_post_ids,
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