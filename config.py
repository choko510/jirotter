import os
from datetime import timedelta
from dotenv import load_dotenv

load_dotenv()

class Settings:
    # 基本設定
    PROJECT_NAME: str = "ラーメンSNS"
    VERSION: str = "1.0.0"
    # 本番用の公開URL（例: https://ramen.example.com）※環境変数で上書き推奨
    BASE_URL: str = os.getenv("BASE_URL", "http://localhost:8080")
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
    GOOGLE_API_KEY: str = os.getenv("GOOGLE_API_KEY", "")

    # Cloudflare Turnstile
    TURNSTILE_SITE_KEY: str = os.getenv("TURNSTILE_SITE_KEY", "")
    TURNSTILE_SECRET_KEY: str = os.getenv("TURNSTILE_SECRET_KEY", "")
    TURNSTILE_VERIFY_URL: str = os.getenv(
        "TURNSTILE_VERIFY_URL",
        "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    )
    TURNSTILE_ENABLED: bool = bool(TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY)

    # テスト設定
    TESTING: bool = os.getenv("TESTING", False)
    TEST_DATABASE_URL: str = os.getenv("TEST_DATABASE_URL", "sqlite:///./test_sns.db")

    # CSRF and Session
    SESSION_SECRET_KEY: str = os.getenv("SESSION_SECRET_KEY", "8ed0d42c306ffdc0a15ae3fbf73518c1be20ae78ca38f8b2b32c6642acd171fc")

settings = Settings()