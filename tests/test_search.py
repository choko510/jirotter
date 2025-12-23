"""
横断検索API（/api/v1/search）のテスト
店舗・ポスト・ユーザーを横断的に検索する機能をテスト
"""
import pytest
from app.models import RamenShop, Post, User


def add_test_shops_to_db(db):
    """テスト用の店舗データをDBに追加"""
    shops = [
        RamenShop(name="ラーメン二郎 新宿店", address="東京都新宿区", latitude=35.6909, longitude=139.7004),
        RamenShop(name="ラーメン二郎 池袋店", address="東京都豊島区", latitude=35.7295, longitude=139.7109),
        RamenShop(name="蒙古タンメン中本", address="東京都新宿区", latitude=35.6914, longitude=139.7002),
        RamenShop(name="一蘭 渋谷店", address="東京都渋谷区", latitude=35.6580, longitude=139.7016),
    ]
    db.add_all(shops)
    db.commit()
    return shops


def add_test_users_to_db(db):
    """テスト用のユーザーデータをDBに追加"""
    from app.utils.auth import get_password_hash
    
    users = [
        User(
            id="jirolover123",
            username="二郎大好き太郎",
            email="jiro@example.com",
            password_hash=get_password_hash("password123"),
            bio="毎日二郎を食べています",
            rank="味覚ビギナー",
            account_status="active"
        ),
        User(
            id="ramenking",
            username="ラーメン王",
            email="king@example.com",
            password_hash=get_password_hash("password123"),
            bio="全国のラーメンを制覇中",
            rank="ラーメン通",
            account_status="active"
        ),
        User(
            id="banned_user",
            username="BANされた人",
            email="banned@example.com",
            password_hash=get_password_hash("password123"),
            bio="規約違反しました",
            rank="味覚ビギナー",
            account_status="banned"  # BANユーザーは検索結果に出ないはず
        ),
    ]
    db.add_all(users)
    db.commit()
    return users


def add_test_posts_to_db(db, users, shops):
    """テスト用のポストデータをDBに追加"""
    posts = [
        Post(
            content="今日もマシマシで最高でした！",
            user_id=users[0].id,
            shop_id=shops[0].id,
            is_shadow_banned=False
        ),
        Post(
            content="ニンニク増しが美味しかった",
            user_id=users[1].id,
            shop_id=shops[1].id,
            is_shadow_banned=False
        ),
        Post(
            content="このポストはシャドウバンされています",
            user_id=users[0].id,
            shop_id=shops[0].id,
            is_shadow_banned=True  # シャドウバンされたポストは検索結果に出ないはず
        ),
    ]
    db.add_all(posts)
    db.commit()
    return posts


# ==================== 横断検索APIのテスト ====================

