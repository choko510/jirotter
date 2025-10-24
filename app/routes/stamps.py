from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func, distinct

from database import get_db
from app.models import RamenShop, Checkin, User
from app.schemas import StampProgressResponse
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
        # 1. 各都道府県の総店舗数を計算
        total_shops_by_prefecture = {}
        for pref in PREFECTURES:
            count = db.query(RamenShop).filter(RamenShop.address.like(f"%{pref}%")).count()
            if count > 0:
                total_shops_by_prefecture[pref] = count

        # 2. ユーザーがチェックインした店舗を都道府県ごとに集計
        checked_in_shops_by_prefecture = {}
        checked_in_shops = (
            db.query(RamenShop.address)
            .join(Checkin, Checkin.shop_id == RamenShop.id)
            .filter(Checkin.user_id == current_user.id)
            .distinct()
            .all()
        )

        for address_tuple in checked_in_shops:
            address = address_tuple[0]
            for pref in PREFECTURES:
                if pref in address:
                    checked_in_shops_by_prefecture[pref] = checked_in_shops_by_prefecture.get(pref, 0) + 1
                    break

        # 3. レスポンスデータを構築
        progress_data = []
        for pref, total in total_shops_by_prefecture.items():
            checked_in = checked_in_shops_by_prefecture.get(pref, 0)
            progress_data.append({
                "prefecture": pref,
                "total_shops": total,
                "visited_shops": checked_in
            })

        # 訪問済み店舗が多い順、次に総店舗数が多い順でソート
        progress_data.sort(key=lambda x: (x['visited_shops'], x['total_shops']), reverse=True)

        return StampProgressResponse(progress=progress_data)

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"進捗の取得に失敗しました: {str(e)}"
        )
