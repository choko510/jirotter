"""
ログインセキュリティ機能のテスト
"""
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, AsyncMock
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from database import get_db, Base
from app.models import User, UserLoginHistory
from app import create_app
from app.utils.auth import get_password_hash

app = create_app()

# テスト用データベース設定
SQLALCHEMY_DATABASE_URL = "sqlite:///./test_login_security.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

@pytest.fixture(scope="module")
def client():
    Base.metadata.create_all(bind=engine)
    with TestClient(app) as c:
        yield c
    Base.metadata.drop_all(bind=engine)

@pytest.fixture
def test_user(client):
    """テスト用ユーザーを作成し、テスト後にクリーンアップする"""
    db = TestingSessionLocal()
    try:
        # 既存のテストユーザーと関連データを削除
        db.query(UserLoginHistory).filter(UserLoginHistory.user_id == "testuser").delete()
        db.query(User).filter(User.id == "testuser").delete()
        db.commit()

        # 新しいテストユーザーを作成
        user = User(
            id="testuser",
            email="test@example.com",
            password_hash=get_password_hash("testpassword")
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        yield user
    finally:
        # テスト後にクリーンアップ
        db.query(UserLoginHistory).filter(UserLoginHistory.user_id == "testuser").delete()
        db.query(User).filter(User.id == "testuser").delete()
        db.commit()
        db.close()

def test_normal_login(client, test_user):
    """通常のログインテスト"""
    response = client.post("/api/v1/auth/login", json={
        "id": "testuser",
        "password": "testpassword"
    }, headers={"User-Agent": "TestAgent/1.0"})
    
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["id"] == "testuser"
    assert data.get("requires_email_verification") is False

def test_login_with_different_ip_requires_email_verification(client, test_user):
    """異なるIPからのログインでメールアドレス確認が必要になるテスト"""
    # 最初のログイン（IP: 127.0.0.1）
    client.post("/api/v1/auth/login", json={
        "id": "testuser",
        "password": "testpassword"
    }, headers={"User-Agent": "TestAgent/1.0", "X-Forwarded-For": "127.0.0.1"})
    
    # 異なるIPからのログイン（IP: 192.168.1.1）
    response = client.post("/api/v1/auth/login", json={
        "id": "testuser",
        "password": "testpassword"
    }, headers={"User-Agent": "TestAgent/1.0", "X-Forwarded-For": "192.168.1.1"})
    
    assert response.status_code == 200
    data = response.json()
    assert data.get("requires_email_verification") is True
    assert data.get("message") is not None
    assert data.get("access_token") is None
    assert data.get("user") is None

def test_login_with_different_user_agent_requires_email_verification(client, test_user):
    """異なるUserAgentでのログインでメールアドレス確認が必要になるテスト"""
    # 最初のログイン（UserAgent: TestAgent/1.0）
    client.post("/api/v1/auth/login", json={
        "id": "testuser",
        "password": "testpassword"
    }, headers={"User-Agent": "TestAgent/1.0"})
    
    # 異なるUserAgentでのログイン（UserAgent: DifferentAgent/2.0）
    response = client.post("/api/v1/auth/login", json={
        "id": "testuser",
        "password": "testpassword"
    }, headers={"User-Agent": "DifferentAgent/2.0"})
    
    assert response.status_code == 200
    data = response.json()
    assert data.get("requires_email_verification") is True
    assert data.get("message") is not None

from unittest.mock import patch

@patch('app.routes.auth.ensure_turnstile', new_callable=AsyncMock)
def test_email_verification_success(mock_ensure_turnstile, client, test_user):
    """メールアドレス確認が成功するテスト"""
    # 最初のログインでメール確認が必要になる状態にする
    client.post("/api/v1/auth/login", json={
        "id": "testuser",
        "password": "testpassword"
    }, headers={"User-Agent": "TestAgent/1.0"})
    
    response = client.post("/api/v1/auth/login", json={
        "id": "testuser",
        "password": "testpassword"
    }, headers={"User-Agent": "DifferentAgent/2.0"})
    
    assert response.json().get("requires_email_verification") is True
    
    # メールアドレス確認
    verify_response = client.post("/api/v1/auth/verify-email", json={
        "id": "testuser",
        "password": "testpassword",
        "email": "test@example.com"
    })
    
    assert verify_response.status_code == 200
    data = verify_response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["id"] == "testuser"

def test_email_verification_wrong_email(client, test_user):
    """間違ったメールアドレスでの確認が失敗するテスト"""
    verify_response = client.post("/api/v1/auth/verify-email", json={
        "id": "testuser",
        "password": "testpassword",
        "email": "wrong@example.com"
    })
    
    assert verify_response.status_code == 400
    assert "メールアドレスが一致しません" in verify_response.json()["detail"]

def test_login_history_creation(client, test_user):
    """ログイン履歴が正しく作成されるテスト"""
    db = TestingSessionLocal()
    
    # ログイン前の履歴数を確認
    initial_count = db.query(UserLoginHistory).filter(UserLoginHistory.user_id == "testuser").count()
    
    # ログイン実行
    client.post("/api/v1/auth/login", json={
        "id": "testuser",
        "password": "testpassword"
    }, headers={"User-Agent": "TestAgent/1.0", "X-Forwarded-For": "127.0.0.1"})
    
    # ログイン後の履歴数を確認
    final_count = db.query(UserLoginHistory).filter(UserLoginHistory.user_id == "testuser").count()
    
    assert final_count == initial_count + 1
    
    # 履歴の内容を確認
    history = db.query(UserLoginHistory).filter(UserLoginHistory.user_id == "testuser").order_by(UserLoginHistory.created_at.desc()).first()
    assert history.ip_address == "127.0.0.1"
    assert history.user_agent == "TestAgent/1.0"
    
    db.close()

def test_first_login_no_verification_required(client, test_user):
    """初回ログインではメールアドレス確認が不要なテスト"""
    response = client.post("/api/v1/auth/login", json={
        "id": "testuser",
        "password": "testpassword"
    }, headers={"User-Agent": "TestAgent/1.0"})
    
    assert response.status_code == 200
    data = response.json()
    assert data.get("requires_email_verification") is False
    assert "access_token" in data