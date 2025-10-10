import pytest

def test_register_user(test_client, test_db):
    """ユーザー登録のテスト"""
    user_data = {
        "id": "newuser",
        "email": "newuser@example.com",
        "password": "newpassword123"
    }
    
    response = test_client.post("/api/v1/auth/register", json=user_data)
    data = response.json()
    
    assert response.status_code == 201
    assert "access_token" in data
    assert data["user"]["id"] == "newuser"
    assert data["user"]["email"] == "newuser@example.com"

def test_register_duplicate_id(test_client, test_db):
    """重複ユーザーIDでの登録テスト"""
    user_data1 = {
        "id": "testuser",
        "email": "test1@example.com",
        "password": "password123"
    }
    test_client.post("/api/v1/auth/register", json=user_data1)
    
    user_data2 = {
        "id": "testuser",
        "email": "test2@example.com",
        "password": "password123"
    }
    
    response = test_client.post("/api/v1/auth/register", json=user_data2)
    data = response.json()
    
    assert response.status_code == 409
    assert "detail" in data
    assert "このユーザーIDは既に使用されています" in data["detail"]

def test_register_duplicate_email(test_client, test_db):
    """重複メールアドレスでの登録テスト"""
    user_data1 = {
        "id": "user1",
        "email": "test@example.com",
        "password": "password123"
    }
    test_client.post("/api/v1/auth/register", json=user_data1)
    
    user_data2 = {
        "id": "user2",
        "email": "test@example.com",
        "password": "password123"
    }
    
    response = test_client.post("/api/v1/auth/register", json=user_data2)
    data = response.json()
    
    assert response.status_code == 409
    assert "detail" in data
    assert "このメールアドレスは既に登録されています" in data["detail"]

def test_login_success(test_client, test_db):
    """ログイン成功のテスト"""
    user_data = {
        "id": "testuser",
        "email": "test@example.com",
        "password": "password123"
    }
    test_client.post("/api/v1/auth/register", json=user_data)
    
    login_data = {
        "id": "testuser",
        "password": "password123"
    }
    
    response = test_client.post("/api/v1/auth/login", json=login_data)
    data = response.json()
    
    assert response.status_code == 200
    assert "access_token" in data
    assert data["user"]["id"] == "testuser"

def test_login_wrong_password(test_client, test_db):
    """パスワード誤りのログインテスト"""
    user_data = {
        "id": "testuser",
        "email": "test@example.com",
        "password": "password123"
    }
    test_client.post("/api/v1/auth/register", json=user_data)
    
    login_data = {
        "id": "testuser",
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
        "id": "nonexistent",
        "password": "password123"
    }
    
    response = test_client.post("/api/v1/auth/login", json=login_data)
    data = response.json()
    
    assert response.status_code == 401
    assert "detail" in data
    assert "正しくありません" in data["detail"]

def test_get_profile_authenticated(test_client, test_db):
    """認証済みユーザーのプロフィール取得テスト"""
    user_data = {
        "id": "testuser",
        "email": "test@example.com",
        "password": "password123"
    }
    register_response = test_client.post("/api/v1/auth/register", json=user_data)
    token = register_response.json()["access_token"]
    
    headers = {
        "Authorization": f"Bearer {token}"
    }
    
    response = test_client.get("/api/v1/users/testuser", headers=headers)
    data = response.json()
    
    assert response.status_code == 200
    assert data["id"] == "testuser"
    assert data["email"] == "test@example.com"
    assert "followers_count" in data
