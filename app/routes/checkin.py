from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from typing import List, Optional, Dict, Any
import ipaddress
import math
import re
import user_agents
from datetime import datetime, timedelta

from database import get_db
from app.models import User, RamenShop, Checkin, CheckinVerification
from app.schemas import (
    CheckinCreate, CheckinResponse, CheckinsResponse,
    CheckinVerificationRequest, CheckinVerificationResponse,
    NearbyShopsForCheckinRequest, NearbyShopsForCheckinResponse,
    WaitTimeReportRequest, WaitTimeReportResponse
)
from app.utils.auth import get_current_active_user
from app.utils.scoring import (
    ensure_user_can_post,
    reward_checkin,
    reward_wait_time_report,
)

router = APIRouter(tags=["checkin"])

# 地球の半径（km）
EARTH_RADIUS_KM = 6371.0

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """2点間の距離を計算（Haversine formula）"""
    lat1_rad = math.radians(lat1)
    lon1_rad = math.radians(lon1)
    lat2_rad = math.radians(lat2)
    lon2_rad = math.radians(lon2)
    
    dlat = lat2_rad - lat1_rad
    dlon = lon2_rad - lon1_rad
    
    a = (math.sin(dlat / 2) * math.sin(dlat / 2) +
         math.cos(lat1_rad) * math.cos(lat2_rad) *
         math.sin(dlon / 2) * math.sin(dlon / 2))
    
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return EARTH_RADIUS_KM * c

def detect_device_type(user_agent_string: str) -> str:
    """ユーザーエージェントからデバイスタイプを判定"""
    try:
        ua = user_agents.parse(user_agent_string)
        if ua.is_mobile:
            return 'mobile'
        elif ua.is_tablet:
            return 'tablet'
        else:
            return 'desktop'
    except:
        return 'unknown'

def is_mobile_network(request: Request) -> bool:
    """モバイルネットワークかどうかを判定（簡易的な実装）"""
    # 実際の実装では、より高度な検証が必要
    user_agent = request.headers.get("user-agent", "").lower()
    mobile_keywords = ['mobile', 'android', 'iphone', 'ipad', 'tablet']
    return any(keyword in user_agent for keyword in mobile_keywords)

def _is_public_ip(value: str) -> bool:
    """公開IPアドレスのみ許可する"""
    try:
        ip_obj = ipaddress.ip_address(value)
    except ValueError:
        return False

    return not (
        ip_obj.is_private
        or ip_obj.is_loopback
        or ip_obj.is_link_local
        or ip_obj.is_reserved
        or ip_obj.is_multicast
    )


def get_ip_location(request: Request) -> Optional[Dict[str, Any]]:
    """IPアドレスから位置情報を取得"""
    try:
        # X-Forwarded-Forヘッダーをチェック
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            ip = forwarded_for.split(",")[0].strip()
        else:
            ip = request.client.host

        if not ip or not _is_public_ip(ip):
            return None

        # ipinfo.ioを使用して位置情報を取得
        import httpx

        response = httpx.get(
            f"https://ipinfo.io/{ip}/json",
            timeout=httpx.Timeout(2.0, connect=2.0),
            follow_redirects=False,
        )
        if response.status_code == 200:
            data = response.json()
            if 'loc' in data:
                lat, lng = data['loc'].split(',')
                return {
                    'latitude': float(lat),
                    'longitude': float(lng),
                    'city': data.get('city'),
                    'region': data.get('region'),
                    'country': data.get('country')
                }
    except Exception as e:
        print(f"IP位置情報取得エラー: {e}")

    return None

