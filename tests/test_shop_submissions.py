from app.models import RamenShop, RamenShopSubmission, User


def register_user(client, suffix):
    user_data = {
        "id": f"user_{suffix}",
        "email": f"user_{suffix}@example.com",
        "password": "password123!",
    }
    response = client.post("/api/v1/auth/register", json=user_data)
    assert response.status_code == 201
    data = response.json()
    return user_data["id"], data["access_token"]


def auth_header(token):
    return {"Authorization": f"Bearer {token}"}


def test_user_can_submit_new_shop(test_client, test_db):
    user_id, token = register_user(test_client, "submitter")

    payload = {
        "change_type": "new",
        "name": "テストラーメン",
        "address": "東京都千代田区",
        "business_hours": "11:00-20:00",
        "closed_day": "火曜",
        "seats": "18席",
        "latitude": 35.68,
        "longitude": 139.76,
        "note": "新規店舗の追加テスト",
    }

    response = test_client.post(
        "/api/v1/ramen/submissions",
        json=payload,
        headers=auth_header(token),
    )

    assert response.status_code == 201
    data = response.json()
    assert data["change_type"] == "new"
    assert data["status"] == "pending"

    submission = test_db.query(RamenShopSubmission).filter_by(proposer_id=user_id).one()
    assert submission.proposed_changes["name"] == "テストラーメン"
    assert submission.status == "pending"


def test_admin_can_approve_update_submission(test_client, test_db):
    # 既存店舗を作成
    shop = RamenShop(
        name="既存店舗",
        address="東京都新宿区",
        latitude=35.6895,
        longitude=139.6917,
        business_hours="9:00-18:00",
    )
    test_db.add(shop)
    test_db.commit()
    test_db.refresh(shop)

    submitter_id, submitter_token = register_user(test_client, "author")

    update_payload = {
        "change_type": "update",
        "shop_id": shop.id,
        "business_hours": "10:00-22:00",
        "note": "営業時間を更新",
    }

    create_response = test_client.post(
        "/api/v1/ramen/submissions",
        json=update_payload,
        headers=auth_header(submitter_token),
    )
    assert create_response.status_code == 201
    submission_id = create_response.json()["id"]

    admin_id, admin_token = register_user(test_client, "admin")
    admin = test_db.query(User).filter(User.id == admin_id).one()
    admin.is_admin = True
    test_db.commit()

    approve_response = test_client.post(
        f"/api/v1/ramen/submissions/{submission_id}/approve",
        json={"comment": "問題ありません"},
        headers=auth_header(admin_token),
    )

    assert approve_response.status_code == 200
    updated_shop = test_db.query(RamenShop).filter(RamenShop.id == shop.id).one()
    assert updated_shop.business_hours == "10:00-22:00"

    submission = test_db.query(RamenShopSubmission).filter(RamenShopSubmission.id == submission_id).one()
    assert submission.status == "approved"
    contributor = test_db.query(User).filter(User.id == submitter_id).one()
    assert contributor.points >= 20


def test_non_admin_cannot_access_pending(test_client, test_db):
    _, token = register_user(test_client, "regular")

    response = test_client.get(
        "/api/v1/ramen/submissions/pending",
        headers=auth_header(token),
    )

    assert response.status_code == 403
    assert "管理者権限" in response.json()["detail"]
