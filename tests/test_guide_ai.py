import pytest
from unittest.mock import patch, AsyncMock

def create_user_and_get_token(test_client, user_id, email, password="password123!"):
    """ユーザーを作成し、トークンを返すヘルパー関数"""
    # ユーザー登録
    register_data = {
        "id": user_id,
        "email": email,
        "password": password
    }
    test_client.post("/api/v1/auth/register", json=register_data)
    
    # ログインしてトークンを取得
    login_data = {
        "id": user_id,
        "password": password
    }
    response = test_client.post("/api/v1/auth/login", json=login_data)
    return response.json()["access_token"]

@pytest.mark.asyncio
async def test_ask_guide_success(test_client):
    token = create_user_and_get_token(test_client, "testuser", "test@example.com")
    headers = {"Authorization": f"Bearer {token}"}
    
    with patch("app.routes.guide.ask_ai_guide", new_callable=AsyncMock) as mock_ask:
        mock_ask.return_value = "これはテスト回答です。"
        
        response = test_client.post("/api/v1/guide/ask", json={"question": "テスト質問"}, headers=headers)
        
        assert response.status_code == 200, f"Status: {response.status_code}, Body: {response.text}"
        assert response.json() == {"answer": "これはテスト回答です。"}
        mock_ask.assert_called_once_with("テスト質問")

@pytest.mark.asyncio
async def test_ask_guide_empty_question(test_client):
    token = create_user_and_get_token(test_client, "testuser2", "test2@example.com")
    headers = {"Authorization": f"Bearer {token}"}
    
    response = test_client.post("/api/v1/guide/ask", json={"question": "   "}, headers=headers)
    assert response.status_code == 400

@pytest.mark.asyncio
async def test_ask_guide_unauthenticated(test_client):
    """認証なしでのアクセステスト"""
    response = test_client.post("/api/v1/guide/ask", json={"question": "テスト質問"})
    assert response.status_code == 401