def verify_checkin_location(
    request: CheckinVerificationRequest,
    shop: RamenShop,
    db: Session
) -> CheckinVerificationResponse:
    """チェックイン位置情報を検証"""
    warnings = []
    errors = []
    verification_score = 0
    verification_method = request.location_source
    
    # 位置情報がない場合の処理
    if request.latitude is None or request.longitude is None:
        warnings.append("位置情報がありません。手動チェックインとして処理します。")
        verification_score = 40  # 手動チェックインは中程度のスコア
        
        # デバイスタイプによる検証
        if request.device_type == 'desktop':
            warnings.append("PCからの手動チェックインを検出しました。")
            verification_score -= 10
            
        return CheckinVerificationResponse(
            is_valid=True,
            verification_score=verification_score,
            verification_method=verification_method,
            verification_level="medium" if verification_score >= 40 else "low",
            warnings=warnings,
            errors=errors
        )
    
    # 店舗との距離を計算
    distance = haversine_distance(
        request.latitude, request.longitude,
        shop.latitude, shop.longitude
    )
    
    # 基本的な距離検証
    if distance > 1.0:  # 1km以上離れている場合
        errors.append(f"店舗から約{distance:.1f}km離れています。チェックインできません。")
        verification_score = 0
    elif distance > 0.5:  # 500m以上1km以下
        warnings.append(f"店舗から約{distance:.1f}km離れています。")
        verification_score = 30
    elif distance > 0.2:  # 200m以上500m以下
        warnings.append(f"店舗から約{distance*1000:.0f}m離れています。")
        verification_score = 60
    else:  # 200m以内
        verification_score = 90
    
    # GPS精度の検証
    if request.location_source == 'gps' and request.location_accuracy:
        if request.location_accuracy > 100:  # 100m以上の誤差
            warnings.append("GPSの精度が低いです。")
            verification_score -= 10
        elif request.location_accuracy > 50:  # 50m以上の誤差
            verification_score -= 5
    
    # デバイスタイプによる検証
    if request.device_type == 'desktop':
        if request.location_source not in ['gps', 'gps_exif']:
            errors.append("PCからのチェックインにはGPSまたはGPS+EXIFによる検証が必要です。")
            verification_score = 0
        else:
            # PCからのアクセスはより厳しく検証
            verification_score -= 20
            warnings.append("PCからのアクセスを検出しました。追加の検証を行います。")
    
    # モバイルネットワーク判定
    if request.device_type == 'mobile' and not request.is_mobile_network:
        warnings.append("Wi-Fi接続を検出しました。モバイルネットワークでのチェックインを推奨します。")
        verification_score -= 5
    
    # EXIFデータによる追加検証
    if request.exif_data and 'GPSLatitude' in request.exif_data:
        exif_lat = request.exif_data['GPSLatitude']
        exif_lng = request.exif_data['GPSLongitude']
        exif_distance = haversine_distance(
            exif_lat, exif_lng,
            request.latitude, request.longitude
        )
        
        if exif_distance > 0.1:  # EXIFとGPSの位置が100m以上離れている
            warnings.append("写真の位置情報と現在位置が一致しません。")
            verification_score -= 15
        else:
            verification_method = 'gps_exif'
            verification_score = min(100, verification_score + 10)
    
    # 検証レベルを決定
    if verification_score >= 90:
        verification_level = 'high'
    elif verification_score >= 60:
        verification_level = 'medium'
    else:
        verification_level = 'low'
    
    return CheckinVerificationResponse(
        is_valid=len(errors) == 0,
        verification_score=max(0, verification_score),
        verification_method=verification_method,
        verification_level=verification_level,
        warnings=warnings,
        errors=errors
    )

@router.post("/checkin/verify", response_model=CheckinVerificationResponse)
async def verify_checkin(
    request: CheckinVerificationRequest,
    db: Session = Depends(get_db)
):
    """チェックイン前の位置情報検証"""
    # 店舗の存在確認
    shop = db.query(RamenShop).filter(RamenShop.id == request.shop_id).first()
    if not shop:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="指定された店舗が見つかりません"
        )
    
    # 位置情報検証
    return verify_checkin_location(request, shop, db)

@router.post("/checkin/nearby", response_model=NearbyShopsForCheckinResponse)
async def get_nearby_shops_for_checkin(
    request: NearbyShopsForCheckinRequest,
    http_request: Request,
    db: Session = Depends(get_db)
):
    """チェックイン可能な近隣店舗を取得"""
    shops = []
    location_method = 'manual'
    
    # GPS位置情報がある場合
    if request.latitude is not None and request.longitude is not None:
        location_method = 'gps'
        
        # 近隣店舗を検索
        nearby_shops_query = (
            db.query(RamenShop)
            .filter(
                func.sqrt(
                    func.pow(func.radians(RamenShop.latitude) - func.radians(request.latitude), 2) +
                    func.pow(func.radians(RamenShop.longitude) - func.radians(request.longitude), 2)
                ) * EARTH_RADIUS_KM <= request.radius_km
            )
        )
        
        nearby_shops = nearby_shops_query.all()
        
        for shop in nearby_shops:
            distance = haversine_distance(
                request.latitude, request.longitude,
                shop.latitude, shop.longitude
            )
            shops.append({
                'id': shop.id,
                'name': shop.name,
                'address': shop.address,
                'distance': round(distance, 3),
                'latitude': shop.latitude,
                'longitude': shop.longitude
            })
    
    # IP位置情報の使用が許可されている場合
    elif request.include_ip_location:
        location_method = 'ip'
        ip_location = get_ip_location(http_request)
        
        if ip_location:
            # IP位置情報から近隣店舗を検索
            nearby_shops_query = (
                db.query(RamenShop)
                .filter(
                    func.sqrt(
                        func.pow(func.radians(RamenShop.latitude) - func.radians(ip_location['latitude']), 2) +
                        func.pow(func.radians(RamenShop.longitude) - func.radians(ip_location['longitude']), 2)
                    ) * EARTH_RADIUS_KM <= request.radius_km
                )
            )
            
            nearby_shops = nearby_shops_query.all()
            
            for shop in nearby_shops:
                distance = haversine_distance(
                    ip_location['latitude'], ip_location['longitude'],
                    shop.latitude, shop.longitude
                )
                shops.append({
                    'id': shop.id,
                    'name': shop.name,
                    'address': shop.address,
                    'distance': round(distance, 3),
                    'latitude': shop.latitude,
                    'longitude': shop.longitude
                })
    
    # 距離でソート
    shops.sort(key=lambda x: x['distance'])
    
    # チェックイン可能か判定
    can_checkin = len(shops) > 0
    recommended_shop = shops[0] if shops else None
    
    return NearbyShopsForCheckinResponse(
        shops=shops,
        can_checkin=can_checkin,
        recommended_shop=recommended_shop,
        location_method=location_method
    )

