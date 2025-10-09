import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import create_app
from database import Base, get_db
from config import settings

# テスト用データベースエンジンの作成
TEST_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)

# テスト用セッションファクトリーの作成
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# テスト用データベースの依存性注入
def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

# テストクライアントのフィクスチャ
@pytest.fixture(scope="module")
def test_client():
    # アプリケーションインスタンスを作成
    app = create_app()
    
    # テスト用データベースのセットアップ
    Base.metadata.create_all(bind=engine)
    
    # 依存性のオーバーライド
    app.dependency_overrides[get_db] = override_get_db
    
    with TestClient(app) as client:
        yield client
    
    # クリーンアップ
    Base.metadata.drop_all(bind=engine)
    app.dependency_overrides.clear()

# テストデータベースのフィクスチャ
@pytest.fixture(scope="function")
def test_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        # 各テスト後にテーブルをクリア
        for table in reversed(Base.metadata.sorted_tables):
            db.execute(table.delete())
        db.commit()