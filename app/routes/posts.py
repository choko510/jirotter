from fastapi import APIRouter, Depends, HTTPException, status, Query, File, UploadFile, Form
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import Dict, Any, List, Optional
import shutil
import os

from database import get_db
from app.models import Post, User, Like, Reply
from app.schemas import PostCreate, PostResponse, PostsResponse
from app.utils.auth import get_current_user, get_current_active_user, get_current_user_optional

router = APIRouter(tags=["posts"])

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/posts", response_model=PostResponse, status_code=status.HTTP_201_CREATED)
async def create_post(
    content: str = Form(...),
    image: Optional[UploadFile] = File(None),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """投稿作成エンドポイント"""
    if not content or not content.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="投稿内容は必須です"
        )
    
    if len(content) > 1000:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="投稿内容は1000文字以内で入力してください"
        )
    
    image_url = None
    if image:
        file_path = os.path.join(UPLOAD_DIR, image.filename)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(image.file, buffer)
        image_url = f"/{file_path}"

    try:
        post = Post(
            content=content.strip(),
            user_id=current_user.id,
            image_url=image_url
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
        
        posts = db.query(Post).order_by(desc(Post.created_at)).offset(
            (page - 1) * per_page
        ).limit(per_page).all()
        
        liked_post_ids = set()
        if current_user:
            likes = db.query(Like.post_id).filter(Like.user_id == current_user.id).all()
            liked_post_ids = {like.post_id for like in likes}

        post_responses = []
        for post in posts:
            post_data = post.to_dict()
            post_data['is_liked_by_current_user'] = post.id in liked_post_ids
            post_data['replies'] = [reply.to_dict() for reply in post.replies]
            post_responses.append(PostResponse(**post_data))
        
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
    post = db.query(Post).filter(Post.id == post_id).first()
    
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="投稿が見つかりません"
        )
    
    liked_post_ids = set()
    if current_user:
        likes = db.query(Like.post_id).filter(Like.user_id == current_user.id, Like.post_id == post_id).first()
        if likes:
            liked_post_ids.add(likes.post_id)

    post_data = post.to_dict()
    post_data['is_liked_by_current_user'] = post.id in liked_post_ids
    post_data['replies'] = [reply.to_dict() for reply in post.replies]
    
    return PostResponse(**post_data)

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
        
        posts = db.query(Post).filter(Post.user_id == user_id).order_by(desc(Post.created_at)).offset(
            (page - 1) * per_page
        ).limit(per_page).all()
        
        liked_post_ids = set()
        if current_user:
            user_posts_ids = [post.id for post in posts]
            likes = db.query(Like.post_id).filter(Like.user_id == current_user.id, Like.post_id.in_(user_posts_ids)).all()
            liked_post_ids = {like.post_id for like in likes}

        post_responses = []
        for post in posts:
            post_data = post.to_dict()
            post_data['is_liked_by_current_user'] = post.id in liked_post_ids
            post_data['replies'] = [reply.to_dict() for reply in post.replies]
            post_responses.append(PostResponse(**post_data))
        
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