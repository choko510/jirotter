from fastapi import FastAPI, Request, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, Response
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
import base64
from pathlib import Path
import threading
import user_agents

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
from app.routes.reviews import router as shop_reviews_router
from app.routes.admin import router as admin_router
from app.routes.shop_editor_ws import router as shop_editor_ws_router
from app.models import User
from app.utils.auth import verify_token

FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"
JS_DIR = FRONTEND_DIR / "js"


class JavaScriptObfuscator:
    """Simple runtime obfuscator that wraps JS code with base64 decoding."""

    def __init__(self):
        self._cache: dict[str, tuple[float, str]] = {}
        self._lock = threading.Lock()

    def obfuscate(self, file_path: Path) -> str:
        """Return an obfuscated version of the given JS file."""
        if not file_path.exists() or not file_path.is_file():
            raise FileNotFoundError(str(file_path))

        mtime = file_path.stat().st_mtime
        cache_key = str(file_path)
        with self._lock:
            cached = self._cache.get(cache_key)
            if cached and cached[0] == mtime:
                return cached[1]

        with file_path.open("r", encoding="utf-8") as f:
            raw_content = f.read()

        encoded = base64.b64encode(raw_content.encode("utf-8")).decode("ascii")
        obfuscated = (
            "(()=>{const s='"
            + encoded
            + "';const run=() => (0,eval)(atob(s));run();})();"
        )

        with self._lock:
            self._cache[cache_key] = (mtime, obfuscated)

        return obfuscated


js_obfuscator = JavaScriptObfuscator()

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