@router.post("/checkin", response_model=CheckinResponse)
async def create_checkin(
    checkin_data: CheckinCreate,
    http_request: Request,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """チェックインを作成"""
    ensure_user_can_post(current_user, db)

    # 店舗の存在確認
    shop = db.query(RamenShop).filter(RamenShop.id == checkin_data.shop_id).first()
    if not shop:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="指定された店舗が見つかりません"
        )
    
    # 位置情報検証
    verification_request = CheckinVerificationRequest(
        latitude=checkin_data.latitude,
        longitude=checkin_data.longitude,
        shop_id=checkin_data.shop_id,
        location_source=checkin_data.location_source or 'manual',
        location_accuracy=checkin_data.location_accuracy,
        user_agent=checkin_data.user_agent,
        device_type=checkin_data.device_type,
        is_mobile_network=checkin_data.is_mobile_network,
        exif_data=checkin_data.extra_data.get('exif') if checkin_data.extra_data else None
    )
    
    verification_result = verify_checkin_location(verification_request, shop, db)
    
    if not verification_result.is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"チェックインできません: {'; '.join(verification_result.errors)}"
        )
    
    # チェックインを作成
    checkin = Checkin(
        user_id=current_user.id,
        shop_id=checkin_data.shop_id,
        checkin_date=checkin_data.checkin_date or datetime.utcnow(),
        latitude=checkin_data.latitude,
        longitude=checkin_data.longitude,
        location_source=checkin_data.location_source,
        location_accuracy=checkin_data.location_accuracy,
        user_agent=checkin_data.user_agent,
        device_type=checkin_data.device_type,
        is_mobile_network=checkin_data.is_mobile_network,
        verification_method=verification_result.verification_method,
        verification_score=verification_result.verification_score,
        is_verified=verification_result.verification_score >= 60,
        wait_time_reported=checkin_data.wait_time_reported,
        wait_time_confidence=checkin_data.wait_time_confidence,
        checkin_note=checkin_data.checkin_note,
        extra_data=checkin_data.extra_data
    )
    
    db.add(checkin)
    db.commit()  # チェックインを先にコミットしてIDを取得
    db.refresh(checkin)
    
    # 検証ログを保存
    distance_to_shop = None
    if checkin_data.latitude is not None and checkin_data.longitude is not None:
        distance_to_shop = haversine_distance(
            checkin_data.latitude, checkin_data.longitude,
            shop.latitude, shop.longitude
        )
    
    verification_log = CheckinVerification(
        checkin_id=checkin.id,
        verification_type='location',
        verification_data={
            'distance_to_shop': distance_to_shop,
            'warnings': verification_result.warnings,
            'errors': verification_result.errors
        },
        result='success' if verification_result.is_valid else 'failed',
        score=verification_result.verification_score,
        message=f"検証メソッド: {verification_result.verification_method}"
    )
    db.add(verification_log)
    
    # 待ち時間が報告されている場合、店舗の待ち時間を更新
    if checkin_data.wait_time_reported is not None:
        shop.wait_time = checkin_data.wait_time_reported
        shop.last_update = datetime.utcnow()
    
    db.commit()  # 検証ログと店舗情報をコミット

    # ポイント付与
    try:
        reward_checkin(db, current_user)
        if checkin_data.wait_time_reported is not None:
            reward_wait_time_report(db, current_user)
        db.commit()
    except Exception as exc:
        db.rollback()
        print(f"チェックインのスコア更新に失敗しました: {exc}")

    # レスポンスを作成するために必要な情報を追加
    checkin_dict = {
        'id': checkin.id,
        'user_id': checkin.user_id,
        'shop_id': checkin.shop_id,
        'checkin_date': checkin.checkin_date,
        'latitude': checkin.latitude,
        'longitude': checkin.longitude,
        'location_source': checkin.location_source,
        'location_accuracy': checkin.location_accuracy,
        'user_agent': checkin.user_agent,
        'device_type': checkin.device_type,
        'is_mobile_network': checkin.is_mobile_network,
        'verification_method': checkin.verification_method,
        'verification_score': checkin.verification_score,
        'is_verified': checkin.is_verified,
        'verification_level': 'high' if checkin.verification_score >= 80 else ('medium' if checkin.verification_score >= 40 else 'low'),
        'wait_time_reported': checkin.wait_time_reported,
        'wait_time_confidence': checkin.wait_time_confidence,
        'checkin_note': checkin.checkin_note,
        'extra_data': checkin.extra_data,
        'shop_name': shop.name,
        'shop_address': shop.address,
        'author_username': current_user.username
    }
    
    return CheckinResponse.model_validate(checkin_dict)

