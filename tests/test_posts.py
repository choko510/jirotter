
import io
import pytest

def test_create_post_authenticated(test_client, test_db):
    """認証済みユーザーによる投稿作成テスト"""
    # ユーザー登録
    user_data = {
        "id": "testuser",
        "email": "test@example.com",
        "password": "password123!"
    }
    response = test_client.post("/api/v1/auth/register", json=user_data)
    token = response.json()["access_token"]
    
    headers = {
        "Authorization": f"Bearer {token}"
    }
    
    post_data = {
        "content": "This is a test post."
    }
    
    response = test_client.post("/api/v1/posts", data=post_data, headers=headers)
    data = response.json()
    
    assert response.status_code == 201
    assert data["content"] == "This is a test post."
    assert data["author_username"] == "testuser"


def test_create_post_with_short_video(test_client, test_db):
    """10秒以内の動画付き投稿作成テスト"""
    user_data = {
        "id": "videouser",
        "email": "video@example.com",
        "password": "password123!"
    }
    response = test_client.post("/api/v1/auth/register", json=user_data)
    token = response.json()["access_token"]

    headers = {
        "Authorization": f"Bearer {token}"
    }

    video_content = io.BytesIO(b"fake video data")
    files = {
        "video": ("sample.mp4", video_content, "video/mp4")
    }
    data = {
        "content": "Video post",
        "video_duration": "9"
    }

    response = test_client.post("/api/v1/posts", data=data, files=files, headers=headers)
    data = response.json()

    assert response.status_code == 201
    assert data["video_url"].endswith(".mp4")
    assert data["video_duration"] == 9.0


def test_create_post_with_long_video_rejected(test_client, test_db):
    """11秒以上の動画は拒否されるテスト"""
    user_data = {
        "id": "longvideouser",
        "email": "longvideo@example.com",
        "password": "password123!"
    }
    response = test_client.post("/api/v1/auth/register", json=user_data)
    token = response.json()["access_token"]

    headers = {
        "Authorization": f"Bearer {token}"
    }

    video_content = io.BytesIO(b"fake video data")
    files = {
        "video": ("sample.mp4", video_content, "video/mp4")
    }
    data = {
        "content": "Long video post",
        "video_duration": "12"
    }

    response = test_client.post("/api/v1/posts", data=data, files=files, headers=headers)

    assert response.status_code == 400
    assert response.json()["detail"] == "動画は10秒以内にしてください"

def test_create_post_unauthenticated(test_client):
    """未認証ユーザーによる投稿作成テスト"""
    post_data = {
        "content": "This is a test post."
    }
    
    response = test_client.post("/api/v1/posts", data=post_data)
    
    assert response.status_code == 401  # Unauthorized

def test_create_post_empty_content(test_client, test_db):
    """空の内容での投稿作成テスト"""
    # ユーザー登録
    user_data = {
        "id": "testuser",
        "email": "test@example.com",
        "password": "password123!"
    }
    response = test_client.post("/api/v1/auth/register", json=user_data)
    token = response.json()["access_token"]
    
    headers = {
        "Authorization": f"Bearer {token}"
    }
    
    post_data = {
        "content": ""
    }
    
    response = test_client.post("/api/v1/posts", data=post_data, headers=headers)

    assert response.status_code == 400

def test_create_post_with_invalid_shop_id(test_client, test_db):
    """存在しない店舗IDを指定した場合の投稿作成テスト"""
    # ユーザー登録
    user_data = {
        "id": "invalidshopuser",
        "email": "invalidshop@example.com",
        "password": "password123!"
    }
    response = test_client.post("/api/v1/auth/register", json=user_data)
    token = response.json()["access_token"]

    headers = {
        "Authorization": f"Bearer {token}"
    }

    post_data = {
        "content": "店舗が存在しない場合のテスト投稿",
        "shop_id": "999999" # フォームデータとして送信するため文字列に
    }

    response = test_client.post("/api/v1/posts", data=post_data, headers=headers)
    data = response.json()

    assert response.status_code == 400
    assert data["detail"] == "指定された店舗が存在しません"

def test_get_all_posts(test_client, test_db):
    """全ての投稿取得テスト"""
    # ユーザー登録と投稿作成
    user_data = {
        "id": "testuser",
        "email": "test@example.com",
        "password": "password123!"
    }
    response = test_client.post("/api/v1/auth/register", json=user_data)
    token = response.json()["access_token"]
    
    headers = {
        "Authorization": f"Bearer {token}"
    }
    
    # 投稿作成
    post_data = {
        "content": "This is a test post."
    }
    response = test_client.post("/api/v1/posts", data=post_data, headers=headers)
    assert response.status_code == 201
    
    # 投稿一覧取得
    response = test_client.get("/api/v1/posts")
    data = response.json()
    
    assert response.status_code == 200
    assert "posts" in data
    assert len(data["posts"]) >= 1

def test_get_single_post(test_client, test_db):
    """特定の投稿取得テスト"""
    # ユーザー登録と投稿作成
    user_data = {
        "id": "testuser",
        "email": "test@example.com",
        "password": "password123!"
    }
    response = test_client.post("/api/v1/auth/register", json=user_data)
    token = response.json()["access_token"]
    
    headers = {
        "Authorization": f"Bearer {token}"
    }
    
    # 投稿作成
    post_data = {
        "content": "This is a test post."
    }
    response = test_client.post("/api/v1/posts", data=post_data, headers=headers)
    created_post = response.json()
    
    # 特定の投稿取得
    response = test_client.get(f"/api/v1/posts/{created_post['id']}")
    data = response.json()
    
    assert response.status_code == 200
    assert data["id"] == created_post["id"]
    assert data["content"] == "This is a test post."

def test_get_nonexistent_post(test_client):
    """存在しない投稿取得テスト"""
    response = test_client.get("/api/v1/posts/999")
    
    assert response.status_code == 404

def test_delete_post_owner(test_client, test_db):
    """投稿所有者による削除テスト"""
    # ユーザー登録
    user_data = {
        "id": "testuser",
        "email": "test@example.com",
        "password": "password123!"
    }
    # 既存のユーザーでログインを試みる
    login_data = {"id": "testuser", "password": "password123!"}
    response = test_client.post("/api/v1/auth/login", json=login_data)
    if response.status_code != 200:
        response = test_client.post("/api/v1/auth/register", json=user_data)

    token = response.json()["access_token"]

    headers = {
        "Authorization": f"Bearer {token}"
    }

    # 投稿作成
    post_data = {
        "content": "削除される投稿"
    }
    response = test_client.post("/api/v1/posts", data=post_data, headers=headers)
    created_post = response.json()

    # 投稿削除
    response = test_client.delete(f"/api/v1/posts/{created_post['id']}", headers=headers)

    assert response.status_code == 200

    # 削除されたか確認
    response = test_client.get(f"/api/v1/posts/{created_post['id']}")
    assert response.status_code == 404
