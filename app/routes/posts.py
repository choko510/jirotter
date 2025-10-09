from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import Dict, Any, List, Optional

from database import get_db
from app.models import Post, User
from app.schemas import PostCreate, PostResponse, PostsResponse
from app.utils.auth import get_current_user, get_current_active_user, get_current_user_optional

router = APIRouter(tags=["posts"])

@router.post("/posts", response_model=PostResponse, status_code=status.HTTP_201_CREATED)
async def create_post(
    post_data: PostCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """投稿作成エンドポイント"""
    if not post_data.content or not post_data.content.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="投稿内容は必須です"
        )
    
    if len(post_data.content) > 1000:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="投稿内容は1000文字以内で入力してください"
        )
    
    try:
        post = Post(
            content=post_data.content.strip(),
            user_id=current_user.id
        )
        
        db.add(post)
        db.commit()
        db.refresh(post)
        
        # レスポンスを作成してauthor_usernameを含める
        response_data = {
            "id": post.id,
            "content": post.content,
            "user_id": post.user_id,
            "author_username": post.author.username,
            "created_at": post.created_at
        }
        
        return PostResponse(**response_data)
        
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
        # 総投稿数
        total = db.query(Post).count()
        
        # 総ページ数
        pages = (total + per_page - 1) // per_page
        
        # 投稿の取得（作成日時で降順ソート）
        posts = db.query(Post).order_by(desc(Post.created_at)).offset(
            (page - 1) * per_page
        ).limit(per_page).all()
        
        # レスポンスデータの作成
        post_responses = []
        for post in posts:
            post_data = {
                "id": post.id,
                "content": post.content,
                "user_id": post.user_id,
                "author_username": post.author.username,
                "created_at": post.created_at
            }
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
            detail="投稿の取得に失敗しました"
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
    
    # レスポンスを作成してauthor_usernameを含める
    response_data = {
        "id": post.id,
        "content": post.content,
        "user_id": post.user_id,
        "author_username": post.author.username,
        "created_at": post.created_at
    }
    
    return PostResponse(**response_data)

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
    
    # 投稿の所有者のみ削除可能
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
    user_id: int,
    page: int = Query(1, ge=1, description="ページ番号"),
    per_page: int = Query(20, ge=1, le=100, description="1ページあたりの投稿数"),
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """特定のユーザーの投稿一覧取得エンドポイント"""
    # ユーザーの存在確認
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="ユーザーが見つかりません"
        )
    
    try:
        # 総投稿数
        total = db.query(Post).filter(Post.user_id == user_id).count()
        
        # 総ページ数
        pages = (total + per_page - 1) // per_page
        
        # 投稿の取得（作成日時で降順ソート）
        posts = db.query(Post).filter(Post.user_id == user_id).order_by(desc(Post.created_at)).offset(
            (page - 1) * per_page
        ).limit(per_page).all()
        
        # レスポンスデータの作成
        post_responses = []
        for post in posts:
            post_data = {
                "id": post.id,
                "content": post.content,
                "user_id": post.user_id,
                "author_username": post.author.username,
                "created_at": post.created_at
            }
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
            detail="ユーザー投稿の取得に失敗しました"
        )