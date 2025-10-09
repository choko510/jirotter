import pytest

def test_register_user(test_client, test_db):
    """ユーザー登録のテスト"""
    user_data = {
        "username": "newuser",
        "email": "newuser@example.com",
        "password": "newpassword123"
    }
    
    response = test_client.post("/api/v1/auth/register", json=user_data)
    data = response.json()
    
    assert response.status_code == 201
    assert "access_token" in data
    assert data["user"]["username"] == "newuser"
    assert data["user"]["email"] == "newuser@example.com"

def test_register_duplicate_username(test_client, test_db):
    """重複ユーザー名での登録テスト"""
    # 最初のユーザー登録
    user_data1 = {
        "username": "testuser",
        "email": "test1@example.com",
        "password": "password123"
    }
    test_client.post("/api/v1/auth/register", json=user_data1)
    
    # 重複ユーザー名での登録
    user_data2 = {
        "username": "testuser",  # 既存のユーザー名
        "email": "test2@example.com",
        "password": "password123"
    }
    
    response = test_client.post("/api/v1/auth/register", json=user_data2)
    data = response.json()
    
    assert response.status_code == 422
    assert "detail" in data
    assert "username" in data["detail"]
    assert "既に使用されています" in data["detail"]["username"]

def test_register_duplicate_email(test_client, test_db):
    """重複メールアドレスでの登録テスト"""
    # 最初のユーザー登録
    user_data1 = {
        "username": "user1",
        "email": "test@example.com",
        "password": "password123"
    }
    test_client.post("/api/v1/auth/register", json=user_data1)
    
    # 重複メールアドレスでの登録
    user_data2 = {
        "username": "user2",
        "email": "test@example.com",  # 既存のメールアドレス
        "password": "password123"
    }
    
    response = test_client.post("/api/v1/auth/register", json=user_data2)
    data = response.json()
    
    assert response.status_code == 422
    assert "detail" in data
    assert "email" in data["detail"]
    assert "既に登録されています" in data["detail"]["email"]

def test_login_success(test_client, test_db):
    """ログイン成功のテスト"""
    # ユーザー登録
    user_data = {
        "username": "testuser",
        "email": "test@example.com",
        "password": "password123"
    }
    test_client.post("/api/v1/auth/register", json=user_data)
    
    # ログイン
    login_data = {
        "username": "testuser",
        "password": "password123"
    }
    
    response = test_client.post("/api/v1/auth/login", json=login_data)
    data = response.json()
    
    assert response.status_code == 200
    assert "access_token" in data
    assert data["user"]["username"] == "testuser"

def test_login_wrong_password(test_client, test_db):
    """パスワード誤りのログインテスト"""
    # ユーザー登録
    user_data = {
        "username": "testuser",
        "email": "test@example.com",
        "password": "password123"
    }
    test_client.post("/api/v1/auth/register", json=user_data)
    
    # 誤ったパスワードでログイン
    login_data = {
        "username": "testuser",
        "password": "wrongpassword"
    }
    
    response = test_client.post("/api/v1/auth/login", json=login_data)
    data = response.json()
    
    assert response.status_code == 401
    assert "detail" in data
    assert "正しくありません" in data["detail"]

def test_login_nonexistent_user(test_client, test_db):
    """存在しないユーザーでのログインテスト"""
    login_data = {
        "username": "nonexistent",
        "password": "password123"
    }
    
    response = test_client.post("/api/v1/auth/login", json=login_data)
    data = response.json()
    
    assert response.status_code == 401
    assert "detail" in data
    assert "正しくありません" in data["detail"]

def test_get_profile_authenticated(test_client, test_db):
    """認証済みユーザーのプロフィール取得テスト"""
    # ユーザー登録
    user_data = {
        "username": "testuser",
        "email": "test@example.com",
        "password": "password123"
    }
    response = test_client.post("/api/v1/auth/register", json=user_data)
    token = response.json()["access_token"]
    
    # プロフィール取得
    headers = {
        "Authorization": f"Bearer {token}"
    }
    
    response = test_client.get("/api/v1/auth/profile", headers=headers)
    data = response.json()
    
    assert response.status_code == 200
    assert data["username"] == "testuser"
    assert data["email"] == "test@example.com"

def test_get_profile_unauthenticated(test_client):
    """未認証ユーザーのプロフィール取得テスト"""
    response = test_client.get("/api/v1/auth/profile")
    
    assert response.status_code == 401  # Unauthorized
    assert "detail" in response.json()