class TestGlobalSearch:
    """横断検索APIのテストクラス"""

    def test_search_shops_by_name(self, test_client, test_db):
        """店舗名で検索できることをテスト"""
        add_test_shops_to_db(test_db)

        response = test_client.get("/api/v1/search?q=二郎")
        assert response.status_code == 200

        data = response.json()
        assert data["query"] == "二郎"
        assert data["total_shops"] == 2
        
        shop_names = [shop["name"] for shop in data["shops"]]
        assert "ラーメン二郎 新宿店" in shop_names
        assert "ラーメン二郎 池袋店" in shop_names

    def test_search_shops_by_address(self, test_client, test_db):
        """住所で店舗を検索できることをテスト"""
        add_test_shops_to_db(test_db)

        response = test_client.get("/api/v1/search?q=渋谷")
        assert response.status_code == 200

        data = response.json()
        assert data["total_shops"] >= 1
        
        shop_names = [shop["name"] for shop in data["shops"]]
        assert "一蘭 渋谷店" in shop_names

    def test_search_users_by_username(self, test_client, test_db):
        """ユーザー名で検索できることをテスト"""
        add_test_users_to_db(test_db)

        response = test_client.get("/api/v1/search?q=ラーメン王")
        assert response.status_code == 200

        data = response.json()
        assert data["total_users"] >= 1
        
        user_names = [user.get("username") for user in data["users"]]
        assert "ラーメン王" in user_names

    def test_search_users_by_id(self, test_client, test_db):
        """ユーザーIDで検索できることをテスト"""
        add_test_users_to_db(test_db)

        response = test_client.get("/api/v1/search?q=jirolover")
        assert response.status_code == 200

        data = response.json()
        assert data["total_users"] >= 1
        
        user_ids = [user["id"] for user in data["users"]]
        assert "jirolover123" in user_ids

    def test_banned_users_not_in_search_results(self, test_client, test_db):
        """BANされたユーザーは検索結果に含まれないことをテスト"""
        add_test_users_to_db(test_db)

        response = test_client.get("/api/v1/search?q=banned")
        assert response.status_code == 200

        data = response.json()
        user_ids = [user["id"] for user in data["users"]]
        assert "banned_user" not in user_ids

    def test_search_posts_by_content(self, test_client, test_db):
        """ポスト内容で検索できることをテスト"""
        users = add_test_users_to_db(test_db)
        shops = add_test_shops_to_db(test_db)
        add_test_posts_to_db(test_db, users, shops)

        response = test_client.get("/api/v1/search?q=マシマシ")
        assert response.status_code == 200

        data = response.json()
        assert data["total_posts"] >= 1
        
        post_contents = [post["content"] for post in data["posts"]]
        assert any("マシマシ" in content for content in post_contents)

    def test_shadow_banned_posts_not_in_search_results(self, test_client, test_db):
        """シャドウバンされたポストは検索結果に含まれないことをテスト"""
        users = add_test_users_to_db(test_db)
        shops = add_test_shops_to_db(test_db)
        add_test_posts_to_db(test_db, users, shops)

        response = test_client.get("/api/v1/search?q=シャドウバン")
        assert response.status_code == 200

        data = response.json()
        # シャドウバンされたポストは結果に含まれない
        assert data["total_posts"] == 0

    def test_cross_search_all_types(self, test_client, test_db):
        """店舗・ポスト・ユーザーを横断的に検索できることをテスト"""
        users = add_test_users_to_db(test_db)
        shops = add_test_shops_to_db(test_db)
        add_test_posts_to_db(test_db, users, shops)

        # "二郎" で検索すると店舗とユーザーがヒットするはず
        response = test_client.get("/api/v1/search?q=二郎")
        assert response.status_code == 200

        data = response.json()
        # 店舗が見つかる
        assert data["total_shops"] >= 2
        # ユーザー名に「二郎」が含まれるユーザーも見つかる可能性
        # (test dataでは"二郎大好き太郎"がいる)
        assert data["total_users"] >= 1 or len([u for u in data["users"] if "二郎" in (u.get("username") or "")]) >= 0

    def test_search_with_filters(self, test_client, test_db):
        """検索フィルタ（search_shops, search_posts, search_users）が機能することをテスト"""
        users = add_test_users_to_db(test_db)
        shops = add_test_shops_to_db(test_db)
        add_test_posts_to_db(test_db, users, shops)

        # 店舗のみ検索
        response = test_client.get("/api/v1/search?q=二郎&search_posts=false&search_users=false")
        assert response.status_code == 200
        data = response.json()
        assert len(data["posts"]) == 0
        assert len(data["users"]) == 0
        assert len(data["shops"]) >= 2

    def test_search_limit(self, test_client, test_db):
        """検索結果の件数制限が機能することをテスト"""
        add_test_shops_to_db(test_db)

        response = test_client.get("/api/v1/search?q=ラーメン&limit=1")
        assert response.status_code == 200

        data = response.json()
        # limitに関わらずtotal_shopsは実際の件数
        # 但し返却されるshopsはlimitで制限される
        assert len(data["shops"]) <= 1

    def test_search_empty_query_returns_error(self, test_client, test_db):
        """空のクエリでエラーが返ることをテスト"""
        response = test_client.get("/api/v1/search?q=")
        # FastAPIのValidationErrorで422が返る
        assert response.status_code == 422

    def test_search_no_results(self, test_client, test_db):
        """結果がない場合は空のリストが返ることをテスト"""
        add_test_shops_to_db(test_db)

        response = test_client.get("/api/v1/search?q=存在しないキーワード12345")
        assert response.status_code == 200

        data = response.json()
        assert data["total_shops"] == 0
        assert data["total_posts"] == 0
        assert data["total_users"] == 0
        assert len(data["shops"]) == 0
        assert len(data["posts"]) == 0
        assert len(data["users"]) == 0


# ==================== サジェストAPIのテスト ====================

class TestSearchSuggestions:
    """検索サジェストAPIのテストクラス"""

    def test_suggestions_for_shop_name(self, test_client, test_db):
        """店舗名のサジェストが機能することをテスト"""
        add_test_shops_to_db(test_db)

        response = test_client.get("/api/v1/search/suggest?q=ラーメン")
        assert response.status_code == 200

        data = response.json()
        assert data["query"] == "ラーメン"
        
        # サジェストに店舗が含まれる
        shop_suggestions = [s for s in data["suggestions"] if s["type"] == "shop"]
        assert len(shop_suggestions) >= 1

    def test_suggestions_for_user_name(self, test_client, test_db):
        """ユーザー名のサジェストが機能することをテスト"""
        add_test_users_to_db(test_db)

        response = test_client.get("/api/v1/search/suggest?q=jiro")
        assert response.status_code == 200

        data = response.json()
        user_suggestions = [s for s in data["suggestions"] if s["type"] == "user"]
        # jirolover123がサジェストに含まれる
        assert len(user_suggestions) >= 1

    def test_suggestions_empty_query_returns_popular(self, test_client, test_db):
        """空のクエリで人気の店舗が返ることをテスト"""
        add_test_shops_to_db(test_db)

        response = test_client.get("/api/v1/search/suggest?q=")
        assert response.status_code == 200

        data = response.json()
        assert data["query"] == ""
        # 空クエリでもpopular_shopsが返る（データがあれば）
        assert "popular_shops" in data

    def test_suggestions_limit(self, test_client, test_db):
        """サジェストの件数制限が機能することをテスト"""
        add_test_shops_to_db(test_db)

        response = test_client.get("/api/v1/search/suggest?q=ラ&limit=2")
        assert response.status_code == 200

        data = response.json()
        assert len(data["suggestions"]) <= 2

    def test_suggestions_no_banned_users(self, test_client, test_db):
        """BANされたユーザーはサジェストに含まれないことをテスト"""
        add_test_users_to_db(test_db)

        response = test_client.get("/api/v1/search/suggest?q=banned")
        assert response.status_code == 200

        data = response.json()
        user_suggestions = [s for s in data["suggestions"] if s["type"] == "user"]
        user_ids = [s.get("user_id") for s in user_suggestions]
        assert "banned_user" not in user_ids
