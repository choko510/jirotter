from fastapi import APIRouter, Depends, HTTPException, status, Query, File, UploadFile, Form
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc, func
from typing import Dict, Any, List, Optional
import shutil
import os
import time
import imghdr
import tempfile
from PIL import Image
from PIL.ExifTags import TAGS
import io

from database import get_db
from app.models import Post, User, Like, Reply, RamenShop
from app.schemas import PostCreate, PostResponse, PostsResponse
from app.utils.auth import get_current_user, get_current_active_user, get_current_user_optional
from app.utils.security import validate_post_content, escape_html

router = APIRouter(tags=["posts"])


def validate_image_file(image: UploadFile) -> Dict[str, Any]:
    """
    アップロードされた画像ファイルを検証する
    
    Args:
        image: アップロードされたファイル
        
    Returns:
        検証結果を含む辞書
    """
    # 許可するMIMEタイプ
    allowed_mime_types = [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/gif',
        'image/webp'
    ]
    
    # ファイルサイズ上限（5MB）
    max_size_in_bytes = 5 * 1024 * 1024
    
    # ファイル名チェック
    if not image.filename:
        return {
            "is_valid": False,
            "error": "ファイル名がありません"
        }
    
    # 拡張子チェック
    allowed_extensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp']
    file_extension = os.path.splitext(image.filename)[1].lower()
    
    if file_extension not in allowed_extensions:
        return {
            "is_valid": False,
            "error": "対応している画像形式はJPEG、PNG、GIF、WebPのみです"
        }
    
    # 危険な拡張子チェック
    dangerous_extensions = ['.php', '.js', '.exe', '.bat', '.cmd', '.sh', '.py', '.pl', '.rb']
    for ext in dangerous_extensions:
        if image.filename.lower().endswith(ext):
            return {
                "is_valid": False,
                "error": "このファイル形式は許可されていません"
            }
    
    # ファイルサイズチェック
    if hasattr(image, 'size') and image.size and image.size > max_size_in_bytes:
        return {
            "is_valid": False,
            "error": "画像サイズは5MB以下にしてください"
        }
    
    # MIMEタイプチェック（ファイルの先頭部分を読み込んで検証）
    try:
        # ファイルの先頭部分を読み込んでMIMEタイプを検証
        file_position = image.file.tell()
        image.file.seek(0)
        file_header = image.file.read(1024)  # 最初の1KBを読み込む
        image.file.seek(file_position)  # ファイルポインタを元の位置に戻す
        
        # 一時ファイルを作成してimghdrで画像形式を検証
        with tempfile.NamedTemporaryFile(delete=False) as temp_file:
            temp_file.write(file_header)
            temp_file_path = temp_file.name
        
        try:
            # imghdrを使用して画像形式を検出
            image_type = imghdr.what(temp_file_path)
            
            # 拡張子と検出された画像形式が一致するか確認
            if image_type:
                detected_mime = f"image/{image_type}"
                if image_type == 'jpg':
                    detected_mime = 'image/jpeg'
                
                if detected_mime not in allowed_mime_types:
                    return {
                        "is_valid": False,
                        "error": f"ファイルの内容が対応している画像形式ではありません: {detected_mime}"
                    }
            else:
                # imghdrで画像形式を検出できない場合でも、拡張子ベースのチェックは行っているため続行
                pass
        finally:
            # 一時ファイルを削除
            os.unlink(temp_file_path)
    except Exception as e:
        # 画像形式検出に失敗した場合でも、拡張子ベースのチェックは行っているため続行
        print(f"画像形式検出エラー: {e}")
    
    # 詳細な画像検証
    try:
        # ファイル全体を読み込んで詳細な検証を行う
        file_position = image.file.tell()
        image.file.seek(0)
        file_content = image.file.read()
        image.file.seek(file_position)
        
        # PILを使用して画像を検証
        validation_result = validate_image_content(file_content)
        if not validation_result["is_valid"]:
            return validation_result
            
    except Exception as e:
        print(f"詳細画像検証エラー: {e}")
        return {
            "is_valid": False,
            "error": "画像の検証に失敗しました。もう一度お試しください。"
        }
    
    return {
        "is_valid": True,
        "error": None
    }


