from typing import List, Tuple
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.models import Checkin, User, Follow

def get_user_recommendations(db: Session, user: User, limit: int = 20) -> List[User]:
    """
    ユーザーへのおすすめユーザーを取得する。
    アルゴリズム:
    1. 自分のチェックイン回数が多い上位3店舗を取得 (Top 3 Favorite Shops)
    2. その店舗にチェックインしている他のユーザーを取得
    3. 重複チェックイン数が多い順にソートして返す

    Args:
        db: データベースセッション
        user: 対象ユーザー
        limit: 取得上限

    Returns:
        List[User]: おすすめユーザーのリスト
    """

    # 1. 自分の上位3店舗を取得
    top_shops = (
        db.query(Checkin.shop_id)
        .filter(Checkin.user_id == user.id)
        .group_by(Checkin.shop_id)
        .order_by(func.count(Checkin.id).desc())
        .limit(3)
        .all()
    )

    if not top_shops:
        return []

    shop_ids = [shop_id for (shop_id,) in top_shops]

    # 2. その店舗にチェックインしている他のユーザーを集計
    # 自分自身と、既にフォローしているユーザーは除外する

    # フォロー済みユーザーIDのサブクエリ
    followed_user_ids = (
        db.query(Follow.followed_id)
        .filter(Follow.follower_id == user.id)
    )

    recommended_users_query = (
        db.query(User, func.count(Checkin.id).label("match_count"))
        .join(Checkin, Checkin.user_id == User.id)
        .filter(
            Checkin.shop_id.in_(shop_ids),
            User.id != user.id,
            User.id.not_in(followed_user_ids)
        )
        .group_by(User.id)
        .order_by(func.count(Checkin.id).desc())
        .limit(limit)
    )

    recommended_users_with_score = recommended_users_query.all()

    # Userオブジェクトのみのリストを返す
    return [u for u, score in recommended_users_with_score]
