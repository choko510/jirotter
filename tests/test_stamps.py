import pytest
from app.models import User, RamenShop, Checkin

from app.utils.auth import verify_token

def setup_test_data(test_db, user_id: str):
    """テスト用の店舗とチェックインデータを作成する"""
    # ユーザーはauth_headers fixtureによって既に作成されている

    shops = [
        RamenShop(name="東京店1", address="東京都新宿区", latitude=1, longitude=1),
        RamenShop(name="東京店2", address="東京都豊島区", latitude=2, longitude=2),
        RamenShop(name="神奈川店1", address="神奈川県横浜市", latitude=3, longitude=3),
    ]
    test_db.add_all(shops)
    test_db.commit()

    checkins = [
        Checkin(user_id=user_id, shop_id=shops[0].id),
        Checkin(user_id=user_id, shop_id=shops[2].id),
    ]
    test_db.add_all(checkins)
    test_db.commit()

def test_get_stamp_rally_progress(test_client, test_db, auth_headers):
    """スタンプラリーの進捗取得APIのテスト"""
    token = auth_headers["Authorization"].split(" ")[1]
    user_id = verify_token(token)

    setup_test_data(test_db, user_id)

    response = test_client.get("/api/v1/stamps/progress", headers=auth_headers)
    data = response.json()

    assert response.status_code == 200
    assert "progress" in data

    progress_map = {item["prefecture"]: item for item in data["progress"]}

    assert "東京都" in progress_map
    assert progress_map["東京都"]["total_shops"] == 2
    assert progress_map["東京都"]["visited_shops"] == 1

    assert "神奈川県" in progress_map
    assert progress_map["神奈川県"]["total_shops"] == 1
    assert progress_map["神奈川県"]["visited_shops"] == 1
