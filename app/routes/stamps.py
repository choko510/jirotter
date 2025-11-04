from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func, distinct

from database import get_db
from app.models import RamenShop, Checkin, User, Visit
from app.schemas import StampProgressResponse, VisitedShopsResponse, VisitedShopsByPrefecture, VisitedShopItem
from app.utils.auth import get_current_user

router = APIRouter(tags=["stamps"])

# 都道府県リスト (日本の主な都道府県)
PREFECTURES = [
    '北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県',
    '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県',
    '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県', '岐阜県', '静岡県', '愛知県',
    '三重県', '滋賀県', '京都府', '大阪府', '兵庫県', '奈良県', '和歌山県',
    '鳥取県', '島根県', '岡山県', '広島県', '山口県',
    '徳島県', '香川県', '愛媛県', '高知県',
    '福岡県', '佐賀県', '長崎県', '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県'
]

@router.get("/stamps/progress", response_model=StampProgressResponse)
async def get_stamp_rally_progress(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    都道府県ごとのスタンプラリーの進捗状況を取得する。
    """
    try:
        # 1. 全店舗のIDと住所を取得
        all_shops = db.query(RamenShop.id, RamenShop.address).all()

        # 2. ユーザーがチェックインした店舗IDのセットを取得
        visited_shop_ids = {
            row[0] for row in db.query(Checkin.shop_id).filter(Checkin.user_id == current_user.id).distinct().all()
        }

        # 3. Python側で集計
        total_shops_map = {pref: 0 for pref in PREFECTURES}
        visited_shops_map = {pref: 0 for pref in PREFECTURES}

        for shop_id, address in all_shops:
            for pref in PREFECTURES:
                if pref in address:
                    total_shops_map[pref] += 1
                    if shop_id in visited_shop_ids:
                        visited_shops_map[pref] += 1
                    break

        # 4. レスポンスデータを構築
        progress_data = []
        for pref in PREFECTURES:
            if total_shops_map[pref] > 0:
                progress_data.append({
                    "prefecture": pref,
                    "total_shops": total_shops_map[pref],
                    "visited_shops": visited_shops_map[pref]
                })

        # 訪問済み店舗が多い順、次に総店舗数が多い順でソート
        progress_data.sort(key=lambda x: (x['visited_shops'], x['total_shops']), reverse=True)

        return StampProgressResponse(progress=progress_data)

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"進捗の取得に失敗しました: {str(e)}"
        )


@router.get("/stamps/visited", response_model=VisitedShopsResponse)
async def get_visited_shops(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    ユーザーが訪問済みの店舗を都道府県別にグループ化して取得する。
    """
    try:
        # 1. ユーザーのチェックインデータを取得（店舗情報と結合）
        checkins_with_shops = db.query(Checkin, RamenShop).join(
            RamenShop, Checkin.shop_id == RamenShop.id
        ).filter(
            Checkin.user_id == current_user.id
        ).all()

        # 2. ユーザーの訪問記録を取得（画像用）
        visits = db.query(Visit).filter(
            Visit.user_id == current_user.id
        ).all()

        # 訪問画像を店舗IDごとにグループ化
        visit_images_by_shop = {}
        for visit in visits:
            if visit.shop_id not in visit_images_by_shop:
                visit_images_by_shop[visit.shop_id] = []
            if visit.image_url and visit.image_url not in visit_images_by_shop[visit.shop_id]:
                visit_images_by_shop[visit.shop_id].append(visit.image_url)

        # 3. 都道府県別に店舗をグループ化
        prefecture_shops = {pref: [] for pref in PREFECTURES}
        
        for checkin, shop in checkins_with_shops:
            # 都道府県を判定
            shop_prefecture = None
            for pref in PREFECTURES:
                if pref in shop.address:
                    shop_prefecture = pref
                    break
            
            if shop_prefecture:
                # 訪問画像を取得（最大4件）
                shop_images = visit_images_by_shop.get(shop.id, [])[:4]
                
                visited_shop = VisitedShopItem(
                    id=shop.id,
                    name=shop.name,
                    address=shop.address,
                    checkin_date=checkin.checkin_date,
                    visit_images=shop_images
                )
                prefecture_shops[shop_prefecture].append(visited_shop)

        # 4. レスポンスデータを構築
        visited_shops_data = []
        total_shops = 0
        
        for pref in PREFECTURES:
            if prefecture_shops[pref]:
                visited_shops_data.append(VisitedShopsByPrefecture(
                    prefecture=pref,
                    shops=prefecture_shops[pref]
                ))
                total_shops += len(prefecture_shops[pref])

        return VisitedShopsResponse(
            visited_shops=visited_shops_data,
            total_shops=total_shops
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"訪問済み店舗の取得に失敗しました: {str(e)}"
        )