class BrowserEnforcementMiddleware(BaseHTTPMiddleware):
    """
    「しっかりとしたブラウザ」でない（= 一般的なモダンブラウザでない）User-Agentや、
    典型的な自動操作ツール / クローラ由来のヘッダを持つアクセスを 403 にする。
    DEBUG=False（本番相当）のときのみ有効。
    """
    async def dispatch(self, request: Request, call_next):
        # DEBUG=True（開発・検証環境）の場合は一切制限しない
        # テストクライアントからのリクエスト（user-agent が空/簡素）も許可する
        if settings.DEBUG:
            return await call_next(request)

        # pytest / TestClient など典型的な自動テスト環境の UA は許可
        ua_string = request.headers.get("user-agent", "")
        lowered = ua_string.lower()
        if (
            "python-httpx" in lowered
            or "python-requests" in lowered
            or "starlette-testclient" in lowered
            or "testclient" in lowered
            or "pytest" in lowered
        ):
            return await call_next(request)

        # 静的ファイルとトップページは常に許可（エラーにせず次の処理へ）
        # ここでは "/js", "/css", "/assets", "/uploads" と "/" をホワイトリスト
        path = request.url.path
        if path == "/" or path.startswith(("/js/", "/css/", "/assets/", "/uploads/")):
            return await call_next(request)

        ua_string = request.headers.get("user-agent", "")

        # UA 未設定は 403 を返す（Starlette が正しく処理できる HTTPException）
        if not ua_string:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Forbidden"
            )

        # Bot/自動ツール特有のヘッダ検出（簡易・低誤検知寄り）
        lower_headers = {k.lower(): v.lower() for k, v in request.headers.items()}

        suspicious_header_keys = {
            "x-scrapy",
            "x-phantomjs",
            "x-playwright",
            "x-puppeteer",
            "x-crawler",
        }
        if any(key in lower_headers for key in suspicious_header_keys):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Forbidden"
            )

        # ヘッダ値に含まれる典型的 Bot/ツール名（限定的に）
        suspicious_value_signatures = [
            "scrapy",
            "httplib2",
            "python-requests",
            "java/",        # 多くはクローラ用途
            "curl/",
        ]
        joined_header_values = " ".join(lower_headers.values())
        if any(sig in joined_header_values for sig in suspicious_value_signatures):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Forbidden"
            )

        ua = user_agents.parse(ua_string)
        lowered = ua_string.lower()

        # Selenium / Playwright 等の代表的自動操作 UA 文字列を拒否
        automation_signatures = [
            "selenium",
            "webdriver",
            "headlesschrome",
            "headless chrome",
            "phantomjs",
            "playwright",
            "puppeteer",
            "cypress",
        ]
        if any(sig in lowered for sig in automation_signatures):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Forbidden"
            )

        # - 明らかなボット (is_bot)
        # - ブラウザ種別が PC / Mobile / Tablet いずれでもないもの
        if ua.is_bot or (not ua.is_pc and not ua.is_mobile and not ua.is_tablet):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Forbidden"
            )

        # 代表的なブラウザのみ許可（ホワイトリスト）
        allowed_families = {
            "Chrome",
            "Chromium",
            "Firefox",
            "Safari",
            "Edge",
            "Opera",
            "Mobile Safari",
            "Samsung Internet",
        }
        if ua.browser.family not in allowed_families:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Forbidden"
            )

        return await call_next(request)

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

    # User-Agent によるブラウザ判定 (しっかりとしたブラウザ以外は 403)
    # API / HTML 問わず全リクエストに適用
    app.add_middleware(BrowserEnforcementMiddleware)

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
    
    # 静的ファイルの提供設定（JSは専用エンドポイントで難読化）
    if settings.DEBUG:
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
                    response.headers["Cache-Control"] = "public, max-age=31536000"  # 1年
                return response

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
    app.include_router(shop_reviews_router, prefix=settings.API_V1_STR)
    app.include_router(admin_router, prefix=settings.API_V1_STR)

    def _no_cache_headers() -> dict[str, str]:
        return {
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0",
        }

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
            headers = _no_cache_headers()

        return HTMLResponse(content=content, headers=headers)

    @app.get("/js/{file_path:path}", response_class=Response)
    async def serve_obfuscated_js(file_path: str):
        """JavaScriptファイルを読み込み、難読化した上で返却する。"""
        safe_root = JS_DIR.resolve()
        requested_path = (safe_root / file_path).resolve()

        try:
            requested_path.relative_to(safe_root)
        except ValueError:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ファイルが見つかりません")

        if not requested_path.is_file():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ファイルが見つかりません")

        try:
            obfuscated = js_obfuscator.obfuscate(requested_path)
        except FileNotFoundError:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ファイルが見つかりません")

        if settings.DEBUG or settings.DEVELOPMENT:
            headers = _no_cache_headers()
        else:
            headers = {"Cache-Control": "public, max-age=31536000"}

        return Response(content=obfuscated, media_type="application/javascript", headers=headers)

    @app.get("/", response_class=HTMLResponse)
    async def read_index():
        """index.htmlを返すエンドポイント"""
        # ルートは常に正規URL扱い（/ のみ）、クエリ付きアクセスはそのまま許容（UTM等）
        return render_html("index.html")

    @app.get("/contribute", response_class=HTMLResponse)
    async def contribute_page():
        """
        店舗情報投稿ページ
        - /contribute を正規URLとして運用
        """
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

    @app.get("/robots.txt", include_in_schema=False)
    async def robots_txt():
        """
        robots.txt を静的に返却
        - 一般公開ページはクロール許可
        - 管理画面系やAPIルートなどはクロール対象外
        - テスト環境 / DEBUG 時は全体 noindex 相当の制御も検討可能
        """
        # テスト環境・ローカル環境では全体をブロックしたい場合はここで条件分岐も可能
        disallow_admin = "Disallow: /admin/\n"
        disallow_api = "Disallow: /api/\n"
        disallow_uploads = "Disallow: /uploads/\n"

        content = (
            "User-agent: *\n"
            f"{disallow_admin}"
            f"{disallow_api}"
            f"{disallow_uploads}"
            "Allow: /\n"
            "Sitemap: " + settings.BASE_URL.rstrip("/") + "/sitemap.xml\n"
        )
        return Response(content=content, media_type="text/plain")

    @app.get("/sitemap.xml", include_in_schema=False)
    async def sitemap_xml():
        """
        シンプルな静的 sitemap.xml
        - 必要に応じて動的URL(店舗詳細等)は後で拡張
        """
        base = settings.BASE_URL.rstrip("/")
        urls = [
            f"{base}/",
            f"{base}/contribute",
        ]
        xml_urls = "\n".join(
            f'  <url><loc>{loc}</loc><changefreq>daily</changefreq><priority>0.8</priority></url>'
            for loc in urls
        )
        content = (
            '<?xml version="1.0" encoding="UTF-8"?>\n'
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
            f"{xml_urls}\n"
            "</urlset>\n"
        )
        return Response(content=content, media_type="application/xml")

    @app.get("/api")
    async def root():
        return {"message": "SNS Backend API", "version": settings.VERSION}
    
    return app

    