import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool
import subprocess
import time
import os
import signal

from app import create_app
from database import Base, get_db

# Use an in-memory SQLite database for tests
TEST_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="session", autouse=True)
def live_server():
    """
    Fixture to run the FastAPI application in a live server as a separate process.
    This allows Playwright tests to access the application.
    The server is started before the test session and terminated afterwards.
    """
    proc = subprocess.Popen(
        ["uvicorn", "app:create_app", "--host", "0.0.0.0", "--port", "8000", "--factory"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        preexec_fn=os.setsid
    )
    # Wait for the server to be ready
    time.sleep(5)
    yield
    # Terminate the server process
    os.killpg(os.getpgid(proc.pid), signal.SIGTERM)
    proc.wait()


@pytest.fixture(scope="function")
def test_db():
    """
    Fixture to create a new database session for each test function.
    It creates all tables before the test and drops them afterwards,
    ensuring test isolation.
    """
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
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

    with TestClient(app) as client:
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
