import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool

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