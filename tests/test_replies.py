import pytest

def create_user_and_get_token(test_client, user_id, email, password="password123!"):
    """ユーザーを作成し、トークンを返すヘルパー関数"""
    user_data = {"id": user_id, "email": email, "password": password}
    response = test_client.post("/api/v1/auth/register", json=user_data)
    assert response.status_code == 201, f"User creation failed for {user_id}. Response: {response.text}"
    return response.json()["access_token"]

def create_post(test_client, token, content="Test Post for Reply"):
    """投稿を作成し、投稿データを返すヘルパー関数"""
    headers = {"Authorization": f"Bearer {token}"}
    post_data = {"content": content}
    response = test_client.post("/api/v1/posts", data=post_data, headers=headers)
    assert response.status_code == 201, f"Post creation failed. Response: {response.text}"
    return response.json()

def test_create_and_get_replies(test_client, test_db):
    """投稿への返信作成と一覧取得のテスト"""
    # ユーザーと投稿を作成
    token = create_user_and_get_token(test_client, "ruser1", "ruser1@example.com")
    post = create_post(test_client, token)
    post_id = post["id"]
    headers = {"Authorization": f"Bearer {token}"}

    # 1つ目の返信を作成
    reply_content1 = "This is the first reply."
    reply_data1 = {"content": reply_content1}
    response = test_client.post(f"/api/v1/posts/{post_id}/replies", json=reply_data1, headers=headers)
    assert response.status_code == 201
    created_reply1 = response.json()
    assert created_reply1["content"] == reply_content1
    assert created_reply1["author_username"] == "ruser1"

    # 2つ目の返信を作成
    reply_content2 = "This is the second reply."
    reply_data2 = {"content": reply_content2}
    response = test_client.post(f"/api/v1/posts/{post_id}/replies", json=reply_data2, headers=headers)
    assert response.status_code == 201

    # 返信一覧を取得
    response = test_client.get(f"/api/v1/posts/{post_id}/replies")
    assert response.status_code == 200
    replies = response.json()
    assert len(replies) == 2

    # 投稿の返信カウントを確認
    response = test_client.get(f"/api/v1/posts/{post_id}")
    assert response.json()["replies_count"] == 2


def test_create_reply_to_nonexistent_post(test_client, test_db):
    """存在しない投稿への返信テスト"""
    token = create_user_and_get_token(test_client, "ruser2", "ruser2@example.com")
    headers = {"Authorization": f"Bearer {token}"}
    reply_data = {"content": "some content"}
    response = test_client.post("/api/v1/posts/99999/replies", json=reply_data, headers=headers)
    assert response.status_code == 404

def test_create_reply_unauthenticated(test_client, test_db):
    """未認証ユーザーによる返信テスト"""
    token = create_user_and_get_token(test_client, "ruser3", "ruser3@example.com")
    post = create_post(test_client, token)
    post_id = post["id"]
    reply_data = {"content": "some content"}
    response = test_client.post(f"/api/v1/posts/{post_id}/replies", json=reply_data)
    assert response.status_code == 401

def test_create_empty_reply(test_client, test_db):
    """空のコンテンツで返信を作成するテスト"""
    token = create_user_and_get_token(test_client, "ruser4", "ruser4@example.com")
    post = create_post(test_client, token)
    post_id = post["id"]
    headers = {"Authorization": f"Bearer {token}"}

    reply_data = {"content": ""} # 空のコンテンツ
    response = test_client.post(f"/api/v1/posts/{post_id}/replies", json=reply_data, headers=headers)

    assert response.status_code == 400
    assert "返信内容は必須です" in response.json()["detail"]


from unittest.mock import patch, AsyncMock
from app.utils.rate_limiter import rate_limiter
from fastapi import HTTPException, status

async def mock_rate_limit_exceeded(key: str, limit: int, window_seconds: int):
    raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="短時間に過剰なリクエストが行われました。")

def test_reply_rate_limit(test_client, test_db):
    """短時間での返信回数制限のテスト"""
    token = create_user_and_get_token(test_client, "ruser5", "ruser5@example.com")
    post = create_post(test_client, token)
    post_id = post["id"]
    headers = {"Authorization": f"Bearer {token}"}

    # Geminiのモデレーションをモックして、違反なしとして返す
    with patch("app.utils.content_moderator.content_moderator.analyze_content", new_callable=AsyncMock) as mock_analyze:
        mock_analyze.return_value = {"is_violation": False, "confidence": 0.0}

        # First 20 replies should succeed
        for i in range(20):
            reply_data = {"content": f"定型返信 {i}"}
            response = test_client.post(f"/api/v1/posts/{post_id}/replies", json=reply_data, headers=headers)
            assert response.status_code == 201

        # Patch the rate limiter to simulate exceeding the limit
        with patch.object(rate_limiter, "hit", mock_rate_limit_exceeded):
            overflow_reply = {"content": "21件目の返信"}
            response = test_client.post(f"/api/v1/posts/{post_id}/replies", json=overflow_reply, headers=headers)

            assert response.status_code == 429
            assert "短時間に過剰なリクエスト" in response.json()["detail"]


def test_reply_spam_detection_shadow_bans(test_client, test_db):
    """スパム返信がシャドウバンされることを確認"""
    token = create_user_and_get_token(test_client, "ruser6", "ruser6@example.com")
    post = create_post(test_client, token)
    post_id = post["id"]
    headers = {"Authorization": f"Bearer {token}"}

    spam_reply = {
        "content": "無料で稼げる！無料で稼げる！ http://example.com http://example.com http://example.com"
    }

    # Geminiのモデレーションをモックして、違反なし（または低信頼度）として返す
    # これにより、spam_detectorによるシャドウバンのロジックのみをテストできる
    with patch("app.utils.content_moderator.content_moderator.analyze_content", new_callable=AsyncMock) as mock_analyze:
        mock_analyze.return_value = {"is_violation": False, "confidence": 0.0}
        
        response = test_client.post(f"/api/v1/posts/{post_id}/replies", json=spam_reply, headers=headers)
        created = response.json()

        assert response.status_code == 201
        assert created["is_shadow_banned"] is True
        assert "スパム" in created["shadow_ban_reason"]

        # 公開の返信一覧には表示されない
        public_replies = test_client.get(f"/api/v1/posts/{post_id}/replies").json()
        assert len(public_replies) == 0

        # 作成者は返信を確認できる
        author_replies = test_client.get(f"/api/v1/posts/{post_id}/replies", headers=headers).json()
        assert len(author_replies) == 1
        assert author_replies[0]["is_shadow_banned"] is True

        # 別ユーザーを作成しても表示されない
        other_token = create_user_and_get_token(test_client, "ruser7", "ruser7@example.com")
        other_headers = {"Authorization": f"Bearer {other_token}"}
        other_replies = test_client.get(f"/api/v1/posts/{post_id}/replies", headers=other_headers).json()
        assert len(other_replies) == 0
