import pytest

# ユーザーを作成するためのヘルパー関数
def create_user(test_client, user_id, email, password="password123!"):
    user_data = {"id": user_id, "email": email, "password": password}
    response = test_client.post("/api/v1/auth/register", json=user_data)
    assert response.status_code == 201, f"User creation failed for {user_id}. Response: {response.text}"
    return response.json()


def test_get_user_profile(test_client, test_db):
    """ユーザープロフィールの取得テスト"""
    create_user(test_client, "uprofile", "uprofile@example.com")
    response = test_client.get("/api/v1/users/uprofile")
    data = response.json()
    assert response.status_code == 200
    assert data["id"] == "uprofile"
    assert data["username"] == "uprofile" # 初期状態ではusernameはidと同じ
    assert "followers_count" in data
    assert "following_count" in data

def test_get_nonexistent_user_profile(test_client, test_db):
    """存在しないユーザープロフィールの取得テスト"""
    response = test_client.get("/api/v1/users/nonexistentuser")
    assert response.status_code == 404

def test_update_user_profile(test_client, test_db):
    """ユーザープロフィールの更新テスト"""
    user = create_user(test_client, "uupdate", "uupdate@example.com")
    token = user["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    update_data = {"username": "UpdatedName", "bio": "This is my new bio."}

    response = test_client.put("/api/v1/users/me", json=update_data, headers=headers)
    data = response.json()

    assert response.status_code == 200
    assert data["username"] == "UpdatedName"
    assert data["bio"] == "This is my new bio."

    # 更新されたか再度プロフィールを取得して確認
    response = test_client.get("/api/v1/users/uupdate")
    data = response.json()
    assert data["username"] == "UpdatedName"
    assert data["bio"] == "This is my new bio."

def test_update_username_conflict(test_client, test_db):
    """重複するニックネームへの更新テスト"""
    create_user(test_client, "uconflictA", "uconflictA@example.com")
    user_b_data = create_user(test_client, "uconflictB", "uconflictB@example.com")
    token_b = user_b_data["access_token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # userBがuserAの初期username(uconflictA)に更新しようとする
    update_data = {"username": "uconflictA"}
    response = test_client.put("/api/v1/users/me", json=update_data, headers=headers_b)

    assert response.status_code == 400
    assert "このニックネームは既に使用されています" in response.json()["detail"]


def test_follow_and_unfollow_user(test_client, test_db):
    """ユーザーのフォローとアンフォローのテスト"""
    user1_data = create_user(test_client, "ufollower", "ufollower@example.com")
    create_user(test_client, "ufollowed", "ufollowed@example.com")
    token = user1_data["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # フォロー
    response = test_client.post("/api/v1/users/ufollowed/follow", headers=headers)
    assert response.status_code == 204

    # フォロー状態の確認
    response = test_client.get("/api/v1/users/ufollowed", headers=headers)
    assert response.json()["is_following"] is True
    assert response.json()["followers_count"] == 1

    # アンフォロー
    response = test_client.post("/api/v1/users/ufollowed/unfollow", headers=headers)
    assert response.status_code == 204

    # アンフォロー状態の確認
    response = test_client.get("/api/v1/users/ufollowed", headers=headers)
    assert response.json()["is_following"] is False
    assert response.json()["followers_count"] == 0


def test_follow_self(test_client, test_db):
    """自分自身をフォローするテスト"""
    user_data = create_user(test_client, "uselfollow", "uself@example.com")
    token = user_data["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    response = test_client.post("/api/v1/users/uselfollow/follow", headers=headers)
    assert response.status_code == 400

def test_get_followers_and_following(test_client, test_db):
    """フォロワーとフォロー中リストの取得テスト"""
    user1 = create_user(test_client, "uff1", "uff1@example.com")
    user2 = create_user(test_client, "uff2", "uff2@example.com")
    user3 = create_user(test_client, "uff3", "uff3@example.com")

    # user1がuser2をフォロー
    headers1 = {"Authorization": f"Bearer {user1['access_token']}"}
    test_client.post("/api/v1/users/uff2/follow", headers=headers1)

    # user3がuser2をフォロー
    headers3 = {"Authorization": f"Bearer {user3['access_token']}"}
    test_client.post("/api/v1/users/uff2/follow", headers=headers3)

    # user2のフォロワーリストを取得
    response = test_client.get("/api/v1/users/uff2/followers")
    followers = response.json()
    assert response.status_code == 200
    assert len(followers) == 2
    follower_ids = {f["id"] for f in followers}
    assert "uff1" in follower_ids
    assert "uff3" in follower_ids

    # user1のフォロー中リストを取得
    response = test_client.get("/api/v1/users/uff1/following")
    following = response.json()
    assert response.status_code == 200
    assert len(following) == 1
    assert following[0]["id"] == "uff2"
