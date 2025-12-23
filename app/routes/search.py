"""
横断検索API
店舗・ポスト・ユーザーを横断的に検索する
"""
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import Optional, List
from pydantic import BaseModel, ConfigDict
from datetime import datetime

from database import get_db
from app.models import RamenShop, Post, User
from app.utils.auth import get_current_user_optional

router = APIRouter(tags=["search"])


class ShopSearchResult(BaseModel):
    """検索結果の店舗"""
    model_config = ConfigDict(from_attributes=True)
    
    type: str = "shop"
    id: int
    name: str
    address: str
    
class PostSearchResult(BaseModel):
    """検索結果のポスト"""
    type: str = "post"
    id: int
    content: str
    author_id: str
    author_username: Optional[str] = None
    author_profile_image_url: Optional[str] = None
    shop_id: Optional[int] = None
    shop_name: Optional[str] = None
    thumbnail_url: Optional[str] = None
    created_at: datetime
    
class UserSearchResult(BaseModel):
    """検索結果のユーザー"""
    type: str = "user"
    id: str
    username: Optional[str] = None
    profile_image_url: Optional[str] = None
    bio: Optional[str] = None
    rank: str

class GlobalSearchResponse(BaseModel):
    """横断検索レスポンス"""
    query: str
    shops: List[ShopSearchResult]
    posts: List[PostSearchResult]
    users: List[UserSearchResult]
    total_shops: int
    total_posts: int
    total_users: int


@router.get("/search", response_model=GlobalSearchResponse)
async def global_search(
    q: str = Query(..., min_length=1, max_length=100, description="検索クエリ"),
    search_shops: bool = Query(True, description="店舗を検索するか"),
    search_posts: bool = Query(True, description="ポストを検索するか"),
    search_users: bool = Query(True, description="ユーザーを検索するか"),
    limit: int = Query(10, ge=1, le=50, description="各タイプの結果数上限"),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """
    横断検索エンドポイント
    
    店舗名/住所、ポスト内容、ユーザー名を横断的に検索する
    """
    query = q.strip()
    if not query:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="検索クエリが空です"
        )
    
    search_pattern = f"%{query}%"
    
    # 店舗検索
    shops: List[ShopSearchResult] = []
    total_shops = 0
    if search_shops:
        shop_query = db.query(RamenShop).filter(
            or_(
                RamenShop.name.ilike(search_pattern),
                RamenShop.address.ilike(search_pattern)
            )
        )
        total_shops = shop_query.count()
        shop_results = shop_query.limit(limit).all()
        shops = [
            ShopSearchResult(
                id=shop.id,
                name=shop.name,
                address=shop.address
            )
            for shop in shop_results
        ]
    
    # ポスト検索（シャドウバンされていないもののみ）
    posts: List[PostSearchResult] = []
    total_posts = 0
    if search_posts:
        post_query = db.query(Post).filter(
            Post.content.ilike(search_pattern),
            Post.is_shadow_banned == False
        ).order_by(Post.created_at.desc())
        
        total_posts = post_query.count()
        post_results = post_query.limit(limit).all()
        
        posts = []
        for post in post_results:
            # 店舗名を取得
            shop_name = None
            if post.shop_id and post.shop:
                shop_name = post.shop.name
            
            posts.append(PostSearchResult(
                id=post.id,
                content=post.content[:200] if len(post.content) > 200 else post.content,
                author_id=post.user_id,
                author_username=post.author_username,
                author_profile_image_url=post.author_profile_image_url,
                shop_id=post.shop_id,
                shop_name=shop_name,
                thumbnail_url=post.thumbnail_url,
                created_at=post.created_at
            ))
    
    # ユーザー検索（BANされていないユーザーのみ）
    users: List[UserSearchResult] = []
    total_users = 0
    if search_users:
        user_query = db.query(User).filter(
            or_(
                User.username.ilike(search_pattern),
                User.id.ilike(search_pattern),
                User.bio.ilike(search_pattern)
            ),
            User.account_status == 'active'
        )
        total_users = user_query.count()
        user_results = user_query.limit(limit).all()
        
        users = [
            UserSearchResult(
                id=user.id,
                username=user.username,
                profile_image_url=user.profile_image_url,
                bio=user.bio[:100] if user.bio and len(user.bio) > 100 else user.bio,
                rank=user.rank
            )
            for user in user_results
        ]
    
    return GlobalSearchResponse(
        query=query,
        shops=shops,
        posts=posts,
        users=users,
        total_shops=total_shops,
        total_posts=total_posts,
        total_users=total_users
    )


class SuggestionItem(BaseModel):
    """サジェストアイテム"""
    text: str
    type: str  # 'shop', 'user', 'keyword'
    id: Optional[int] = None  # 店舗の場合はID
    user_id: Optional[str] = None  # ユーザーの場合はID

class SuggestionsResponse(BaseModel):
    """サジェストレスポンス"""
    query: str
    suggestions: List[SuggestionItem]
    popular_shops: List[SuggestionItem]


@router.get("/search/suggest", response_model=SuggestionsResponse)
async def get_search_suggestions(
    q: str = Query("", max_length=50, description="検索クエリ（空の場合は人気のサジェストを返す）"),
    limit: int = Query(8, ge=1, le=20, description="サジェスト数上限"),
    db: Session = Depends(get_db)
):
    """
    検索サジェストエンドポイント
    
    入力に基づいて店舗名、ユーザー名をサジェストする。
    空のクエリの場合は人気の店舗をサジェストする。
    """
    query = q.strip()
    suggestions: List[SuggestionItem] = []
    popular_shops: List[SuggestionItem] = []
    
    if query:
        search_pattern = f"{query}%"  # 前方一致
        
        # 店舗名サジェスト（前方一致優先）
        shop_suggestions = db.query(RamenShop).filter(
            RamenShop.name.ilike(search_pattern)
        ).limit(limit // 2).all()
        
        for shop in shop_suggestions:
            suggestions.append(SuggestionItem(
                text=shop.name,
                type='shop',
                id=shop.id
            ))
        
        # ユーザー名サジェスト
        remaining = limit - len(suggestions)
        if remaining > 0:
            user_suggestions = db.query(User).filter(
                or_(
                    User.username.ilike(search_pattern),
                    User.id.ilike(search_pattern)
                ),
                User.account_status == 'active'
            ).limit(remaining).all()
            
            for user in user_suggestions:
                suggestions.append(SuggestionItem(
                    text=user.username or user.id,
                    type='user',
                    user_id=user.id
                ))
    
    # 人気の店舗（チェックイン数が多い店舗）
    from app.models import Checkin
    from sqlalchemy import func as sqlfunc
    from datetime import datetime, timedelta, timezone as tz
    
    one_month_ago = datetime.now(tz.utc) - timedelta(days=30)
    
    popular_shop_query = (
        db.query(RamenShop, sqlfunc.count(Checkin.id).label('checkin_count'))
        .outerjoin(Checkin, RamenShop.id == Checkin.shop_id)
        .filter(Checkin.checkin_date >= one_month_ago)
        .group_by(RamenShop.id)
        .order_by(sqlfunc.count(Checkin.id).desc())
        .limit(6)
        .all()
    )
    
    for shop, _ in popular_shop_query:
        popular_shops.append(SuggestionItem(
            text=shop.name,
            type='shop',
            id=shop.id
        ))
    
    return SuggestionsResponse(
        query=query,
        suggestions=suggestions,
        popular_shops=popular_shops
    )
