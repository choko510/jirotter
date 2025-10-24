from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.gzip import GZipMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from contextlib import asynccontextmanager
from database import engine, Base, SessionLocal
from config import settings
import os

from app.routes.auth import router as auth_router
from app.routes.posts import router as posts_router
from app.routes.ramen import router as ramen_router, load_ramen_data_on_startup
from app.routes.users import router as users_router
from app.routes.likes import router as likes_router
from app.routes.replies import router as replies_router
from app.routes.reports import router as reports_router
from app.routes.checkin import router as checkin_router
from app.routes.stamps import router as stamps_router

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        
        # Content Security Policyヘッダーを設定
        csp = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://unpkg.com; "
            "style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://unpkg.com; "
            "img-src 'self' data: https:; "
            "font-src 'self' https://cdnjs.cloudflare.com; "
            "connect-src 'self'; "
            "frame-ancestors 'none'; "
            "base-uri 'self'; "
            "form-action 'self';"
        )
        
        response.headers["Content-Security-Policy"] = csp
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        
        return response

@asynccontextmanager
async def lifespan(app: FastAPI):
    # 起動時にデータベーステーブルを作成
    Base.metadata.create_all(bind=engine)
    # ラーメンデータをロード
    db = SessionLocal()
    try:
        load_ramen_data_on_startup(db)
    finally:
        db.close()
    yield
    # シャットダウン時の処理（必要に応じて）

def create_app():
    """FastAPIアプリケーションファクトリー"""
    app = FastAPI(
        title=settings.PROJECT_NAME,
        version=settings.VERSION,
        lifespan=lifespan
    )
    
    # CORSミドルウェアの設定
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],  # 本番環境では適切なオリジンに制限
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    # 静的ファイルの提供設定（キャッシュ無効化）
    app.mount("/js", StaticFiles(directory="frontend/js", html=True), name="js")
    app.mount("/css", StaticFiles(directory="frontend/css", html=True), name="css")
    app.mount("/uploads", StaticFiles(directory="uploads", html=True), name="uploads")
    
    # ルーターの登録
    app.include_router(auth_router, prefix=settings.API_V1_STR)
    app.include_router(posts_router, prefix=settings.API_V1_STR)
    app.include_router(ramen_router, prefix=settings.API_V1_STR)
    app.include_router(users_router, prefix=settings.API_V1_STR)
    app.include_router(likes_router, prefix=settings.API_V1_STR)
    app.include_router(replies_router, prefix=settings.API_V1_STR)
    app.include_router(reports_router, prefix=settings.API_V1_STR)
    app.include_router(checkin_router, prefix=settings.API_V1_STR)
    app.include_router(stamps_router, prefix=settings.API_V1_STR)
    
    @app.get("/", response_class=HTMLResponse)
    async def read_index():
        """index.htmlを返すエンドポイント"""
        index_path = os.path.join(os.path.dirname(__file__), "..", "frontend/index.html")
        with open(index_path, "r", encoding="utf-8") as f:
            content = f.read()
        
        # 開発環境ではキャッシュを無効化
        headers = {}
        if settings.DEVELOPMENT:
            headers = {
                "Cache-Control": "no-cache, no-store, must-revalidate",
                "Pragma": "no-cache",
                "Expires": "0"
            }
        
        return HTMLResponse(content=content, headers=headers)

    @app.get("/api")
    async def root():
        return {"message": "SNS Backend API", "version": settings.VERSION}
    
    return app

    