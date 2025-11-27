import pytest
from app.models import Checkin, User, Follow
from app.utils.recommendations import get_user_recommendations
from datetime import datetime

def test_get_user_recommendations(test_db):
    # Setup users
    user_me = User(id="me", email="me@example.com", password_hash="hash")
    user_target = User(id="target", email="target@example.com", password_hash="hash")
    user_other = User(id="other", email="other@example.com", password_hash="hash")
    user_followed = User(id="followed", email="followed@example.com", password_hash="hash")

    test_db.add_all([user_me, user_target, user_other, user_followed])
    test_db.commit()

    # Setup Follow
    follow = Follow(follower_id=user_me.id, followed_id=user_followed.id)
    test_db.add(follow)
    test_db.commit()

    # Setup Shops (using dummy shop_ids)
    shop_a = 1
    shop_b = 2
    shop_c = 3
    shop_d = 4

    # Me visits Shop A (3 times), Shop B (2 times), Shop C (1 time) -> Top 3: A, B, C
    checkins_me = [
        Checkin(user_id=user_me.id, shop_id=shop_a, checkin_date=datetime.now()),
        Checkin(user_id=user_me.id, shop_id=shop_a, checkin_date=datetime.now()),
        Checkin(user_id=user_me.id, shop_id=shop_a, checkin_date=datetime.now()),
        Checkin(user_id=user_me.id, shop_id=shop_b, checkin_date=datetime.now()),
        Checkin(user_id=user_me.id, shop_id=shop_b, checkin_date=datetime.now()),
        Checkin(user_id=user_me.id, shop_id=shop_c, checkin_date=datetime.now()),
    ]
    test_db.add_all(checkins_me)

    # Target visits Shop A (2 times), Shop B (1 time) -> Matches on A and B (Score: 3)
    checkins_target = [
        Checkin(user_id=user_target.id, shop_id=shop_a, checkin_date=datetime.now()),
        Checkin(user_id=user_target.id, shop_id=shop_a, checkin_date=datetime.now()),
        Checkin(user_id=user_target.id, shop_id=shop_b, checkin_date=datetime.now()),
    ]
    test_db.add_all(checkins_target)

    # Other visits Shop C (1 time) -> Matches on C (Score: 1)
    checkins_other = [
        Checkin(user_id=user_other.id, shop_id=shop_c, checkin_date=datetime.now()),
    ]
    test_db.add_all(checkins_other)

    # Followed visits Shop A -> Should be excluded because already followed
    checkins_followed = [
        Checkin(user_id=user_followed.id, shop_id=shop_a, checkin_date=datetime.now()),
    ]
    test_db.add_all(checkins_followed)

    test_db.commit()

    # Test logic
    recommendations = get_user_recommendations(test_db, user_me)

    assert len(recommendations) == 2
    assert recommendations[0].id == "target" # Highest score
    assert recommendations[1].id == "other" # Lower score

    # Verify Followed user is not in recommendations
    ids = [u.id for u in recommendations]
    assert "followed" not in ids
    assert "me" not in ids

def test_get_user_recommendations_no_checkins(test_db):
    user_me = User(id="me_empty", email="me_empty@example.com", password_hash="hash")
    test_db.add(user_me)
    test_db.commit()

    recommendations = get_user_recommendations(test_db, user_me)
    assert recommendations == []
