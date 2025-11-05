from datetime import datetime, timezone

from app.models import RamenShop


def create_shop(db):
    shop = RamenShop(
        name="テストラーメン", 
        address="東京都千代田区1-1-1",
        business_hours="10:00-20:00",
        closed_day="なし",
        seats="20",
        latitude=35.6895,
        longitude=139.6917,
    )
    db.add(shop)
    db.commit()
    db.refresh(shop)
    return shop


def test_create_visit_and_list(test_client, test_db, auth_headers):
    shop = create_shop(test_db)

    visit_payload = {
        "shop_id": shop.id,
        "visit_date": datetime.now(timezone.utc).isoformat(),
        "rating": 5,
        "comment": "最高でした",
        "wait_time_minutes": 15,
        "taste_rating": 4,
        "flavor_notes": "濃厚な味",
    }

    create_response = test_client.post(
        "/api/v1/visits",
        json=visit_payload,
        headers=auth_headers
    )
    assert create_response.status_code == 201

    data = create_response.json()
    assert data["shop_name"] == shop.name
    assert data["wait_time_minutes"] == 15
    assert data["taste_rating"] == 4
    assert data["flavor_notes"] == "濃厚な味"

    list_response = test_client.get("/api/v1/visits/me", headers=auth_headers)
    assert list_response.status_code == 200

    visits = list_response.json()
    assert visits["total"] == 1
    assert len(visits["visits"]) == 1
    assert visits["visits"][0]["shop_id"] == shop.id
    assert visits["visits"][0]["wait_time_minutes"] == 15
    assert visits["visits"][0]["taste_rating"] == 4
    assert visits["visits"][0]["flavor_notes"] == "濃厚な味"


def test_create_visit_invalid_shop(test_client, test_db, auth_headers):
    visit_payload = {
        "shop_id": 99999,
        "visit_date": datetime.now(timezone.utc).isoformat(),
    }

    response = test_client.post(
        "/api/v1/visits",
        json=visit_payload,
        headers=auth_headers
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "指定された店舗が存在しません"
