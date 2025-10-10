from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
import math
import csv
import os

from database import get_db
from app.models import RamenShop
from app.schemas import RamenShopResponse, RamenShopsResponse

router = APIRouter(tags=["ramen"])

def load_ramen_data_on_startup(db: Session):
    """
    アプリケーション起動時にCSVからラーメン店データを読み込み、データベースに保存します。
    データが既に存在する場合は、読み込みをスキップします。
    """
    if db.query(RamenShop).count() > 0:
        print("ラーメン店のデータは既に存在するため、読み込みをスキップしました。")
        return
    
    csv_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "ramen.csv")
    
    if not os.path.exists(csv_path):
        print(f"CSVファイルが見つかりません: {csv_path}")
        return

    try:
        with open(csv_path, 'r', encoding='utf-8-sig') as file:
            csv_reader = csv.DictReader(file)
            shops_to_add = []
            for row in csv_reader:
                try:
                    shops_to_add.append(
                        RamenShop(
                            name=row['店名'],
                            address=row['住所'],
                            business_hours=row.get('営業時間'),
                            closed_day=row.get('定休日'),
                            seats=row.get('座席'),
                            latitude=float(row['緯度']),
                            longitude=float(row['経度'])
                        )
                    )
                except (ValueError, KeyError) as e:
                    print(f"CSVデータの解析エラーのため、行をスキップしました: {row} - {e}")
                    continue
            
            db.bulk_save_objects(shops_to_add)
            db.commit()
            print(f"{len(shops_to_add)}軒のラーメン店データを正常に読み込みました。")
    except Exception as e:
        db.rollback()
        print(f"ラーメン店データの読み込み中にエラーが発生しました: {e}")

@router.get("/ramen/nearby", response_model=RamenShopsResponse)
async def get_nearby_ramen_shops(
    latitude: float = Query(..., description="検索中心の緯度"),
    longitude: float = Query(..., description="検索中心の経度"),
    radius_km: float = Query(5.0, ge=0.1, le=50.0, description="検索範囲（km）"),
    db: Session = Depends(get_db)
):
    """
    指定された位置情報から半径nkm以内のラーメン店を検索し、距離が近い順に返します。
    距離計算はデータベース上で行われるため、効率的な検索が可能です。
    """
    R = 6371.0  # 地球の半径 (km)
    lat_rad = math.radians(latitude)
    lon_rad = math.radians(longitude)

    shop_lat_rad = func.radians(RamenShop.latitude)
    shop_lon_rad = func.radians(RamenShop.longitude)

    dlat = shop_lat_rad - lat_rad
    dlon = shop_lon_rad - lon_rad

    a = (func.sin(dlat / 2) * func.sin(dlat / 2) +
         func.cos(lat_rad) * func.cos(shop_lat_rad) *
         func.sin(dlon / 2) * func.sin(dlon / 2))

    c = 2 * func.atan2(func.sqrt(a), func.sqrt(1 - a))
    distance_col = (R * c).label('distance')

    nearby_shops_query = (
        db.query(RamenShop, distance_col)
          .filter(distance_col <= radius_km)
          .order_by(distance_col.asc())
    )

    results = nearby_shops_query.all()

    shop_responses = []
    for shop, distance in results:
        shop_response = RamenShopResponse.model_validate(shop)
        shop_response.distance = round(distance, 2)
        shop_responses.append(shop_response)

    return RamenShopsResponse(
        shops=shop_responses,
        total=len(shop_responses)
    )

@router.get("/ramen", response_model=RamenShopsResponse)
async def get_ramen_shops(
    keyword: Optional[str] = Query(None, description="店名での検索キーワード"),
    db: Session = Depends(get_db)
):
    """
    全てのラーメン店一覧を取得します。
    キーワードが指定された場合は、店名にキーワードを含む店舗のみを返します。
    """
    query = db.query(RamenShop)
    if keyword:
        query = query.filter(RamenShop.name.ilike(f"%{keyword}%"))

    all_shops = query.order_by(RamenShop.id).all()

    shop_responses = [RamenShopResponse.model_validate(shop) for shop in all_shops]

    return RamenShopsResponse(
        shops=shop_responses,
        total=len(shop_responses)
    )