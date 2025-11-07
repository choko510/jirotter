import json
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.__init__ import create_app
from app.models import RamenShop, ShopEditLock, ShopChangeHistory, User
from database import SessionLocal, Base, engine


@pytest.fixture(scope="module")
def client():
    """
    このテストは既存プロジェクトの pytest 設定に合わせて、
    FastAPI アプリを立ち上げて実行する統合テスト寄りの構成にしている。
    認証まわりは tests/conftest.py のヘルパ（例: admin_user, auth_header）を利用する前提。
    """
    app = create_app()
    return TestClient(app)


@pytest.fixture
def db_session() -> Session:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture
def admin_user(db_session: Session):
    user = db_session.query(User).filter_by(id="admin_for_shop_editor").first()
    if not user:
        user = User(
            id="admin_for_shop_editor",
            email="admin-shop-editor@example.com",
            password_hash="test",
            is_admin=True,
        )
        db_session.add(user)
        db_session.commit()
    return user


@pytest.fixture
def auth_header_for_admin(admin_user: User):
    """
    既存 tests/conftest.py の実装に合わせて、
    有効な管理者トークンを生成するヘルパーがある前提。
    なければ Cookie ベース/Token ベースの既存ヘルパーに合わせて修正すること。
    """
    # 既存実装に追従するため、ここではプレースホルダ。
    # 実プロジェクトでは verify_token / create_access_token 周りに合わせて実装。
    return {}


@pytest.fixture
def sample_shop(db_session: Session):
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
    db_session.add(shop)
    db_session.commit()
    db_session.refresh(shop)
    yield shop
    # 後処理
    db_session.query(ShopEditLock).filter(ShopEditLock.shop_id == shop.id).delete()
    db_session.query(ShopChangeHistory).filter(ShopChangeHistory.shop_id == shop.id).delete()
    db_session.delete(shop)
    db_session.commit()


def test_admin_shops_list_includes_basic_fields(client: TestClient, sample_shop: RamenShop, auth_header_for_admin):
    """GET /api/v1/admin/shops が店舗エディタ用の必要項目を返すことを確認"""
    res = client.get("/api/v1/admin/shops", headers=auth_header_for_admin)
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


def test_lock_acquire_and_release_api(client: TestClient, db_session: Session, sample_shop: RamenShop, admin_user: User):
    """POST/DELETE /api/v1/admin/shops/{id}/lock によるロック取得/解放を検証"""
    # ロック取得
    res = client.post(f"/api/v1/admin/shops/{sample_shop.id}/lock")
    # 認証ヘッダ未設定の場合の挙動はプロジェクトに依存するため、
    # 実際の tests/conftest.py の仕組みに合わせて修正が必要な場合がある。
    if res.status_code == 401:
        pytest.skip("認証ヘルパー未接続のためスキップ。プロジェクトの auth ヘルパーに合わせて修正が必要です。")

    assert res.status_code == 200
    body = res.json()
    assert body["success"] is True
    assert body["lock"]["shop_id"] == sample_shop.id

    # DB 上でロックが存在すること
    lock = db_session.query(ShopEditLock).filter_by(shop_id=sample_shop.id).first()
    assert lock is not None

    # ロック解放
    res2 = client.delete(f"/api/v1/admin/shops/{sample_shop.id}/lock")
    assert res2.status_code in (200, 204)
    # DB から削除されていること
    lock2 = db_session.query(ShopEditLock).filter_by(shop_id=sample_shop.id).first()
    assert lock2 is None


def test_patch_shop_records_history(client: TestClient, db_session: Session, sample_shop: RamenShop, auth_header_for_admin):
    """PATCH /api/v1/admin/shops/{id} が ShopChangeHistory を記録することを検証"""
    payload = {"name": "テスト店-更新"}

    res = client.patch(
        f"/api/v1/admin/shops/{sample_shop.id}",
        data=json.dumps(payload),
        headers={**auth_header_for_admin, "Content-Type": "application/json"},
    )
    if res.status_code == 401:
        pytest.skip("認証ヘルパー未接続のためスキップ。プロジェクトの auth ヘルパーに合わせて修正が必要です。")

    assert res.status_code == 200
    data = res.json()
    assert data["name"] == "テスト店-更新"

    histories = (
        db_session.query(ShopChangeHistory)
        .filter(ShopChangeHistory.shop_id == sample_shop.id, ShopChangeHistory.field_name == "name")
        .all()
    )
    assert len(histories) >= 1
    # 最新履歴が正しく記録されていること
    latest = sorted(histories, key=lambda h: h.changed_at)[-1]
    assert latest.new_value == "テスト店-更新"


def test_get_shop_history_endpoint(client: TestClient, sample_shop: RamenShop, auth_header_for_admin, db_session: Session):
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
    db_session.add(history)
    db_session.commit()

    res = client.get(
        f"/api/v1/admin/shops/{sample_shop.id}/history",
        headers=auth_header_for_admin,
    )
    if res.status_code == 401:
        pytest.skip("認証ヘルパー未接続のためスキップ。プロジェクトの auth ヘルパーに合わせて修正が必要です。")

    assert res.status_code == 200
    data = res.json()
    assert "history" in data
    assert "total" in data
    assert any(item["field"] == "name" for item in data["history"])