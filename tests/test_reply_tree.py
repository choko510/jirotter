import pytest
from app.models import Reply

def create_user_and_get_token(test_client, user_id, email, password="password123!"):
    """ユーザーを作成し、トークンを返すヘルパー関数"""
    user_data = {"id": user_id, "email": email, "password": password}
    response = test_client.post("/api/v1/auth/register", json=user_data)
    # 既に存在する場合も考慮してログイン試行
    if response.status_code != 201:
        login_data = {"id": user_id, "password": password}
        response = test_client.post("/api/v1/auth/login", data=login_data)
        assert response.status_code == 200
        return response.json()["access_token"]
    return response.json()["access_token"]

def create_post(test_client, token, content="Test Post for Reply Tree"):
    """投稿を作成し、投稿データを返すヘルパー関数"""
    headers = {"Authorization": f"Bearer {token}"}
    post_data = {"content": content}
    response = test_client.post("/api/v1/posts", data=post_data, headers=headers)
    assert response.status_code == 201
    return response.json()

def test_reply_tree_structure(test_client, test_db):
    """返信ツリー構造のテスト"""
    # ユーザーと投稿を作成
    token = create_user_and_get_token(test_client, "tree_user", "tree@example.com")
    post = create_post(test_client, token)
    post_id = post["id"]
    headers = {"Authorization": f"Bearer {token}"}

    # 1. ルート返信を作成
    root_reply_data = {"content": "Root reply"}
    response = test_client.post(f"/api/v1/posts/{post_id}/replies", json=root_reply_data, headers=headers)
    assert response.status_code == 201
    root_reply = response.json()
    assert root_reply["parent_id"] is None

    # 2. 子返信（ルートへの返信）を作成
    child_reply_data = {"content": "Child reply", "parent_id": root_reply["id"]}
    response = test_client.post(f"/api/v1/posts/{post_id}/replies", json=child_reply_data, headers=headers)
    assert response.status_code == 201
    child_reply = response.json()
    assert child_reply["parent_id"] == root_reply["id"]

    # 3. 孫返信（子への返信）を作成
    grandchild_reply_data = {"content": "Grandchild reply", "parent_id": child_reply["id"]}
    response = test_client.post(f"/api/v1/posts/{post_id}/replies", json=grandchild_reply_data, headers=headers)
    assert response.status_code == 201
    grandchild_reply = response.json()
    assert grandchild_reply["parent_id"] == child_reply["id"]

    # 4. 返信一覧を取得して構造を確認
    # APIはフラットなリストを返すので、parent_idが含まれているか確認
    response = test_client.get(f"/api/v1/posts/{post_id}/replies")
    assert response.status_code == 200
    replies = response.json()
    
    # IDでマップを作成
    reply_map = {r["id"]: r for r in replies}
    
    assert len(replies) >= 3
    assert reply_map[root_reply["id"]]["parent_id"] is None
    assert reply_map[child_reply["id"]]["parent_id"] == root_reply["id"]
    assert reply_map[grandchild_reply["id"]]["parent_id"] == child_reply["id"]

def test_reply_to_nonexistent_parent(test_client, test_db):
    """存在しない親への返信テスト"""
    token = create_user_and_get_token(test_client, "tree_user2", "tree2@example.com")
    post = create_post(test_client, token)
    post_id = post["id"]
    headers = {"Authorization": f"Bearer {token}"}

    reply_data = {"content": "Invalid parent", "parent_id": 99999}
    response = test_client.post(f"/api/v1/posts/{post_id}/replies", json=reply_data, headers=headers)
    assert response.status_code == 404
    assert "Parent reply not found" in response.json()["detail"]

def test_reply_to_parent_in_different_post(test_client, test_db):
    """別の投稿にある親への返信テスト"""
    token = create_user_and_get_token(test_client, "tree_user3", "tree3@example.com")
    headers = {"Authorization": f"Bearer {token}"}
    
    # 投稿1とルート返信
    post1 = create_post(test_client, token, "Post 1")
    reply_data1 = {"content": "Reply to Post 1"}
    response = test_client.post(f"/api/v1/posts/{post1['id']}/replies", json=reply_data1, headers=headers)
    parent_reply = response.json()

    # 投稿2
    post2 = create_post(test_client, token, "Post 2")
    
    # 投稿2に対して、投稿1の返信を親として指定
    invalid_reply_data = {"content": "Invalid cross-post reply", "parent_id": parent_reply["id"]}
    response = test_client.post(f"/api/v1/posts/{post2['id']}/replies", json=invalid_reply_data, headers=headers)
    
    assert response.status_code == 400
    assert "Parent reply does not belong to this post" in response.json()["detail"]
