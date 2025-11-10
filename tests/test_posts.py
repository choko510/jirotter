
import io
import pytest

from app.models import RamenShop, Reply, User

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


def test_create_post_with_nonexistent_mention(test_client, test_db):
    user_data = {
        "id": "mentionposter",
        "email": "mentionposter@example.com",
        "password": "password123!"
    }
    register_response = test_client.post("/api/v1/auth/register", json=user_data)
    token = register_response.json()["access_token"]

    headers = {
        "Authorization": f"Bearer {token}"
    }

    post_data = {
        "content": "こんにちは @ghostuser"
    }

    response = test_client.post("/api/v1/posts", data=post_data, headers=headers)

    assert response.status_code == 400
    assert "@ghostuser" in response.json()["detail"]


def test_create_post_mentions_jirok_triggers_ai_reply(test_client, test_db):
    user_data = {
        "id": "aiinvoker",
        "email": "aiinvoker@example.com",
        "password": "password123!"
    }
    register_response = test_client.post("/api/v1/auth/register", json=user_data)
    token = register_response.json()["access_token"]

    headers = {
        "Authorization": f"Bearer {token}"
    }

    post_content = "@JiroK 今日のおすすめトッピングは？"
    response = test_client.post("/api/v1/posts", data={"content": post_content}, headers=headers)

    assert response.status_code == 201

    data = response.json()
    post_id = data["id"]

    ai_user = test_db.query(User).filter(User.id == "jirok").first()
    assert ai_user is not None

    ai_reply = test_db.query(Reply).filter(Reply.post_id == post_id, Reply.user_id == "jirok").first()
    assert ai_reply is not None
    assert 0 < len(ai_reply.content) <= 200

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


def test_get_posts_filtered_by_shop(test_client, test_db, auth_headers):
    """店舗IDに紐づく投稿と店名を含む投稿のみが返ることを確認"""

    shop = RamenShop(
        name="テストラーメン",
        address="東京都千代田区1-1-1",
        latitude=35.0,
        longitude=139.0
    )
    test_db.add(shop)
    test_db.commit()
    test_db.refresh(shop)

    # 店舗に紐付いた投稿
    post_with_shop = {
        "content": "店舗で食べました",
        "shop_id": str(shop.id)
    }
    response = test_client.post("/api/v1/posts", data=post_with_shop, headers=auth_headers)
    assert response.status_code == 201
    associated_post_id = response.json()["id"]

    # 店名を本文に含む投稿
    post_with_name = {
        "content": f"今日は{shop.name}に行きました"
    }
    response = test_client.post("/api/v1/posts", data=post_with_name, headers=auth_headers)
    assert response.status_code == 201
    named_post_id = response.json()["id"]

    # 関係のない投稿
    unrelated_post = {
        "content": "別のお店の感想"
    }
    response = test_client.post("/api/v1/posts", data=unrelated_post, headers=auth_headers)
    assert response.status_code == 201
    unrelated_post_id = response.json()["id"]

    response = test_client.get(f"/api/v1/posts?shop_id={shop.id}")
    assert response.status_code == 200
    data = response.json()

    returned_ids = [post["id"] for post in data["posts"]]

    assert associated_post_id in returned_ids
    assert named_post_id in returned_ids
    assert unrelated_post_id not in returned_ids

def test_get_nonexistent_post(test_client):
    """存在しない投稿取得テスト"""
    response = test_client.get("/api/v1/posts/999")
    
    assert response.status_code == 404

def test_delete_post_owner(test_client, test_db):
    """投稿所有者による削除テスト"""
    # ユーザー登録またはログイン
    user_data = {
        "id": "deleteowner",
        "email": "deleteowner@example.com",
        "password": "password123!"
    }
    login_data = {"id": user_data["id"], "password": user_data["password"]}
    response = test_client.post("/api/v1/auth/login", json=login_data)
    if response.status_code != 200:
        response = test_client.post("/api/v1/auth/register", json=user_data)

    token = response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 投稿作成
    post_data = {"content": "削除される投稿"}
    response = test_client.post("/api/v1/posts", data=post_data, headers=headers)
    assert response.status_code == 201
    created_post = response.json()

    # 投稿削除（所有者）
    response = test_client.delete(f"/api/v1/posts/{created_post['id']}", headers=headers)
    assert response.status_code == 200

    # 削除後に取得すると 404 になることを確認
    response = test_client.get(f"/api/v1/posts/{created_post['id']}")
    assert response.status_code == 404


