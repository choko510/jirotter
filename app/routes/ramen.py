from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional, Tuple
import math
import csv
import os
from datetime import datetime, timedelta, timezone

from database import get_db
from app.models import RamenShop, Checkin
from app.schemas import RamenShopResponse, RamenShopsResponse

router = APIRouter(tags=["ramen"])


def _build_bounding_box(latitude: float, longitude: float, radius_km: float) -> Tuple[float, float, float, float]:
    """
    Haversine距離計算前に緯度・経度の範囲で候補を絞り込むバウンディングボックスを生成する。
    """
    earth_radius_km = 6371.0
    lat_delta = math.degrees(radius_km / earth_radius_km)
    cos_lat = math.cos(math.radians(latitude))

    if abs(cos_lat) < 1e-12:
        lon_delta = 180.0
    else:
        lon_delta = math.degrees(radius_km / (earth_radius_km * abs(cos_lat)))

    min_lat = max(-90.0, latitude - lat_delta)
    max_lat = min(90.0, latitude + lat_delta)
    min_lon = max(-180.0, longitude - lon_delta)
    max_lon = min(180.0, longitude + lon_delta)

    return min_lat, max_lat, min_lon, max_lon


def _distance_expression(latitude: float, longitude: float):
    """
    指定した位置とラーメン店とのハバースイン距離を算出するSQLAlchemy式を返す。
    """
    earth_radius_km = 6371.0
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

    return (earth_radius_km * c).label('distance')

# この関数はDBで計算するため、APIロジックからは不要になる
# def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float: ...

def load_ramen_data_on_startup(db: Session):
    """
    【改善点】アプリケーション起動時に一度だけCSVを読み込む関数。
    main.pyのstartupイベントで呼び出す。
    """
    if db.query(RamenShop).count() > 0:
        print("Ramen data already exists. Resetting wait times to 0.")
        # 既存のデータの待ち時間を0にリセット
        db.query(RamenShop).update({RamenShop.wait_time: 0})
        db.commit()
        return
    
    csv_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "ramen.csv")
    
    try:
        with open(csv_path, 'r', encoding='utf-8-sig') as file:
            csv_reader = csv.DictReader(file)
            shops_to_add = []
            for row in csv_reader:
                try:
                    latitude = float(row['緯度'])
                    longitude = float(row['経度'])
                    # 待ち時間の初期値は0（データがない状態）として設定
                    # 実際の待ち時間はチェックイン機能で更新される
                    shops_to_add.append(
                        RamenShop(
                            name=row['店名'],
                            address=row['住所'],
                            business_hours=row['営業時間'],
                            closed_day=row['定休日'],
                            seats=row['座席'],
                            latitude=latitude,
                            longitude=longitude,
                            wait_time=0
                        )
                    )
                except (ValueError, KeyError) as e:
                    print(f"Skipping row due to parsing error: {row} - {e}")
                    continue
            
            db.bulk_save_objects(shops_to_add) # 1件ずつaddするより高速
            db.commit()
            print(f"Successfully loaded {len(shops_to_add)} ramen shops with wait time data.")
    except Exception as e:
        db.rollback()
        print(f"Error loading ramen data: {e}")

@router.get("/ramen/ranking", response_model=RamenShopsResponse)
async def get_ramen_ranking(db: Session = Depends(get_db)):
    """
    過去1週間のチェックイン数に基づいたラーメン店のトップ10ランキングを取得する。
    """
    try:
        one_week_ago = datetime.now(timezone.utc) - timedelta(days=7)

        ranking_subquery = (
            db.query(
                Checkin.shop_id.label("shop_id"),
                func.count(Checkin.id).label("checkin_count")
            )
            .filter(Checkin.checkin_date >= one_week_ago)
            .group_by(Checkin.shop_id)
            .order_by(func.count(Checkin.id).desc())
            .limit(10)
            .subquery()
        )

        results = (
            db.query(RamenShop, ranking_subquery.c.checkin_count)
            .join(ranking_subquery, RamenShop.id == ranking_subquery.c.shop_id)
            .order_by(ranking_subquery.c.checkin_count.desc())
            .all()
        )

        shop_responses = []
        for shop, _ in results:
            shop_response = RamenShopResponse.model_validate(shop)
            shop_responses.append(shop_response)

        return RamenShopsResponse(
            shops=shop_responses,
            total=len(shop_responses)
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"ランキングの取得に失敗しました: {str(e)}"
        )

