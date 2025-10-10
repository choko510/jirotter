from fastapi import APIRouter, Depends, HTTPException, status, Query, File, UploadFile, Form
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc
from typing import Dict, List, Optional
import shutil
import os
import uuid

from database import get_db
from app.models import Post, User, Like, Reply
from app.schemas import PostResponse, PostsResponse
from app.utils.auth import get_current_active_user, get_current_user_optional

router = APIRouter(tags=["posts"])

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

def _generate_unique_filename(filename: str) -> str:
    """ユニークなファイル名を生成します。"""
    ext = os.path.splitext(filename)[1]
    return f"{uuid.uuid4()}{ext}"

def _create_post_response(post: Post, liked_post_ids: set) -> PostResponse:
    """PostモデルからPostResponseモデルを生成します。"""
    post_response = PostResponse.model_validate(post)
    post_response.is_liked_by_current_user = post.id in liked_post_ids
    return post_response

@router.post("/posts", response_model=PostResponse, status_code=status.HTTP_201_CREATED)
async def create_post(
    content: str = Form(..., min_length=1, max_length=1000),
    image: Optional[UploadFile] = File(None),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    新しい投稿を作成します。

    - **content**: 投稿の本文 (1〜1000文字)
    - **image**: (任意) 投稿に添付する画像ファイル
    """
    image_url = None
    if image:
        if not image.content_type.startswith("image/"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="画像ファイルのみアップロードできます。"
            )
        unique_filename = _generate_unique_filename(image.filename)
        file_path = os.path.join(UPLOAD_DIR, unique_filename)
        
        try:
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(image.file, buffer)
            image_url = f"/{file_path}"
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="画像のアップロードに失敗しました。"
            )

    post = Post(
        content=content.strip(),
        user_id=current_user.id,
        image_url=image_url
    )

    db.add(post)
    db.commit()
    db.refresh(post)

    return post

@router.get("/posts", response_model=PostsResponse)
async def get_posts(
    page: int = Query(1, ge=1, description="ページ番号"),
    per_page: int = Query(20, ge=1, le=100, description="1ページあたりの投稿数"),
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """
    投稿の一覧をページネーション付きで取得します。
    パフォーマンス向上のため、N+1問題を回避する`joinedload`を使用しています。
    """
    base_query = db.query(Post)
    total = base_query.count()
    pages = (total + per_page - 1) // per_page

    posts_query = base_query.order_by(desc(Post.created_at)).options(
        joinedload(Post.author),
        joinedload(Post.replies).joinedload(Reply.author)
    ).offset((page - 1) * per_page).limit(per_page)

    posts = posts_query.all()

    liked_post_ids = set()
    if current_user:
        post_ids = [post.id for post in posts]
        likes = db.query(Like.post_id).filter(
            Like.user_id == current_user.id,
            Like.post_id.in_(post_ids)
        ).all()
        liked_post_ids = {like.post_id for like in likes}

    post_responses = [_create_post_response(post, liked_post_ids) for post in posts]

    return PostsResponse(
        posts=post_responses,
        total=total,
        pages=pages,
        current_page=page
    )

@router.get("/posts/{post_id}", response_model=PostResponse)
async def get_post(
    post_id: int,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """
    指定されたIDの投稿を一件取得します。
    関連データも同時に読み込み、効率化を図っています。
    """
    post = db.query(Post).options(
        joinedload(Post.author),
        joinedload(Post.replies).joinedload(Reply.author)
    ).filter(Post.id == post_id).first()
    
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="投稿が見つかりません"
        )
    
    liked_post_ids = set()
    if current_user:
        is_liked = db.query(Like.post_id).filter(
            Like.user_id == current_user.id,
            Like.post_id == post_id
        ).first()
        if is_liked:
            liked_post_ids.add(post_id)

    return _create_post_response(post, liked_post_ids)

@router.delete("/posts/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_post(
    post_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    指定されたIDの投稿を削除します。
    投稿者本人のみが削除可能です。
    """
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
    
    # 紐づく画像ファイルの削除
    if post.image_url:
        image_path = post.image_url.lstrip('/')
        if os.path.exists(image_path):
            os.remove(image_path)

    db.delete(post)
    db.commit()

    return None

@router.get("/posts/user/{user_id}", response_model=PostsResponse)
async def get_user_posts(
    user_id: str,
    page: int = Query(1, ge=1, description="ページ番号"),
    per_page: int = Query(20, ge=1, le=100, description="1ページあたりの投稿数"),
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """
    特定のユーザーの投稿一覧を取得します。
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="ユーザーが見つかりません"
        )
    
    base_query = db.query(Post).filter(Post.user_id == user_id)
    total = base_query.count()
    pages = (total + per_page - 1) // per_page

    posts_query = base_query.order_by(desc(Post.created_at)).options(
        joinedload(Post.author),
        joinedload(Post.replies).joinedload(Reply.author)
    ).offset((page - 1) * per_page).limit(per_page)

    posts = posts_query.all()

    liked_post_ids = set()
    if current_user:
        post_ids = [post.id for post in posts]
        if post_ids:
            likes = db.query(Like.post_id).filter(
                Like.user_id == current_user.id,
                Like.post_id.in_(post_ids)
            ).all()
            liked_post_ids = {like.post_id for like in likes}

    post_responses = [_create_post_response(post, liked_post_ids) for post in posts]

    return PostsResponse(
        posts=post_responses,
        total=total,
        pages=pages,
        current_page=page
    )