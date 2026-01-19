import pytest
from app.models import Post
from datetime import datetime, timedelta

def test_consecutive_spam_detection(test_client, test_db, auth_headers):
    # User posts safe content 3 times
    # Using Japanese content to avoid any English-specific heuristics
    content = "ラーメンはおいしいです。"

    post_ids = []

    # Post 1
    response = test_client.post(
        "/api/v1/posts",
        data={"content": content},
        headers=auth_headers
    )
    assert response.status_code == 201, f"Failed to create post 1: {response.text}"
    data = response.json()
    assert data["is_shadow_banned"] is False, f"First post should not be banned. Reason: {data.get('shadow_ban_reason')}"
    post_ids.append(data["id"])

    # Post 2
    response = test_client.post(
        "/api/v1/posts",
        data={"content": content},
        headers=auth_headers
    )
    assert response.status_code == 201, f"Failed to create post 2: {response.text}"
    data = response.json()
    # With score 0.0 + 3.0 (duplicate) = 3.0 < 3.5, this should pass
    assert data["is_shadow_banned"] is False, f"Second post should not be banned. Reason: {data.get('shadow_ban_reason')}"
    post_ids.append(data["id"])

    # Post 3 (Triggers ban)
    response = test_client.post(
        "/api/v1/posts",
        data={"content": content},
        headers=auth_headers
    )
    assert response.status_code == 201, f"Failed to create post 3: {response.text}"
    data = response.json()

    # Check current post is shadow banned
    assert data["is_shadow_banned"] is True, "Third post should be shadow banned"
    assert "検出" in (data["shadow_ban_reason"] or "")

    # Check previous posts are now shadow banned
    # We expire all to ensure we fetch fresh data from DB
    test_db.expire_all()
    for pid in post_ids:
        post = test_db.query(Post).filter(Post.id == pid).first()
        assert post.is_shadow_banned is True, f"Previous post {pid} was not retroactively banned"
