
import pytest
from app.models import RamenShop

def add_ramen_shops_to_db(db):
    """テスト用のラーメン店データをDBに追加するヘルパー関数"""
    shops = [
        RamenShop(name="ラーメン二郎 新宿店", address="東京都新宿区", latitude=35.6909, longitude=139.7004),
        RamenShop(name="蒙古タンメン中本 新宿店", address="東京都新宿区", latitude=35.6914, longitude=139.7002),
        RamenShop(name="一蘭 新宿中央東口店", address="東京都新宿区", latitude=35.6910, longitude=139.7015),
        RamenShop(name="ラーメン二郎 池袋東口店", address="東京都豊島区", latitude=35.7295, longitude=139.7109),
    ]
    db.add_all(shops)
    db.commit()

def test_search_ramen_shops_with_keyword(test_client, test_db):
    """キーワードに一致するラーメン店がある場合の検索テスト"""
    add_ramen_shops_to_db(test_db)

    response = test_client.get("/api/v1/ramen?keyword=二郎")
    data = response.json()

    assert response.status_code == 200
    assert data["total"] == 2
    assert "ラーメン二郎 新宿店" in [shop["name"] for shop in data["shops"]]
    assert "ラーメン二郎 池袋東口店" in [shop["name"] for shop in data["shops"]]

def test_search_ramen_shops_with_no_match(test_client, test_db):
    """キーワードに一致するラーメン店がない場合の検索テスト"""
    add_ramen_shops_to_db(test_db)

    response = test_client.get("/api/v1/ramen?keyword=家系")
    data = response.json()

    assert response.status_code == 200
    assert data["total"] == 0
    assert len(data["shops"]) == 0

def test_search_ramen_shops_with_empty_keyword(test_client, test_db):
    """キーワードが空の場合の検索テスト（全件取得）"""
    add_ramen_shops_to_db(test_db)

    response = test_client.get("/api/v1/ramen")
    data = response.json()

    assert response.status_code == 200
    assert data["total"] == 4
    assert len(data["shops"]) == 4

def test_get_nearby_ramen_shops(test_client, test_db):
    """近隣のラーメン店を取得するテスト"""
    add_ramen_shops_to_db(test_db)

    # 新宿駅付近の緯度経度
    latitude = 35.6909
    longitude = 139.7004
    radius_km = 1

    response = test_client.get(f"/api/v1/ramen/nearby?latitude={latitude}&longitude={longitude}&radius_km={radius_km}")
    data = response.json()

    assert response.status_code == 200
    assert data["total"] >= 3
    shop_names = [shop["name"] for shop in data["shops"]]
    assert "ラーメン二郎 新宿店" in shop_names
    assert "蒙古タンメン中本 新宿店" in shop_names
    assert "一蘭 新宿中央東口店" in shop_names
    assert "ラーメン二郎 池袋東口店" not in shop_names
