from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from config import settings

# データベースエンジンの作成
if settings.TESTING:
    SQLALCHEMY_DATABASE_URL = settings.TEST_DATABASE_URL
else:
    SQLALCHEMY_DATABASE_URL = settings.DATABASE_URL

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, 
    connect_args={"check_same_thread": False} if SQLALCHEMY_DATABASE_URL.startswith("sqlite") else {}
)

# セッションファクトリーの作成
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# ベースモデル
Base = declarative_base()

# 依存性注入用の関数
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()