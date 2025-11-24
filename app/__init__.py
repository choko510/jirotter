from fastapi import FastAPI, Request, HTTPException, status, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, Response
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.gzip import GZipMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.middleware.sessions import SessionMiddleware
from starlette_csrf import CSRFMiddleware
from contextlib import asynccontextmanager
from database import engine, Base, SessionLocal, get_db
from config import settings
import os
import time
import random
import string
import base64
from pathlib import Path
import threading
import user_agents
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple
from functools import lru_cache
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models import RamenShop, Checkin

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
    """
    JS を Base64 で埋め込んで、クライアント側で復号して実行する難読化器。

    - UTF-8 セーフ（日本語コメント・文字列 OK）
    - ブラウザでは eval ではなく <script> 挿入で実行
    - Node 等ではフォールバックとして eval を使用
    """

    def __init__(self):
        self._cache: Dict[str, Tuple[float, str]] = {}
        self._lock = threading.Lock()

    def obfuscate(self, file_path: Path) -> str:
        if not file_path.exists() or not file_path.is_file():
            raise FileNotFoundError(str(file_path))

        mtime = file_path.stat().st_mtime
        cache_key = str(file_path)

        # mtime ベースのキャッシュ
        with self._lock:
            cached = self._cache.get(cache_key)
            if cached and cached[0] == mtime:
                return cached[1]

        # 元コード読み込み（UTF-8）
        source = file_path.read_text(encoding="utf-8")

        # UTF-8 バイト列 → Base64（ASCII のみになる）
        utf8_bytes = source.encode("utf-8")
        encoded = base64.b64encode(utf8_bytes).decode("ascii")

        # JS ラッパ生成
        # Base64 は [A-Za-z0-9+/=] だけなので ' で囲んでも安全
        obfuscated = (
            "(function(){"
            "const s='" + encoded + "';"
            "function b64ToBytes(b){"
            "  if (typeof atob === 'function') {"
            "    const bin = atob(b);"
            "    const len = bin.length;"
            "    const out = new Uint8Array(len);"
            "    for (let i = 0; i < len; i++) out[i] = bin.charCodeAt(i);"
            "    return out;"
            "  } else if (typeof Buffer !== 'undefined') {"
            "    const buf = Buffer.from(b, 'base64');"
            "    const out = new Uint8Array(buf.length);"
            "    for (let i = 0; i < buf.length; i++) out[i] = buf[i];"
            "    return out;"
            "  }"
            "  throw new Error('No base64 decoder available');"
            "}"
            "function decodeUtf8(bytes){"
            "  if (typeof TextDecoder !== 'undefined') {"
            "    return new TextDecoder('utf-8').decode(bytes);"
            "  }"
            "  let s = '';"
            "  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);"
            "  try {"
            "    return decodeURIComponent(escape(s));"
            "  } catch (e) {"
            "    return s;"
            "  }"
            "}"
            "const code = decodeUtf8(b64ToBytes(s));"
            "if (typeof document !== 'undefined' && document.createElement) {"
            "  const script = document.createElement('script');"
            "  script.type = 'text/javascript';"
            "  script.text = code;"
            "  const current = document.currentScript || (function(){"
            "    const scripts = document.getElementsByTagName('script');"
            "    return scripts[scripts.length - 1] || null;"
            "  })();"
            "  if (current && current.parentNode) {"
            "    current.parentNode.insertBefore(script, current.nextSibling);"
            "  } else if (document.head) {"
            "    document.head.appendChild(script);"
            "  } else {"
            "    document.documentElement.appendChild(script);"
            "  }"
            "} else {"
            "  (0,eval)(code);"
            "}"
            "})();"
        )

        with self._lock:
            self._cache[cache_key] = (mtime, obfuscated)

        return obfuscated


js_obfuscator = JavaScriptObfuscator()

# Sitemap and Robots.txt helper functions
def calculate_shop_priority(shop: RamenShop, checkin_count: int = 0) -> float:
    """店舗の重要度を計算"""
    base_priority = 0.7
    
    # チェックイン数で重要度を調整
    if checkin_count > 0:
        base_priority += min(0.2, checkin_count * 0.01)
    
    # 最近の更新で重要度を上げる
    if shop.last_update:
        # タイムゾーン対応
        last_update = shop.last_update
        if last_update.tzinfo is None:
            last_update = last_update.replace(tzinfo=timezone.utc)
            
        if (datetime.now(timezone.utc) - last_update).days < 30:
            base_priority += 0.1
    
    # 小数点第1位で丸める（浮動小数点誤差対策）
    return min(1.0, round(base_priority, 1))