def validate_image_content(file_content: bytes) -> Dict[str, Any]:
    """
    画像の内容を詳細に検証する
    
    Args:
        file_content: 画像ファイルのバイナリデータ
        
    Returns:
        検証結果を含む辞書
    """
    try:
        # バイナリデータから画像を読み込む
        with Image.open(io.BytesIO(file_content)) as img:
            # 画像の解像度を検証
            resolution_validation = validate_image_resolution(img)
            if not resolution_validation["is_valid"]:
                return resolution_validation
            
            # 画像のアスペクト比を検証
            aspect_ratio_validation = validate_image_aspect_ratio(img)
            if not aspect_ratio_validation["is_valid"]:
                return aspect_ratio_validation
            
            # EXIFデータを検証
            exif_validation = validate_image_exif(img)
            if not exif_validation["is_valid"]:
                return exif_validation
            
            # 画像の品質を検証
            quality_validation = validate_image_quality(img)
            if not quality_validation["is_valid"]:
                return quality_validation
            
            # 偽装画像を検出
            spoofing_validation = validate_image_spoofing(img)
            if not spoofing_validation["is_valid"]:
                return spoofing_validation
                
    except Exception as e:
        print(f"画像内容検証エラー: {e}")
        return {
            "is_valid": False,
            "error": "画像ファイルが破損しているか、サポートされていない形式です"
        }
    
    return {
        "is_valid": True,
        "error": None
    }


def validate_image_resolution(img: Image.Image) -> Dict[str, Any]:
    """
    画像の解像度を検証する
    
    Args:
        img: PIL Imageオブジェクト
        
    Returns:
        検証結果を含む辞書
    """
    # 最小解像度: 100x100
    min_width = 100
    min_height = 100
    
    # 最大解像度: 4096x4096
    max_width = 4096
    max_height = 4096
    
    width, height = img.size
    
    if width < min_width or height < min_height:
        return {
            "is_valid": False,
            "error": f"画像サイズが小さすぎます。最小サイズは{min_width}x{min_height}pxです"
        }
    
    if width > max_width or height > max_height:
        return {
            "is_valid": False,
            "error": f"画像サイズが大きすぎます。最大サイズは{max_width}x{max_height}pxです"
        }
    
    return {
        "is_valid": True,
        "error": None
    }


def validate_image_aspect_ratio(img: Image.Image) -> Dict[str, Any]:
    """
    画像のアスペクト比を検証する
    
    Args:
        img: PIL Imageオブジェクト
        
    Returns:
        検証結果を含む辞書
    """
    # 極端なアスペクト比を拒否（1:10 または 10:1 以上）
    max_aspect_ratio = 10
    
    width, height = img.size
    aspect_ratio = max(width / height, height / width)
    
    if aspect_ratio > max_aspect_ratio:
        return {
            "is_valid": False,
            "error": "極端に細長い画像はアップロードできません"
        }
    
    return {
        "is_valid": True,
        "error": None
    }


def validate_image_exif(img: Image.Image) -> Dict[str, Any]:
    """
    画像のEXIFデータを検証する
    
    Args:
        img: PIL Imageオブジェクト
        
    Returns:
        検証結果を含む辞書
    """
    try:
        # EXIFデータを取得
        exif_data = img._getexif()
        
        if exif_data:
            # 危険なソフトウェア情報をチェック
            for tag_id, value in exif_data.items():
                tag = TAGS.get(tag_id, tag_id)
                
                if tag == "Software":
                    if isinstance(value, str):
                        dangerous_software = [
                            'exiftool',
                            'exif editor',
                            'metadata editor',
                            'photo editor'
                        ]
                        
                        software = value.lower()
                        for dangerous in dangerous_software:
                            if software.find(dangerous) != -1:
                                return {
                                    "is_valid": False,
                                    "error": "編集された画像はアップロードできません"
                                }
                
                # GPS情報が含まれている場合はログに記録
                if tag == "GPSInfo":
                    print("GPS情報を含む画像がアップロードされました")
                    
    except Exception as e:
        print(f"EXIFデータ検証エラー: {e}")
        # EXIFデータの検証に失敗しても続行
    
    return {
        "is_valid": True,
        "error": None
    }