def test_delete_post_by_non_owner_forbidden(test_client, test_db):
    """他人の投稿削除を禁止するテスト"""
    # 投稿者ユーザー作成
    owner_data = {
        "id": "postowner",
        "email": "postowner@example.com",
        "password": "password123!"
    }
    owner_token = test_client.post("/api/v1/auth/register", json=owner_data).json()["access_token"]
    owner_headers = {"Authorization": f"Bearer {owner_token}"}

    # 所有者が投稿作成
    post_data = {"content": "他人には削除できない投稿"}
    response = test_client.post("/api/v1/posts", data=post_data, headers=owner_headers)
    assert response.status_code == 201
    created_post = response.json()

    # 別ユーザー（非所有者）作成
    other_data = {
        "id": "notowner",
        "email": "notowner@example.com",
        "password": "password123!"
    }
    other_token = test_client.post("/api/v1/auth/register", json=other_data).json()["access_token"]
    other_headers = {"Authorization": f"Bearer {other_token}"}

    # 非所有者が削除を試みる -> 403 を期待
    response = test_client.delete(f"/api/v1/posts/{created_post['id']}", headers=other_headers)
    assert response.status_code in (403, 404)

    # 元の所有者の投稿が残っている（少なくとも 404 ではない）ことを確認
    # 実装によっては 200/403 等のパターンがあるため、存在確認にフォーカス
    owner_view = test_client.get(f"/api/v1/posts/{created_post['id']}", headers=owner_headers)
    assert owner_view.status_code != 404


def test_delete_post_unauthenticated(test_client, test_db):
    """未認証ユーザーによる削除は401となることを確認"""
    # 投稿者ユーザー作成
    owner_data = {
        "id": "deleteunauth",
        "email": "deleteunauth@example.com",
        "password": "password123!"
    }
    owner_token = test_client.post("/api/v1/auth/register", json=owner_data).json()["access_token"]
    owner_headers = {"Authorization": f"Bearer {owner_token}"}

    # 所有者が投稿作成
    post_data = {"content": "未認証ユーザーには削除させない投稿"}
    response = test_client.post("/api/v1/posts", data=post_data, headers=owner_headers)
    assert response.status_code == 201
    created_post = response.json()

    # 認証なしで削除を試みる -> 401 を期待
    response = test_client.delete(f"/api/v1/posts/{created_post['id']}")
    assert response.status_code == 401


def test_post_rate_limit(test_client, test_db):
    """短時間での投稿回数制限のテスト"""
    user_data = {
        "id": "ratelimituser",
        "email": "ratelimit@example.com",
        "password": "password123!"
    }
    response = test_client.post("/api/v1/auth/register", json=user_data)
    token = response.json()["access_token"]

    headers = {
        "Authorization": f"Bearer {token}"
    }

    for i in range(5):
        post_data = {"content": f"連続投稿テスト {i}"}
        result = test_client.post("/api/v1/posts", data=post_data, headers=headers)
        assert result.status_code == 201, result.text

    overflow_post = {"content": "6件目の投稿"}
    response = test_client.post("/api/v1/posts", data=overflow_post, headers=headers)

    assert response.status_code == 429
    assert "短時間に過剰なリクエスト" in response.json()["detail"]


def test_post_spam_detection_shadow_bans(test_client, test_db):
    """スパム投稿がシャドウバンされることを確認"""
    user_data = {
        "id": "spamuser",
        "email": "spam@example.com",
        "password": "password123!"
    }
    response = test_client.post("/api/v1/auth/register", json=user_data)
    token = response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    spam_content = "完全無料で稼げる！ 完全無料で稼げる！ http://example.com http://example.com http://example.com"
    post_data = {"content": spam_content}

    response = test_client.post("/api/v1/posts", data=post_data, headers=headers)
    created = response.json()

    assert response.status_code == 201
    assert created["is_shadow_banned"] is True
    assert "スパム" in created["shadow_ban_reason"]

    post_id = created["id"]

    # 作成者は詳細を取得できる
    detail_response = test_client.get(f"/api/v1/posts/{post_id}", headers=headers)
    assert detail_response.status_code == 200
    assert detail_response.json()["is_shadow_banned"] is True

    # 別ユーザーを作成
    other_data = {
        "id": "legituser",
        "email": "legit@example.com",
        "password": "password123!"
    }
    other_token = test_client.post("/api/v1/auth/register", json=other_data).json()["access_token"]
    other_headers = {"Authorization": f"Bearer {other_token}"}

    # 他ユーザーのタイムラインには表示されない
    other_timeline = test_client.get("/api/v1/posts", headers=other_headers).json()["posts"]
    assert post_id not in [post["id"] for post in other_timeline]

    # 未ログインのタイムラインにも表示されない
    public_timeline = test_client.get("/api/v1/posts").json()["posts"]
    assert post_id not in [post["id"] for post in public_timeline]

    # 作成者のタイムラインには表示される
    author_timeline = test_client.get("/api/v1/posts", headers=headers).json()["posts"]
    assert post_id in [post["id"] for post in author_timeline]

    # 他ユーザーは直接アクセスできない
    other_detail = test_client.get(f"/api/v1/posts/{post_id}", headers=other_headers)
    assert other_detail.status_code == 404
