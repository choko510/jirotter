
import pytest

def test_create_post_authenticated(test_client, test_db):
    """認証済みユーザーによる投稿作成テスト"""
    # ユーザー登録
    user_data = {
        "username": "testuser",
        "email": "test@example.com",
        "password": "password123"
    }
    response = test_client.post("/api/v1/auth/register", json=user_data)
    token = response.json()["access_token"]
    
    headers = {
        "Authorization": f"Bearer {token}"
    }
    
    post_data = {
        "content": "これはテスト投稿です"
    }
    
    response = test_client.post("/api/v1/posts", json=post_data, headers=headers)
    data = response.json()
    
    assert response.status_code == 201
    assert data["content"] == "これはテスト投稿です"
    assert data["author_username"] == "testuser"

def test_create_post_unauthenticated(test_client):
    """未認証ユーザーによる投稿作成テスト"""
    post_data = {
        "content": "これはテスト投稿です"
    }
    
    response = test_client.post("/api/v1/posts", json=post_data)
    
    assert response.status_code == 401  # Unauthorized

def test_create_post_empty_content(test_client, test_db):
    """空の内容での投稿作成テスト"""
    # ユーザー登録
    user_data = {
        "username": "testuser",
        "email": "test@example.com",
        "password": "password123"
    }
    response = test_client.post("/api/v1/auth/register", json=user_data)
    token = response.json()["access_token"]
    
    headers = {
        "Authorization": f"Bearer {token}"
    }
    
    post_data = {
        "content": ""
    }
    
    response = test_client.post("/api/v1/posts", json=post_data, headers=headers)
    data = response.json()
    
    assert response.status_code == 400
    assert "detail" in data
    assert "必須です" in data["detail"]

def test_get_all_posts(test_client, test_db):
    """全ての投稿取得テスト"""
    # ユーザー登録と投稿作成
    user_data = {
        "username": "testuser",
        "email": "test@example.com",
        "password": "password123"
    }
    response = test_client.post("/api/v1/auth/register", json=user_data)
    token = response.json()["access_token"]
    
    headers = {
        "Authorization": f"Bearer {token}"
    }
    
    # 投稿作成
    post_data = {
        "content": "これはテスト投稿です"
    }
    test_client.post("/api/v1/posts", json=post_data, headers=headers)
    
    # 投稿一覧取得
    response = test_client.get("/api/v1/posts")
    data = response.json()
    
    assert response.status_code == 200
    assert "posts" in data
    assert "total" in data
    assert "pages" in data
    assert "current_page" in data
    assert len(data["posts"]) == 1

def test_get_single_post(test_client, test_db):
    """特定の投稿取得テスト"""
    # ユーザー登録と投稿作成
    user_data = {
        "username": "testuser",
        "email": "test@example.com",
        "password": "password123"
    }
    response = test_client.post("/api/v1/auth/register", json=user_data)
    token = response.json()["access_token"]
    
    headers = {
        "Authorization": f"Bearer {token}"
    }
    
    # 投稿作成
    post_data = {
        "content": "これはテスト投稿です"
    }
    response = test_client.post("/api/v1/posts", json=post_data, headers=headers)
    created_post = response.json()
    
    # 特定の投稿取得
    response = test_client.get(f"/api/v1/posts/{created_post['id']}")
    data = response.json()
    
    assert response.status_code == 200
    assert data["id"] == created_post["id"]
    assert data["content"] == "これはテスト投稿です"

def test_get_nonexistent_post(test_client):
    """存在しない投稿取得テスト"""
    response = test_client.get("/api/v1/posts/999")
    
    assert response.status_code == 404  # Not Found
    assert "detail" in response.json()

def test_delete_post_owner(test_client, test_db):
    """投稿所有者による削除テスト"""
    # ユーザー登録
