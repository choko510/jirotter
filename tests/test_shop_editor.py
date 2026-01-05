import json
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.__init__ import create_app
from app.models import RamenShop, ShopEditLock, ShopChangeHistory, User
from database import SessionLocal, Base, engine


@pytest.fixture
def admin_user(test_db: Session):
    user = test_db.query(User).filter_by(id="admin_for_shop_editor").first()
    if not user:
        user = User(
            id="admin_for_shop_editor",
            email="admin-shop-editor@example.com",
            is_admin=True,
        )
        user.set_password("adminpassword123!")
        test_db.add(user)
        test_db.commit()
    return user


@pytest.fixture
def auth_header_for_admin(test_client: TestClient, admin_user: User):
    """
    管理者ユーザーでログインし、認証ヘッダーを返す。
    """
    login_data = {
        "id": admin_user.id,
        "password": "adminpassword123!",
    }
    response = test_client.post("/api/v1/auth/login", json=login_data)
    if response.status_code != 200:
        pytest.fail(f"Admin login failed. Status: {response.status_code}, Response: {response.text}")

    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def sample_shop(test_db: Session):
    shop = RamenShop(
        name="テスト店",
        address="東京都テスト区1-1-1",
        business_hours="10:00-20:00",
        closed_day="月",
        seats="10",
        latitude=35.0,
        longitude=139.0,
        wait_time=5,
    )
    test_db.add(shop)
    test_db.commit()
    test_db.refresh(shop)
    yield shop
    # 後処理
    test_db.query(ShopEditLock).filter(ShopEditLock.shop_id == shop.id).delete()
    test_db.query(ShopChangeHistory).filter(ShopChangeHistory.shop_id == shop.id).delete()
    test_db.delete(shop)
    test_db.commit()


def test_admin_shops_list_includes_basic_fields(test_client: TestClient, sample_shop: RamenShop, auth_header_for_admin):
    """GET /api/v1/admin/shops が店舗エディタ用の必要項目を返すことを確認"""
    res = test_client.get("/api/v1/admin/shops", headers=auth_header_for_admin)
    assert res.status_code == 200

    data = res.json()
    assert "shops" in data
    assert "total" in data

    shop = next((s for s in data["shops"] if s["id"] == sample_shop.id), None)
    assert shop is not None
    # スプレッドシートで利用する基本カラムが含まれていること
    for key in [
        "name",
        "address",
        "business_hours",
        "closed_day",
        "seats",
        "latitude",
        "longitude",
        "wait_time",
        "last_update",
        "posts_count",
        "pending_submissions",
    ]:
        assert key in shop


def test_lock_acquire_and_release_api(test_client: TestClient, test_db: Session, sample_shop: RamenShop, auth_header_for_admin: dict):
    """POST/DELETE /api/v1/admin/shops/{id}/lock によるロック取得/解放を検証"""
    # ロック取得
    res = test_client.post(f"/api/v1/admin/shops/{sample_shop.id}/lock", headers=auth_header_for_admin)
    assert res.status_code == 200
    body = res.json()
    assert body["success"] is True
    assert body["lock"]["shop_id"] == sample_shop.id

    # DB 上でロックが存在すること
    lock = test_db.query(ShopEditLock).filter_by(shop_id=sample_shop.id).first()
    assert lock is not None

    # ロック解放
    res2 = test_client.delete(f"/api/v1/admin/shops/{sample_shop.id}/lock", headers=auth_header_for_admin)
    assert res2.status_code in (200, 204)
    # DB から削除されていること
    lock2 = test_db.query(ShopEditLock).filter_by(shop_id=sample_shop.id).first()
    assert lock2 is None


def test_patch_shop_records_history(test_client: TestClient, test_db: Session, sample_shop: RamenShop, auth_header_for_admin: dict):
    """PATCH /api/v1/admin/shops/{id} が ShopChangeHistory を記録することを検証"""
    payload = {"name": "テスト店-更新"}

    res = test_client.patch(
        f"/api/v1/admin/shops/{sample_shop.id}",
        json=payload,
        headers=auth_header_for_admin,
    )
    assert res.status_code == 200
    data = res.json()
    assert data["name"] == "テスト店-更新"

    histories = (
        test_db.query(ShopChangeHistory)
        .filter(ShopChangeHistory.shop_id == sample_shop.id, ShopChangeHistory.field_name == "name")
        .all()
    )
    assert len(histories) >= 1
    # 最新履歴が正しく記録されていること
    latest = sorted(histories, key=lambda h: h.changed_at)[-1]
    assert latest.new_value == "テスト店-更新"


def test_get_shop_history_endpoint(test_client: TestClient, test_db: Session, sample_shop: RamenShop, auth_header_for_admin: dict):
    """GET /api/v1/admin/shops/{id}/history が履歴を返すことを検証"""
    # 事前に履歴 1 件作成
    history = ShopChangeHistory(
        shop_id=sample_shop.id,
        user_id="admin_for_shop_editor",
        field_name="name",
        old_value="old",
        new_value="new",
        changed_at=datetime.now(timezone.utc),
        change_type="update",
    )
    test_db.add(history)
    test_db.commit()

    res = test_client.get(
        f"/api/v1/admin/shops/{sample_shop.id}/history",
        headers=auth_header_for_admin,
    )
    assert res.status_code == 200
    data = res.json()
    assert "history" in data
    assert "total" in data
    assert any(item["field"] == "name" for item in data["history"])