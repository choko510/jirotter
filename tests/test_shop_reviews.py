from unittest.mock import AsyncMock, patch

import pytest

from app.models import RamenShop


def create_shop(test_db):
    shop = RamenShop(
        name="ラーメン二郎 品川店",
        address="東京都港区",
        latitude=35.6285,
        longitude=139.7386,
    )
    test_db.add(shop)
    test_db.commit()
    test_db.refresh(shop)
    return shop


def create_user_and_headers(test_client, suffix: str):
    user_id = f"reviewer{suffix}"
    payload = {
        "id": user_id,
        "email": f"{user_id}@example.com",
        "password": "password123!",
    }
    response = test_client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 201, response.text
    token = response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    return user_id, headers


def test_create_shop_review_awards_points(test_client, test_db):
    shop = create_shop(test_db)
    user_id, headers = create_user_and_headers(test_client, "1")

    payload = {"rating": 5, "comment": "最高の一杯でした！"}
    response = test_client.post(
        f"/api/v1/shops/{shop.id}/reviews",
        json=payload,
        headers=headers,
    )

    assert response.status_code == 201, response.text
    data = response.json()
    assert data["rating"] == 5
    assert data["comment"] == payload["comment"]
    assert data["author_username"] == user_id

    profile = test_client.get(f"/api/v1/users/{user_id}", headers=headers)
    assert profile.status_code == 200
    assert profile.json()["points"] == 10

    list_response = test_client.get(f"/api/v1/shops/{shop.id}/reviews")
    assert list_response.status_code == 200
    list_data = list_response.json()
    assert list_data["total"] == 1
    assert list_data["reviews"][0]["comment"] == payload["comment"]
    assert list_data["average_rating"] == 5.0
    assert list_data["rating_distribution"]["5"] == 1
    assert list_data["user_review_id"] is None


def test_duplicate_review_rejected(test_client, test_db):
    shop = create_shop(test_db)
    _, headers = create_user_and_headers(test_client, "2")

    payload = {"rating": 4, "comment": "麺がもちもち"}
    first = test_client.post(
        f"/api/v1/shops/{shop.id}/reviews",
        json=payload,
        headers=headers,
    )
    assert first.status_code == 201

    duplicate = test_client.post(
        f"/api/v1/shops/{shop.id}/reviews",
        json=payload,
        headers=headers,
    )
    assert duplicate.status_code == 400
    assert "既にレビュー" in duplicate.json()["detail"]


def test_review_blocked_by_moderation(test_client, test_db):
    shop = create_shop(test_db)
    _, headers = create_user_and_headers(test_client, "3")

    mock_analysis = AsyncMock(return_value={"is_violation": True, "confidence": 0.95})

    with patch(
        "app.routes.reviews.content_moderator.analyze_content",
        mock_analysis,
    ):
        response = test_client.post(
            f"/api/v1/shops/{shop.id}/reviews",
            json={"rating": 3, "comment": "bad words"},
            headers=headers,
        )

    assert response.status_code == 400
    assert "ガイドライン" in response.json()["detail"]

    list_response = test_client.get(f"/api/v1/shops/{shop.id}/reviews")
    assert list_response.json()["total"] == 0


def test_review_list_includes_stats_and_user_flag(test_client, test_db):
    shop = create_shop(test_db)
    user1, headers1 = create_user_and_headers(test_client, "stats1")
    _, headers2 = create_user_and_headers(test_client, "stats2")

    first_payload = {"rating": 5, "comment": "一番好きなお店"}
    second_payload = {"rating": 3, "comment": "スープは濃いめ"}

    assert (
        test_client.post(
            f"/api/v1/shops/{shop.id}/reviews",
            json=first_payload,
            headers=headers1,
        ).status_code
        == 201
    )
    assert (
        test_client.post(
            f"/api/v1/shops/{shop.id}/reviews",
            json=second_payload,
            headers=headers2,
        ).status_code
        == 201
    )

    response = test_client.get(
        f"/api/v1/shops/{shop.id}/reviews",
        headers=headers1,
    )
    assert response.status_code == 200

    data = response.json()
    assert data["total"] == 2
    assert pytest.approx(data["average_rating"], rel=1e-3) == 4.0
    assert data["rating_distribution"]["5"] == 1
    assert data["rating_distribution"]["3"] == 1
    assert data["user_review_id"] is not None
    assert any(review["user_id"] == user1 for review in data["reviews"])
