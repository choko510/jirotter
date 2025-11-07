from fastapi import FastAPI, Request, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.gzip import GZipMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.middleware.sessions import SessionMiddleware
from starlette_csrf import CSRFMiddleware
from contextlib import asynccontextmanager
from database import engine, Base, SessionLocal
from config import settings
import os
import time
import random
import string

from app.routes.auth import router as auth_router
from app.routes.posts import router as posts_router
from app.routes.ramen import router as ramen_router, load_ramen_data_on_startup
from app.routes.users import router as users_router
from app.routes.likes import router as likes_router
from app.routes.replies import router as replies_router
from app.routes.reports import router as reports_router
from app.routes.checkin import router as checkin_router
from app.routes.stamps import router as stamps_router
from app.routes.visits import router as visits_router
from app.routes.shop_submissions import router as shop_submissions_router
from app.routes.admin import router as admin_router
from app.routes.shop_editor_ws import router as shop_editor_ws_router
from app.models import User
from app.utils.auth import verify_token

class CacheBustingMiddleware(BaseHTTPMiddleware):
    """Debugモード時に静的ファイルにランダムパラメーターを追加してキャッシュを防ぐミドルウェア"""
    
    def __init__(self, app):
        super().__init__(app)
        self.cache_bust_param = self._generate_cache_bust_param()
    
    def _generate_cache_bust_param(self):
        """ランダムなキャッシュ破壊用パラメータを生成"""
        timestamp = int(time.time())
        random_str = ''.join(random.choices(string.ascii_letters + string.digits, k=8))
        return f"v={timestamp}_{random_str}"
    
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        
        # Debugモードが有効な場合のみキャッシュ破壊を適用
        if settings.DEBUG:
            # 静的ファイルの場合はキャッシュを無効化
            if request.url.path.startswith(('/js/', '/css/', '/assets/', '/uploads/')):
                response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
                response.headers["Pragma"] = "no-cache"
                response.headers["Expires"] = "0"
            # HTMLレスポンスの場合は静的ファイルURLにキャッシュ破壊パラメータを追加
            elif response.headers.get("content-type", "").startswith("text/html"):
                # レスポンスボディを読み込む
                content = ""
                async for chunk in response.body_iterator:
                    if isinstance(chunk, bytes):
                        content += chunk.decode("utf-8")
                    else:
                        content += str(chunk)
                
                # CSSファイルのURLを置換
                content = self._add_cache_bust_to_urls(content, 'href="css/', '"')
                # JSファイルのURLを置換
                content = self._add_cache_bust_to_urls(content, 'src="js/', '"')
                # アセットファイルのURLを置換
                content = self._add_cache_bust_to_urls(content, 'src="assets/', '"')
                
                # 新しいHTMLResponseを作成（Content-Lengthは自動的に計算される）
                response = HTMLResponse(content=content)
        
        return response
    
    def _add_cache_bust_to_urls(self, content, prefix, suffix):
        """指定されたプレフィックスを持つURLにキャッシュ破壊パラメータを追加"""
        import re
        
        # プレフィックスで始まり、suffixで終わるURLを検索
        pattern = f'{re.escape(prefix)}([^"{suffix}]+){re.escape(suffix)}'
        
        def replace_func(match):
            url = match.group(1)
            # すでにクエリパラメータがある場合は追加、なければ新規追加
            if '?' in url:
                return f'{prefix}{url}&{self.cache_bust_param}{suffix}'
            else:
                return f'{prefix}{url}?{self.cache_bust_param}{suffix}'
        
        return re.sub(pattern, replace_func, content)

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        
        # Content Security Policyヘッダーを設定
        csp = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://unpkg.com https://cdn.jsdelivr.net; "
            "style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://unpkg.com https://cdn.jsdelivr.net https://fonts.googleapis.com; "
            "img-src 'self' data: https:; "
            "font-src 'self' https://cdnjs.cloudflare.com https://fonts.gstatic.com; "
            "connect-src 'self' https://ipinfo.io; "
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
    
    # Add SessionMiddleware
    app.add_middleware(SessionMiddleware, secret_key=settings.SESSION_SECRET_KEY)

    # Debugモード時にキャッシュ破壊ミドルウェアを追加
    if settings.DEBUG:
        app.add_middleware(CacheBustingMiddleware)

    # CSRFミドルウェアを一時的に無効化
    # app.add_middleware(CSRFMiddleware, secret=settings.SESSION_SECRET_KEY)

    # CORSミドルウェアの設定
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],  # 本番環境では適切なオリジンに制限
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["*"],
        max_age=600,
    )
    
    # 静的ファイルの提供設定
    if settings.DEBUG:
        # Debugモード時はキャッシュを無効化
        app.mount("/js", StaticFiles(directory="frontend/js", html=True), name="js")
        app.mount("/css", StaticFiles(directory="frontend/css", html=True), name="css")
        app.mount("/uploads", StaticFiles(directory="uploads", html=True), name="uploads")
        app.mount("/assets", StaticFiles(directory="frontend/assets", html=True), name="assets")
    else:
        # 本番環境用の静的ファイル設定（キャッシュ有効）
        class StaticFilesWithCache(StaticFiles):
            def __init__(self, *args, **kwargs):
                super().__init__(*args, **kwargs)
            
            def file_response(self, *args, **kwargs):
                response = super().file_response(*args, **kwargs)
                if response:
                    # 本番環境では適切なキャッシュヘッダーを設定
                    response.headers["Cache-Control"] = "public, max-age=31536000"  # 1年
                return response
        
        app.mount("/js", StaticFilesWithCache(directory="frontend/js", html=True), name="js")
        app.mount("/css", StaticFilesWithCache(directory="frontend/css", html=True), name="css")
        app.mount("/uploads", StaticFilesWithCache(directory="uploads", html=True), name="uploads")
        app.mount("/assets", StaticFilesWithCache(directory="frontend/assets", html=True), name="assets")

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
    app.include_router(visits_router, prefix=settings.API_V1_STR)
    app.include_router(shop_submissions_router, prefix=settings.API_V1_STR)
    app.include_router(admin_router, prefix=settings.API_V1_STR)

    def render_html(filename: str) -> HTMLResponse:
        """
        frontend/{filename} を読み込み、DEBUG 時のみ query パラメータ付きの
        CSS/JS/asset パスに書き換える。
        ここでは base.html 等の相対パス (css/..., js/...) のみを対象とし、
        ルートプレフィックスや /admin/... などには余計な付与をしない。
        """
        template_path = os.path.join(os.path.dirname(__file__), "..", f"frontend/{filename}")
        with open(template_path, "r", encoding="utf-8") as f:
            content = f.read()

        if settings.DEBUG:
            import re

            timestamp = int(time.time())
            random_str = ''.join(random.choices(string.ascii_letters + string.digits, k=8))
            cache_bust_param = f"v={timestamp}_{random_str}"

            # href="css/..." / src="js/..." / src="assets/..." にだけ付与する
            def _append_cache_bust(prefix: str, attr: str, source: str) -> str:
                # prefix は css|js|assets を想定
                pattern = rf'({attr}="{prefix}/[^"?"]+)(\")'
                return re.sub(
                    pattern,
                    lambda m: f'{m.group(1)}?{cache_bust_param}{m.group(2)}',
                    source,
                )

            content = _append_cache_bust("css", "href", content)
            content = _append_cache_bust("js", "src", content)
            content = _append_cache_bust("assets", "src", content)

        headers = {}
        if settings.DEVELOPMENT:
            headers = {
                "Cache-Control": "no-cache, no-store, must-revalidate",
                "Pragma": "no-cache",
                "Expires": "0",
            }

        return HTMLResponse(content=content, headers=headers)

    @app.get("/", response_class=HTMLResponse)
    async def read_index():
        """index.htmlを返すエンドポイント"""
        return render_html("index.html")

    @app.get("/contribute", response_class=HTMLResponse)
    async def contribute_page():
        """店舗情報投稿ページを返すエンドポイント"""
        return render_html("contribute.html")

    @app.get("/admin/review", response_class=HTMLResponse)
    async def admin_review_page(request: Request):
        """管理者向け審査ページを返すエンドポイント"""
        token = request.cookies.get("authToken")
        if not token:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ページが見つかりません")

        user_id = verify_token(token)
        if user_id is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ページが見つかりません")

        db = SessionLocal()
        try:
            user = db.query(User).filter(User.id == user_id).first()
            if not user or not getattr(user, "is_admin", False):
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ページが見つかりません")
        finally:
            db.close()

        return render_html("admin-review.html")

    @app.get("/admin/shop-editor", response_class=HTMLResponse)
    async def admin_shop_editor_page(request: Request):
        """店舗管理エディタページ (shop-editor.html) を返すエンドポイント"""
        token = request.cookies.get("authToken")
        if not token:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ページが見つかりません")

        user_id = verify_token(token)
        if user_id is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ページが見つかりません")

        db = SessionLocal()
        try:
            user = db.query(User).filter(User.id == user_id).first()
        finally:
            db.close()

        if not user or not getattr(user, "is_admin", False):
            # 管理者以外には存在しないページとして扱う
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ページが見つかりません")

        return render_html("shop-editor.html")

    @app.get("/admin/dashboard", response_class=HTMLResponse)
    async def admin_dashboard_page(request: Request):
        """管理者向けダッシュボードを返すエンドポイント"""
        token = request.cookies.get("authToken")
        if not token:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ページが見つかりません")

        user_id = verify_token(token)
        if user_id is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ページが見つかりません")

        db = SessionLocal()
        try:
            user = db.query(User).filter(User.id == user_id).first()
            if not user or not getattr(user, "is_admin", False):
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ページが見つかりません")
        finally:
            db.close()

        return render_html("admin-dashboard.html")

    @app.get("/api")
    async def root():
        return {"message": "SNS Backend API", "version": settings.VERSION}
    
    return app

    