@router.get("/ramen/nearby", response_model=RamenShopsResponse)
async def get_nearby_ramen_shops_optimized(
    latitude: float = Query(..., description="緯度"),
    longitude: float = Query(..., description="経度"),
    radius_km: float = Query(5.0, ge=0.1, le=500.0, description="検索範囲（km）"),
    db: Session = Depends(get_db)
):
    """
    【改善版】指定された位置情報から半径nkm以内のラーメン店を返すエンドポイント。
    距離計算とフィルタリングをDB側で実行するため非常に高速。
    """
    try:
        distance_col = _distance_expression(latitude, longitude)
        min_lat, max_lat, min_lon, max_lon = _build_bounding_box(latitude, longitude, radius_km)

        results = (
            db.query(RamenShop, distance_col)
            .filter(RamenShop.latitude.between(min_lat, max_lat))
            .filter(RamenShop.longitude.between(min_lon, max_lon))
            .filter(distance_col <= radius_km)
            .order_by(distance_col.asc())
            .all()
        )

        shop_responses = []
        for shop, distance in results:
            shop_response = RamenShopResponse.model_validate(shop)
            shop_response.distance = round(distance, 2)
            shop_responses.append(shop_response)

        return RamenShopsResponse(
            shops=shop_responses,
            total=len(shop_responses)
        )
        
    except Exception as e:
        # DBによっては三角関数が使えない場合など、エラーハンドリングを強化
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"ラーメン店の検索に失敗しました: {str(e)}"
        )


@router.get("/ramen", response_model=RamenShopsResponse)
async def get_all_ramen_shops(
    keyword: Optional[str] = Query(None, description="店名での検索キーワード"),
    prefecture: Optional[str] = Query(None, description="都道府県での絞り込み"),
    page: int = Query(1, ge=1, description="ページ番号"),
    per_page: int = Query(20, ge=1, le=100, description="1ページあたりの件数"),
    db: Session = Depends(get_db)
):
    """全てのラーメン店を返す、またはキーワードや都道府県で検索するエンドポイント"""
    try:
        query = db.query(RamenShop)
        if keyword:
            query = query.filter(RamenShop.name.ilike(f"%{keyword}%"))
        if prefecture:
            query = query.filter(RamenShop.address.ilike(f"%{prefecture}%"))

        total = query.count()
        shops = (
            query.order_by(RamenShop.id)
            .offset((page - 1) * per_page)
            .limit(per_page)
            .all()
        )
        shop_responses = [RamenShopResponse.model_validate(shop) for shop in shops]
        return RamenShopsResponse(shops=shop_responses, total=total)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"ラーメン店の取得に失敗しました: {str(e)}"
        )


@router.get("/ramen/waittime", response_model=RamenShopsResponse)
async def get_ramen_shops_with_waittime(
    latitude: Optional[float] = Query(None, description="現在地の緯度"),
    longitude: Optional[float] = Query(None, description="現在地の経度"),
    radius_km: float = Query(10.0, ge=0.1, le=50.0, description="検索範囲（km）"),
    db: Session = Depends(get_db)
):
    """
    待ち時間情報を含むラーメン店リストを返すエンドポイント
    """
    try:
        if latitude is not None and longitude is not None:
            distance_col = _distance_expression(latitude, longitude)
            min_lat, max_lat, min_lon, max_lon = _build_bounding_box(latitude, longitude, radius_km)

            results = (
                db.query(RamenShop, distance_col)
                .filter(RamenShop.latitude.between(min_lat, max_lat))
                .filter(RamenShop.longitude.between(min_lon, max_lon))
                .filter(distance_col <= radius_km)
                .order_by(distance_col.asc())
                .all()
            )

            shop_responses = []
            for shop, distance in results:
                shop_response = RamenShopResponse.model_validate(shop)
                shop_response.distance = round(distance, 2)
                shop_responses.append(shop_response)
        else:
            shops = db.query(RamenShop).all()
            shop_responses = [RamenShopResponse.model_validate(shop) for shop in shops]

        return RamenShopsResponse(
            shops=shop_responses,
            total=len(shop_responses)
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"待ち時間情報の取得に失敗しました: {str(e)}"
        )


@router.get("/ramen/{shop_id}", response_model=RamenShopResponse)
async def get_ramen_shop_detail(shop_id: int, db: Session = Depends(get_db)):
    """指定されたIDのラーメン店の詳細情報を返すエンドポイント"""
    try:
        shop = db.query(RamenShop).filter(RamenShop.id == shop_id).first()
        if not shop:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="指定されたラーメン店が見つかりません"
            )
        
        return RamenShopResponse.model_validate(shop)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"ラーメン店の詳細取得に失敗しました: {str(e)}"
        )


@router.put("/ramen/{shop_id}/waittime")
async def update_waittime(
    shop_id: int,
    wait_time: int = Query(..., ge=0, le=300, description="待ち時間（分）"),
    db: Session = Depends(get_db)
):
    """
    指定された店舗の待ち時間を更新するエンドポイント
    """
    try:
        shop = db.query(RamenShop).filter(RamenShop.id == shop_id).first()
        if not shop:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="指定されたラーメン店が見つかりません"
            )
        
        shop.wait_time = wait_time
        shop.last_update = datetime.now(timezone.utc)
        db.commit()
        
        return {"message": "待ち時間を更新しました", "wait_time": wait_time}
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"待ち時間の更新に失敗しました: {str(e)}"
        )
