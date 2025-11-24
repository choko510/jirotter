import pytest
from datetime import datetime, timezone

from app.models import Checkin, RamenShop, User, UserTitle
from app.utils.scoring import award_points

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
    assert data["points"] == 0
    assert data["rank"] == "味覚ビギナー"
    assert data["account_status"] == "active"
    assert "rank_color" in data
    assert "status_message" in data

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
    """重複するニックネームへの更新時の挙動確認

    現仕様では username は任意入力・重複可であり、API は 200 を返すため
    このテストでは「400 にならないこと（=許可されること）」を確認する。
    """
    # userA, userB を作成
    create_user(test_client, "uconflictA", "uconflictA@example.com")
    user_b_data = create_user(test_client, "uconflictB", "uconflictB@example.com")
    token_b = user_b_data["access_token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # userB が userA の username(uconflictA) に更新しようとする → 現仕様では許可
    update_data = {"username": "uconflictA"}
    response = test_client.put("/api/v1/users/me", json=update_data, headers=headers_b)

    assert response.status_code == 200
    data = response.json()
    # 現仕様ではエラーにならず、更新後のユーザー情報が返る想定
    assert data["username"] == "uconflictA"


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
    profile_after_follow = response.json()
    assert profile_after_follow["is_following"] is True
    assert profile_after_follow["followers_count"] == 1
    assert profile_after_follow["points"] == 5

    # アンフォロー
    response = test_client.post("/api/v1/users/ufollowed/unfollow", headers=headers)
    assert response.status_code == 204

    # アンフォロー状態の確認
    response = test_client.get("/api/v1/users/ufollowed", headers=headers)
    profile_after_unfollow = response.json()
    assert profile_after_unfollow["is_following"] is False
    assert profile_after_unfollow["followers_count"] == 0
    assert profile_after_unfollow["points"] == 5


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


def test_title_awarded_on_checkin(test_client, test_db):
    create_user(test_client, "utitle", "utitle@example.com")
    user = test_db.query(User).filter(User.id == "utitle").first()

    shop = RamenShop(
        name="テストラーメン",
        address="テスト住所",
        latitude=35.0,
        longitude=135.0,
    )
    test_db.add(shop)
    test_db.commit()
    test_db.refresh(shop)

    checkin = Checkin(
        user_id=user.id,
        shop_id=shop.id,
        checkin_date=datetime.now(timezone.utc),
    )
    test_db.add(checkin)
    test_db.commit()

    award_points(
        test_db,
        user,
        "checkin",
        metadata={"shop_id": shop.id, "checkin_id": checkin.id},
    )
    test_db.commit()

    titles = test_db.query(UserTitle).filter(UserTitle.user_id == user.id).all()
    assert any(title.title_key == "first_checkin" for title in titles)

    response = test_client.get("/api/v1/users/utitle")
    assert response.status_code == 200
    data = response.json()
    unlocked_titles = [t for t in data["titles"] if t["unlocked"]]
    assert any(t["key"] == "first_checkin" for t in unlocked_titles)
    assert data["featured_title"]["key"] == "first_checkin"


def test_user_rankings_endpoint(test_client, test_db):
    user1 = create_user(test_client, "urank1", "urank1@example.com")
    user2 = create_user(test_client, "urank2", "urank2@example.com")
    user3 = create_user(test_client, "urank3", "urank3@example.com")

    db_user1 = test_db.query(User).filter(User.id == "urank1").first()
    db_user2 = test_db.query(User).filter(User.id == "urank2").first()
    db_user3 = test_db.query(User).filter(User.id == "urank3").first()

    db_user1.points = 320
    db_user2.points = 210
    db_user3.points = 90
    test_db.commit()

    response = test_client.get(
        "/api/v1/users/rankings?limit=5",
        headers={"Authorization": f"Bearer {user1['access_token']}"}
    )

    assert response.status_code == 200
    data = response.json()

    assert "top_users" in data and len(data["top_users"]) >= 3
    assert data["you"]["id"] == "urank1"
    assert data["you"]["position"] == 1
    assert data["total_users"] >= 3
    assert isinstance(data["title_catalog"], list) and len(data["title_catalog"]) > 0

    first_entry = data["top_users"][0]
    assert "points" in first_entry and first_entry["points"] >= 0
    assert "rank" in first_entry
    assert "total_titles" in first_entry
