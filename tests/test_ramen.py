
import pytest
from app.models import RamenShop

def add_ramen_shops_to_db(db):
    """テスト用のラーメン店データをDBに追加するヘルパー関数"""
    shops = [
        RamenShop(name="ラーメン二郎 新宿店", address="東京都新宿区", latitude=35.6909, longitude=139.7004),
        RamenShop(name="蒙古タンメン中本 新宿店", address="東京都新宿区", latitude=35.6914, longitude=139.7002),
        RamenShop(name="一蘭 新宿中央東口店", address="東京都新宿区", latitude=35.6910, longitude=139.7015),
        RamenShop(name="ラーメン二郎 池袋東口店", address="東京都豊島区", latitude=35.7295, longitude=139.7109),
        RamenShop(name="麺屋 GOO", address="愛知県名古屋市", latitude=35.1715, longitude=136.8821),
        RamenShop(name="豚山 栄店", address="愛知県名古屋市", latitude=35.1700, longitude=136.8850),
        RamenShop(name="横浜家系ラーメン まんぷく家", address="神奈川県横浜市", latitude=35.4442, longitude=139.6388),
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

    response = test_client.get("/api/v1/ramen?keyword=カレー")
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
    assert data["total"] == 7
    assert len(data["shops"]) == 7

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

def test_filter_ramen_shops_by_prefecture(test_client, test_db):
    """都道府県でラーメン店を絞り込むテスト"""
    add_ramen_shops_to_db(test_db)

    response = test_client.get("/api/v1/ramen?prefecture=東京都")
    data = response.json()

    assert response.status_code == 200
    assert data["total"] == 4
    shop_names = {shop["name"] for shop in data["shops"]}
    assert "ラーメン二郎 新宿店" in shop_names
    assert "ラーメン二郎 池袋東口店" in shop_names

def test_search_menya_keyword(test_client, test_db):
    """麺屋キーワード検索テスト（実データ風）"""
    add_ramen_shops_to_db(test_db)

    response = test_client.get("/api/v1/ramen?keyword=麺屋")
    data = response.json()

    assert response.status_code == 200
    assert data["total"] == 1
    assert "麺屋 GOO" in [shop["name"] for shop in data["shops"]]

def test_search_buta_keyword(test_client, test_db):
    """豚キーワード検索テスト（実データ風）"""
    add_ramen_shops_to_db(test_db)

    response = test_client.get("/api/v1/ramen?keyword=豚")
    data = response.json()

    assert response.status_code == 200
    assert data["total"] == 1
    assert "豚山 栄店" in [shop["name"] for shop in data["shops"]]

def test_search_kakei_keyword(test_client, test_db):
    """家系キーワード検索テスト（実データ風）"""
    add_ramen_shops_to_db(test_db)

    response = test_client.get("/api/v1/ramen?keyword=家系")
    data = response.json()

    assert response.status_code == 200
    assert data["total"] == 1
    assert "横浜家系ラーメン まんぷく家" in [shop["name"] for shop in data["shops"]]

def test_search_special_chars(test_client, test_db):
    """特殊文字キーワード検索テスト（マッチなし）"""
    add_ramen_shops_to_db(test_db)

    response = test_client.get("/api/v1/ramen?keyword=!@#")
    data = response.json()

    assert response.status_code == 200
    assert data["total"] == 0
    assert len(data["shops"]) == 0
