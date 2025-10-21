import os
from datetime import timedelta
from dotenv import load_dotenv

load_dotenv()

class Settings:
    # 基本設定
    PROJECT_NAME: str = "SNS Backend"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    
    # 環境設定
    DEBUG: bool = os.getenv("DEBUG", "true").lower() == "true"
    DEVELOPMENT: bool = os.getenv("DEVELOPMENT", "true").lower() == "true"
    
    # データベース設定
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./sns.db")
    
    # JWT設定
    SECRET_KEY: str = os.getenv("SECRET_KEY", "your-secret-key-here")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24時間
    
    # AI設定
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    
    # テスト設定
    TESTING: bool = os.getenv("TESTING", False)
    TEST_DATABASE_URL: str = os.getenv("TEST_DATABASE_URL", "sqlite:///./test_sns.db")

settings = Settings()