def validate_image_quality(img: Image.Image) -> Dict[str, Any]:
    """
    画像の品質を検証する
    
    Args:
        img: PIL Imageオブジェクト
        
    Returns:
        検証結果を含む辞書
    """
    try:
        # 画像モードをチェック
        if img.mode not in ['RGB', 'RGBA', 'L', 'P']:
            return {
                "is_valid": False,
                "error": "サポートされていない画像モードです"
            }
        
        # 画像の色数をチェック（パレット画像の場合）
        if img.mode == 'P':
            palette = img.getpalette()
            if palette:
                # パレットの長さをチェック（最大256色）
                if len(palette) < 3 * 16:  # 少なくとも16色
                    return {
                        "is_valid": False,
                        "error": "画像の色数が少なすぎます"
                    }
        
        # 画像のヒストグラムをチェック（極端な品質の画像を検出）
        if img.mode in ['RGB', 'RGBA']:
            # ヒストグラムを計算
            histogram = img.histogram()
            
            # ヒストグラムの平坦さをチェック（単色に近い画像を検出）
            if len(histogram) > 0:
                # ヒストグラムの分散を計算
                total_pixels = sum(histogram)
                if total_pixels > 0:
                    # ヒストグラムの分散が非常に小さい場合は単色に近い画像
                    variance = sum((x - total_pixels/len(histogram))**2 for x in histogram) / len(histogram)
                    mean = total_pixels / len(histogram)
                    
                    # 分散が平均の1%未満の場合は単色に近い画像
                    if mean > 0 and variance < mean * 0.01:
                        return {
                            "is_valid": False,
                            "error": "単色に近い画像はアップロードできません"
                        }
                        
    except Exception as e:
        print(f"画像品質検証エラー: {e}")
        # 品質検証に失敗しても続行
    
    return {
        "is_valid": True,
        "error": None
    }


def validate_image_spoofing(img: Image.Image) -> Dict[str, Any]:
    """
    偽装画像を検出する
    
    Args:
        img: PIL Imageオブジェクト
        
    Returns:
        検証結果を含む辞書
    """
    try:
        # 画像のファイル形式と拡張子の一致を確認
        # この検証は既にvalidate_image_fileで行っているため、追加の検証を実施
        
        # 画像のメタデータをチェック
        if hasattr(img, 'info') and img.info:
            # 異常なメタデータをチェック
            for key, value in img.info.items():
                if isinstance(key, str) and isinstance(value, str):
                    # 危険な可能性のあるメタデータをチェック
                    dangerous_patterns = [
                        '<script',
                        'javascript:',
                        'vbscript:',
                        'data:text/html',
                        'data:application',
                        'data:image/svg+xml'
                    ]
                    
                    for pattern in dangerous_patterns:
                        if pattern in value.lower():
                            return {
                                "is_valid": False,
                                "error": "危険なメタデータが含まれています"
                            }
        
        # 画像の構造をチェック（異常に小さい画像や異常に大きな画像を検出）
        width, height = img.size
        pixel_count = width * height
        
        # 異常に小さい画像（10x10ピクセル未満）
        if pixel_count < 100:
            return {
                "is_valid": False,
                "error": "画像が小さすぎます"
            }
            
        # 異常に大きな画像（100メガピクセル超）
        if pixel_count > 100 * 1024 * 1024:
            return {
                "is_valid": False,
                "error": "画像が大きすぎます"
            }
            
    except Exception as e:
        print(f"偽装画像検証エラー: {e}")
        # 偽装画像検証に失敗しても続行
    
    return {
        "is_valid": True,
        "error": None
    }

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
        # ファイルバリデーション
        validation_result = validate_image_file(image)
        if not validation_result["is_valid"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=validation_result["error"]
            )
        
        # 安全なファイル名を生成
        file_extension = os.path.splitext(image.filename)[1].lower()
        safe_filename = f"{current_user.id}_{int(time.time())}{file_extension}"
        file_path = os.path.join(UPLOAD_DIR, safe_filename)
        
        try:
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(image.file, buffer)
            image_url = f"/{file_path}"
        except Exception as e:
            # ファイル書き込みエラーの場合、一時ファイルがあれば削除
            if os.path.exists(file_path):
                os.remove(file_path)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="画像の保存に失敗しました"
            )

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
    timeline_type: str = Query("recommend", description="タイムラインの種類: recommend または following"),
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """投稿一覧取得エンドポイント"""
    try:
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
            
            # フォロー中のユーザーの投稿を取得
            posts_query = db.query(Post).filter(
                Post.user_id.in_(following_ids)
            ).options(
                joinedload(Post.author),
                joinedload(Post.replies).joinedload(Reply.author),
                joinedload(Post.shop)
            )
            
            total = db.query(Post).filter(
                Post.user_id.in_(following_ids)
            ).count()
        else:
            # おすすめタイムライン（全投稿）
            total = db.query(Post).count()
            
            # N+1問題を解決するためにeager loadingを使用
            posts_query = db.query(Post).options(
                joinedload(Post.author),
                joinedload(Post.replies).joinedload(Reply.author),
                joinedload(Post.shop)
            )
        
        pages = (total + per_page - 1) // per_page

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