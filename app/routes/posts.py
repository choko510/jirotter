from fastapi import APIRouter, Depends, HTTPException, status, Query, File, UploadFile, Form
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc, func
from typing import Dict, Any, List, Optional
import shutil
import os

from database import get_db
from app.models import Post, User, Like, Reply, RamenShop
from app.schemas import PostCreate, PostResponse, PostsResponse
from app.utils.auth import get_current_user, get_current_active_user, get_current_user_optional
from app.utils.security import validate_post_content, escape_html

router = APIRouter(tags=["posts"])

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/posts", response_model=PostResponse, status_code=status.HTTP_201_CREATED)
async def create_post(
    content: str = Form(...),
    image: Optional[UploadFile] = File(None),
    shop_id: Optional[int] = Form(None),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """投稿作成エンドポイント"""
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
    if image:
        file_path = os.path.join(UPLOAD_DIR, image.filename)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(image.file, buffer)
        image_url = f"/{file_path}"

    try:
        post = Post(
            content=sanitized_content,
            user_id=current_user.id,
            image_url=image_url,
            shop_id=shop_id
        )
        
        db.add(post)
        db.commit()
        db.refresh(post)
        
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
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """投稿一覧取得エンドポイント"""
    try:
        total = db.query(Post).count()
        pages = (total + per_page - 1) // per_page
        
        # N+1問題を解決するためにeager loadingを使用
        posts_query = db.query(Post).options(
            joinedload(Post.author),
            joinedload(Post.replies).joinedload(Reply.author),
            joinedload(Post.shop)
        )

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
                "image_url": post.image_url,
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
        "image_url": post.image_url,
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
                "image_url": post.image_url,
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