@router.get("/users/{user_id}/checkins", response_model=CheckinsResponse)
async def get_user_checkins(
    user_id: str,
    page: int = 1,
    per_page: int = 20,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """ユーザーのチェックイン履歴を取得"""
    # プライバシー確認：本人または管理者のみアクセス可能
    if user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="他のユーザーのチェックイン履歴は閲覧できません"
        )
    
    offset = (page - 1) * per_page
    
    # チェックイン履歴を取得
    checkins_query = (
        db.query(Checkin, RamenShop, User)
        .join(RamenShop, Checkin.shop_id == RamenShop.id)
        .join(User, Checkin.user_id == User.id)
        .filter(Checkin.user_id == user_id)
        .order_by(desc(Checkin.checkin_date))
        .offset(offset)
        .limit(per_page)
    )
    
    checkins_data = checkins_query.all()
    
    # 総数を取得
    total = db.query(Checkin).filter(Checkin.user_id == user_id).count()
    
    # レスポンスを作成
    checkin_responses = []
    for checkin, shop, user in checkins_data:
        checkin_dict = {
            'id': checkin.id,
            'user_id': checkin.user_id,
            'shop_id': checkin.shop_id,
            'checkin_date': checkin.checkin_date,
            'latitude': checkin.latitude,
            'longitude': checkin.longitude,
            'location_source': checkin.location_source,
            'location_accuracy': checkin.location_accuracy,
            'user_agent': checkin.user_agent,
            'device_type': checkin.device_type,
            'is_mobile_network': checkin.is_mobile_network,
            'verification_method': checkin.verification_method,
            'verification_score': checkin.verification_score,
            'is_verified': checkin.is_verified,
            'verification_level': 'high' if checkin.verification_score >= 80 else ('medium' if checkin.verification_score >= 40 else 'low'),
            'wait_time_reported': checkin.wait_time_reported,
            'wait_time_confidence': checkin.wait_time_confidence,
            'checkin_note': checkin.checkin_note,
            'extra_data': checkin.extra_data,
            'shop_name': shop.name,
            'shop_address': shop.address,
            'author_username': user.username
        }
        checkin_responses.append(CheckinResponse.model_validate(checkin_dict))
    
    return CheckinsResponse(
        checkins=checkin_responses,
        total=total
    )

@router.post("/waittime/report", response_model=WaitTimeReportResponse)
async def report_wait_time(
    report_data: WaitTimeReportRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """待ち時間を報告"""
    ensure_user_can_post(current_user, db)

    # 店舗の存在確認
    shop = db.query(RamenShop).filter(RamenShop.id == report_data.shop_id).first()
    if not shop:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="指定された店舗が見つかりません"
        )
    
    previous_wait_time = shop.wait_time
    
    # 店舗の待ち時間を更新
    shop.wait_time = report_data.wait_time
    shop.last_update = datetime.utcnow()
    
    # チェックインIDが指定されている場合、チェックイン記録も更新
    if report_data.checkin_id:
        checkin = db.query(Checkin).filter(
            Checkin.id == report_data.checkin_id,
            Checkin.user_id == current_user.id
        ).first()
        
        if checkin:
            checkin.wait_time_reported = report_data.wait_time
            checkin.wait_time_confidence = report_data.confidence
    
    reward_wait_time_report(db, current_user)
    db.commit()
    
    return WaitTimeReportResponse(
        success=True,
        updated_wait_time=report_data.wait_time,
        previous_wait_time=previous_wait_time,
        message="待ち時間を更新しました"
    )