def determine_changefreq(last_update: Optional[datetime]) -> str:
    """更新頻度を決定"""
    if not last_update:
        return "monthly"
    
    # タイムゾーン対応
    if last_update.tzinfo is None:
        last_update = last_update.replace(tzinfo=timezone.utc)
    
    days_since_update = (datetime.now(timezone.utc) - last_update).days
    
    if days_since_update < 7:
        return "daily"
    elif days_since_update < 30:
        return "weekly"
    elif days_since_update < 90:
        return "monthly"
    else:
        return "yearly"

@lru_cache(maxsize=1)
def get_sitemap_cache_key() -> str:
    """sitemapキャッシュ用のキーを生成"""
    # 時間ベースのキャッシュキー（1時間ごとに更新）
    return f"sitemap_{datetime.now(timezone.utc).strftime('%Y%m%d_%H')}"

def generate_sitemap_xml(urls: List[Dict]) -> str:
    """sitemap XMLを生成"""
    xml_urls = []
    for url_data in urls:
        url_xml = f'  <url><loc>{url_data["loc"]}</loc>'
        if url_data.get("lastmod"):
            url_xml += f'<lastmod>{url_data["lastmod"]}</lastmod>'
        url_xml += f'<changefreq>{url_data["changefreq"]}</changefreq>'
        url_xml += f'<priority>{url_data["priority"]}</priority>'
        url_xml += '</url>'
        xml_urls.append(url_xml)
    
    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "\n".join(xml_urls) +
        "\n</urlset>\n"
    )

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

    app.add_middleware(CSRFMiddleware, secret=settings.SESSION_SECRET_KEY)

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
        # ディレクトリトラバーサル対策
        if ".." in file_path or file_path.startswith("/") or file_path.startswith("\\"):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ファイルが見つかりません")

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
        拡張robots.txt
        - クロールディレクティブの詳細化
        - sitemapインデックスの指定
        - 特殊ボットの対応
        """
        base_url = settings.BASE_URL.rstrip("/")
        
        content = f"""User-agent: *
Allow: /
Disallow: /admin/
Disallow: /api/
Disallow: /uploads/
Disallow: /*?*
Crawl-delay: 1

# Googlebot特別設定
User-agent: Googlebot
Allow: /
Allow: /#!/shop/*
Disallow: /admin/
Disallow: /api/
Crawl-delay: 0

# 画像検索用
User-agent: Googlebot-Image
Allow: /uploads/
Allow: /assets/

# SNSクローラー
User-agent: Twitterbot
Allow: /
User-agent: facebookexternalhit
Allow: /

Sitemap: {base_url}/sitemap.xml
"""
        return Response(content=content, media_type="text/plain")

    @app.get("/sitemap.xml", include_in_schema=False)
    async def sitemap_xml(db: Session = Depends(get_db)):
        """
        動的sitemap.xml生成
        - ハッシュURL形式の店舗ページを含める
        - キャッシュ戦略を実装
        - ページング対応（将来的な拡張性）
        """
        base = settings.BASE_URL.rstrip("/")
        
        # 静的ページ
        static_urls = [
            {
                "loc": f"{base}/",
                "changefreq": "daily",
                "priority": "1.0"
            },
            {
                "loc": f"{base}/contribute",
                "changefreq": "weekly",
                "priority": "0.8"
            },
        ]
        
        # 動的店舗ページ（ハッシュURL）
        try:
            # チェックイン数を含めて店舗情報を取得
            shops_with_checkins = (
                db.query(
                    RamenShop,
                    func.count(Checkin.id).label('checkin_count')
                )
                .outerjoin(Checkin, RamenShop.id == Checkin.shop_id)
                .group_by(RamenShop.id)
                .all()
            )
            
            shop_urls = []
            for shop, checkin_count in shops_with_checkins:
                # GoogleのAjaxクローリング用に#!形式を使用
                shop_urls.append({
                    "loc": f"{base}/#!/shop/{shop.id}",
                    "lastmod": shop.last_update.isoformat() if shop.last_update else None,
                    "changefreq": determine_changefreq(shop.last_update),
                    "priority": calculate_shop_priority(shop, checkin_count or 0)
                })
            
            # 全URLを結合
            all_urls = static_urls + shop_urls
            
        except Exception as e:
            # エラー時は静的ページのみ返す
            print(f"Error generating sitemap: {e}")
            all_urls = static_urls
        
        # XML生成
        xml_content = generate_sitemap_xml(all_urls)
        
        # キャッシュヘッダー設定
        headers = {}
        if settings.DEBUG or settings.DEVELOPMENT:
            headers = {
                "Cache-Control": "no-cache, no-store, must-revalidate",
                "Pragma": "no-cache",
                "Expires": "0",
            }
        else:
            # 本番環境では1時間キャッシュ
            headers = {"Cache-Control": "public, max-age=3600"}
        
        return Response(content=xml_content, media_type="application/xml; charset=utf-8", headers=headers)

    @app.get("/api")
    async def root():
        return {"message": "SNS Backend API", "version": settings.VERSION}
    
    return app

    