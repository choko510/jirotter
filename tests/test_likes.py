import pytest

def create_user_and_get_token(test_client, user_id, email, password="password123!"):
    """ユーザーを作成し、トークンを返すヘルパー関数"""
    user_data = {"id": user_id, "email": email, "password": password}
    response = test_client.post("/api/v1/auth/register", json=user_data)
    assert response.status_code == 201, f"User creation failed for {user_id}. Response: {response.text}"
    return response.json()["access_token"]

def create_post(test_client, token, content="Test Post"):
    """投稿を作成し、投稿データを返すヘルパー関数"""
    headers = {"Authorization": f"Bearer {token}"}
    # TestClientが適切なContent-Typeを推測できるように、jsonではなくdataを使用
    post_data = {"content": content}
    response = test_client.post("/api/v1/posts", data=post_data, headers=headers)
    assert response.status_code == 201, f"Post creation failed. Response: {response.text}"
    return response.json()

def test_like_and_unlike_post(test_client, test_db):
    """投稿への「いいね」と「いいね」解除のテスト"""
    # ユーザーと投稿を作成
    token = create_user_and_get_token(test_client, "luser1", "luser1@example.com")
    post = create_post(test_client, token)
    post_id = post["id"]
    headers = {"Authorization": f"Bearer {token}"}

    # 投稿に「いいね」する
    response = test_client.post(f"/api/v1/posts/{post_id}/like", headers=headers)
    assert response.status_code == 201
    like_data = response.json()
    assert like_data["post_id"] == post_id
    assert like_data["user_id"] == "luser1"

    # 投稿の状態を確認（いいねカウントが増えているか）
    response = test_client.get(f"/api/v1/posts/{post_id}")
    assert response.json()["likes_count"] == 1

    # 同じ投稿に再度「いいね」しようとするとエラーになる
    response = test_client.post(f"/api/v1/posts/{post_id}/like", headers=headers)
    assert response.status_code == 400
    assert "already liked" in response.json()["detail"]

    # 「いいね」を解除する
    response = test_client.delete(f"/api/v1/posts/{post_id}/like", headers=headers)
    assert response.status_code == 204

    # 投稿の状態を確認（いいねカウントが減っているか）
    response = test_client.get(f"/api/v1/posts/{post_id}")
    assert response.json()["likes_count"] == 0

    # すでに解除済みの「いいね」を再度解除しようとするとエラーになる
    response = test_client.delete(f"/api/v1/posts/{post_id}/like", headers=headers)
    assert response.status_code == 400
    assert "not liked" in response.json()["detail"]

def test_like_nonexistent_post(test_client, test_db):
    """存在しない投稿への「いいね」テスト"""
    token = create_user_and_get_token(test_client, "luser2", "luser2@example.com")
    headers = {"Authorization": f"Bearer {token}"}
    response = test_client.post("/api/v1/posts/99999/like", headers=headers)
    assert response.status_code == 404

def test_like_post_unauthenticated(test_client, test_db):
    """未認証ユーザーによる「いいね」テスト"""
    token = create_user_and_get_token(test_client, "luser3", "luser3@example.com")
    post = create_post(test_client, token)
    post_id = post["id"]

    # ヘッダーなしでリクエスト
    response = test_client.post(f"/api/v1/posts/{post_id}/like")
    assert response.status_code == 401
