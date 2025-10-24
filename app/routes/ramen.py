from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, cast, Float
from typing import List, Optional
import math
import csv
import os

from database import get_db
from app.models import RamenShop
from app.schemas import RamenShopResponse, RamenShopsResponse

router = APIRouter(tags=["ramen"])

# この関数はDBで計算するため、APIロジックからは不要になる
# def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float: ...

def load_ramen_data_on_startup(db: Session):
    """
    【改善点】アプリケーション起動時に一度だけCSVを読み込む関数。
    main.pyのstartupイベントで呼び出す。
    """
    if db.query(RamenShop).count() > 0:
        print("Ramen data already exists. Skipping load.")
        return
    
    csv_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "ramen.csv")
    
    try:
        import random
        with open(csv_path, 'r', encoding='utf-8-sig') as file:
            csv_reader = csv.DictReader(file)
            shops_to_add = []
            for row in csv_reader:
                try:
                    latitude = float(row['緯度'])
                    longitude = float(row['経度'])
                    # 待ち時間にランダムな値を設定（0-60分）
                    wait_time = random.randint(0, 60)
                    shops_to_add.append(
                        RamenShop(
                            name=row['店名'],
                            address=row['住所'],
                            business_hours=row['営業時間'],
                            closed_day=row['定休日'],
                            seats=row['座席'],
                            latitude=latitude,
                            longitude=longitude,
                            wait_time=wait_time
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
        # 地球の半径 (km)
        R = 6371.0

        # ラジアンに変換
        lat_rad = math.radians(latitude)
        lon_rad = math.radians(longitude)
        
        # Haversine公式をSQLAlchemyで表現
        # 緯度・経度カラムもラジアンに変換
        shop_lat_rad = func.radians(RamenShop.latitude)
        shop_lon_rad = func.radians(RamenShop.longitude)

        dlat = shop_lat_rad - lat_rad
        dlon = shop_lon_rad - lon_rad
        
        a = (func.sin(dlat / 2) * func.sin(dlat / 2) +
             func.cos(lat_rad) * func.cos(shop_lat_rad) *
             func.sin(dlon / 2) * func.sin(dlon / 2))
        
        # NOTE: 多くのDBではatan2は引数を(y, x)の順で受け取る
        c = 2 * func.atan2(func.sqrt(a), func.sqrt(1 - a))
        
        # 距離を計算する式にラベルを付ける
        distance_col = (R * c).label('distance')
        
        # クエリを構築
        nearby_shops_query = (
            db.query(RamenShop, distance_col)
              .filter(distance_col <= radius_km) # DB側でフィルタリング
              .order_by(distance_col.asc())      # DB側でソート
        )
        
        results = nearby_shops_query.all()
        
        # レスポンスデータの作成
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
async def get_all_ramen_shops(keyword: Optional[str] = Query(None, description="店名での検索キーワード"), db: Session = Depends(get_db)):
    """全てのラーメン店を返す、またはキーワードで店名を検索するエンドポイント"""
    try:
        query = db.query(RamenShop)
        if keyword:
            query = query.filter(RamenShop.name.ilike(f"%{keyword}%"))

        all_shops = query.all()
        shop_responses = [RamenShopResponse.model_validate(shop) for shop in all_shops]
        return RamenShopsResponse(shops=shop_responses, total=len(shop_responses))
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
        query = db.query(RamenShop)
        
        # 緯度経度が指定されている場合は距離計算を行う
        if latitude is not None and longitude is not None:
            # 地球の半径 (km)
            R = 6371.0
            
            # ラジアンに変換
            lat_rad = math.radians(latitude)
            lon_rad = math.radians(longitude)
            
            # Haversine公式をSQLAlchemyで表現
            shop_lat_rad = func.radians(RamenShop.latitude)
            shop_lon_rad = func.radians(RamenShop.longitude)
            
            dlat = shop_lat_rad - lat_rad
            dlon = shop_lon_rad - lon_rad
            
            a = (func.sin(dlat / 2) * func.sin(dlat / 2) +
                 func.cos(lat_rad) * func.cos(shop_lat_rad) *
                 func.sin(dlon / 2) * func.sin(dlon / 2))
            
            c = 2 * func.atan2(func.sqrt(a), func.sqrt(1 - a))
            
            # 距離を計算する式にラベルを付ける
            distance_col = (R * c).label('distance')
            
            # クエリを構築
            query = query.add_columns(distance_col).filter(distance_col <= radius_km)
            
            # 結果を取得
            results = query.all()
            
            # レスポンスデータの作成
            shop_responses = []
            for shop, distance in results:
                shop_response = RamenShopResponse.model_validate(shop)
                shop_response.distance = round(distance, 2)
                shop_responses.append(shop_response)
        else:
            # 緯度経度が指定されていない場合は全店舗を返す
            all_shops = query.all()
            shop_responses = [RamenShopResponse.model_validate(shop) for shop in all_shops]
        
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
        shop.last_update = datetime.utcnow()
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