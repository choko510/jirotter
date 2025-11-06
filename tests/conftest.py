import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool
import subprocess
import time
import os
import signal
import sys

from app import create_app
from database import Base, get_db

# --- UIテスト用の設定 ---
# 永続的なDBファイルをUIテストで使用
UI_TEST_DATABASE_URL = "sqlite:///./test_temp_ui.db"
ui_test_engine = create_engine(
    UI_TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
)
TestingUISessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=ui_test_engine)

# --- APIテスト用の設定 ---
# インメモリDBをAPIテストで使用
API_TEST_DATABASE_URL = "sqlite:///:memory:"
api_test_engine = create_engine(
    API_TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingAPISessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=api_test_engine)

from app.models import User

# UIテスト用のDBセッションを取得する
def get_ui_db():
    db = TestingUISessionLocal()
    try:
        yield db
    finally:
        db.close()

@pytest.fixture(scope="session", autouse=True)
def setup_ui_test_db():
    """UIテスト用のDBをセットアップし、テストユーザーを作成する"""
    # データベースファイルが存在する場合は削除して初期化
    if os.path.exists("./test_temp_ui.db"):
        os.remove("./test_temp_ui.db")

    Base.metadata.create_all(bind=ui_test_engine)

    # テストユーザーを作成
    session = next(get_ui_db())
    test_user = session.query(User).filter_by(id="testuser").first()
    if not test_user:
        user = User(
            id="testuser",
            username="testuser",
            email="testuser@example.com",
        )
        user.set_password("password123!")
        session.add(user)
        session.commit()
    session.close()

    yield

    # テスト終了後にDBファイルを削除
    if os.path.exists("./test_temp_ui.db"):
        os.remove("./test_temp_ui.db")

@pytest.fixture(scope="session")
def live_server(setup_ui_test_db):
    """
    Fixture to run the FastAPI application in a live server as a separate process.
    This allows Playwright tests to access the application.
    The server is started before the test session and terminated afterwards.
    """
    # UIテスト用のデータベースURLを環境変数として設定
    env = os.environ.copy()
    env["DATABASE_URL"] = UI_TEST_DATABASE_URL

    # WindowsとUnixでプロセス作成方法を分岐
    if os.name == 'nt':  # Windows
        proc = subprocess.Popen(
            ["uvicorn", "app:create_app", "--host", "0.0.0.0", "--port", "8001", "--factory"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            creationflags=subprocess.CREATE_NEW_PROCESS_GROUP,
            env=env
        )
    else:  # Unix/Linux/macOS
        proc = subprocess.Popen(
            ["uvicorn", "app:create_app", "--host", "0.0.0.0", "--port", "8001", "--factory"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            preexec_fn=os.setsid,
            env=env
        )
    
    # Wait for the server to be ready
    time.sleep(5)
    yield "http://localhost:8001"
    
    # Terminate server process
    if os.name == 'nt':  # Windows
        proc.terminate()
    else:  # Unix/Linux/macOS
        os.killpg(os.getpgid(proc.pid), signal.SIGTERM)
    proc.wait()


@pytest.fixture(scope="function")
def test_db():
    """
    Fixture to create a new database session for each test function.
    It creates all tables before the test and drops them afterwards,
    ensuring test isolation.
    """
    Base.metadata.create_all(bind=api_test_engine)
    db = TestingAPISessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=api_test_engine)

@pytest.fixture(scope="function")
def test_client(test_db: Session):
    """
    Fixture to create a TestClient. It overrides the `get_db` dependency
    to ensure that all requests within a single test use the same
    database session provided by the `test_db` fixture.
    """
    app = create_app()

    def override_get_db():
        try:
            yield test_db
        finally:
            # The session is managed by the `test_db` fixture
            pass

    app.dependency_overrides[get_db] = override_get_db

    with TestClient(app, base_url="https://testserver") as client:
        yield client
    
    app.dependency_overrides.clear()

import uuid

@pytest.fixture(scope="function")
def auth_headers(test_client):
    """
    Fixture to create a unique test user and return authentication headers.
    """
    unique_id = str(uuid.uuid4()).replace("-", "")
    user_data = {
        "id": f"testuser{unique_id}",
        "email": f"test{unique_id}@example.com",
        "password": "password123!"
    }

    # 1. Create a unique user
    register_response = test_client.post("/api/v1/auth/register", json=user_data)
    if register_response.status_code != 201:
        raise ValueError(
            f"Failed to register user in auth_headers fixture. "
            f"Status: {register_response.status_code}, "
            f"Response: {register_response.text}"
        )

    # 2. The registration response should contain the token
    token = register_response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
