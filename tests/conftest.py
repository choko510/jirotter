import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool
import subprocess
import time
import os
import signal
import sys
import httpx
import uuid

from app import create_app
from database import Base, get_db

# Use a file-based SQLite database for tests to allow sharing with subprocess
# Use a unique filename to avoid conflicts if running multiple sessions
TEST_DB_FILE = f"test_db_{uuid.uuid4().hex}.sqlite"
TEST_DATABASE_URL = f"sqlite:///{TEST_DB_FILE}"

# Set the environment variable so the subprocess picks it up
os.environ["DATABASE_URL"] = TEST_DATABASE_URL
# Also set other required env vars for the subprocess if needed
os.environ["TESTING"] = "1"

engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="session", autouse=True)
def cleanup_db_file():
    """Ensure the test database file is removed after the session."""
    yield
    if os.path.exists(TEST_DB_FILE):
        try:
            os.remove(TEST_DB_FILE)
        except OSError:
            pass

@pytest.fixture(scope="session", autouse=True)
def live_server(cleanup_db_file):
    """
    Fixture to run the FastAPI application in a live server as a separate process.
    This allows Playwright tests to access the application.
    The server is started before the test session and terminated afterwards.
    """
    # WindowsとUnixでプロセス作成方法を分岐
    if os.name == 'nt':  # Windows
        proc = subprocess.Popen(
            ["uvicorn", "app:create_app", "--host", "0.0.0.0", "--port", "8000", "--factory"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            creationflags=subprocess.CREATE_NEW_PROCESS_GROUP,
            env=os.environ.copy()
        )
    else:  # Unix/Linux/macOS
        proc = subprocess.Popen(
            ["uvicorn", "app:create_app", "--host", "0.0.0.0", "--port", "8000", "--factory"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            preexec_fn=os.setsid,
            env=os.environ.copy()
        )
    
    # Wait for the server to be ready with a health check loop
    start_time = time.time()
    max_retries = 30  # 30 * 0.5 = 15 seconds max
    server_ready = False

    for _ in range(max_retries):
        try:
            response = httpx.get("http://localhost:8000/docs", timeout=1.0)
            if response.status_code == 200:
                server_ready = True
                break
        except httpx.RequestError:
            pass
        time.sleep(0.5)

    if not server_ready:
        # Kill process and print stderr
        if os.name == 'nt':
            proc.terminate()
        else:
            os.killpg(os.getpgid(proc.pid), signal.SIGTERM)
        stdout, stderr = proc.communicate()
        print(f"Server failed to start:\nStdout: {stdout.decode()}\nStderr: {stderr.decode()}")
        pytest.fail("Live server failed to start")

    yield
    
    # Terminate server process
    if os.name == 'nt':  # Windows
        proc.terminate()
    else:  # Unix/Linux/macOS
        try:
            os.killpg(os.getpgid(proc.pid), signal.SIGTERM)
        except ProcessLookupError:
            pass
    proc.wait()


@pytest.fixture(scope="function")
def test_db():
    """
    Fixture to create a new database session for each test function.
    It creates all tables before the test and drops them afterwards,
    ensuring test isolation.
    """
    # Create tables
    Base.metadata.create_all(bind=engine)

    # Create session
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        # Drop tables to clean up
        Base.metadata.drop_all(bind=engine)

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

    # CSRFMiddlewareを無効化するためのワークアラウンド
    # アプリケーションのミドルウェアスタックからCSRFMiddlewareを除外する
    new_middleware = []
    for middleware in app.user_middleware:
        if middleware.cls.__name__ != "CSRFMiddleware":
            new_middleware.append(middleware)
    app.user_middleware = new_middleware
    app.middleware_stack = app.build_middleware_stack()

    with TestClient(app, base_url="https://testserver") as client:
        yield client
    
    app.dependency_overrides.clear()

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
