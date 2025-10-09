from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
from database import engine, Base, SessionLocal
from config import settings
import os

from app.routes.auth import router as auth_router
from app.routes.posts import router as posts_router
from app.routes.ramen import router as ramen_router, load_ramen_data_on_startup

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
    
    # 静的ファイルの提供設定
    app.mount("/js", StaticFiles(directory="frontend/js"), name="js")
    
    # ルーターの登録
    app.include_router(auth_router, prefix=settings.API_V1_STR)
    app.include_router(posts_router, prefix=settings.API_V1_STR)
    app.include_router(ramen_router, prefix=settings.API_V1_STR)
    
    @app.get("/", response_class=HTMLResponse)
    async def read_index():
        """index.htmlを返すエンドポイント"""
        index_path = os.path.join(os.path.dirname(__file__), "..", "frontend/index.html")
        with open(index_path, "r", encoding="utf-8") as f:
            content = f.read()
        return HTMLResponse(content=content)

    @app.get("/api")
    async def root():
        return {"message": "SNS Backend API", "version": settings.VERSION}
    
    return app

    