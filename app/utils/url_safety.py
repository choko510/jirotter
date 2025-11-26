import asyncio
import logging
import time
import urllib.parse
from typing import Optional, Dict, List, Set, Any
from dataclasses import dataclass, field

import httpx
from pydantic import BaseModel

logger = logging.getLogger(__name__)

# --- 定数定義 ---
DEFAULT_BLOCK_LISTS = [
    "https://phishing.army/download/phishing_army_blocklist.txt",
    "https://malware-filter.gitlab.io/malware-filter/phishing-filter-domains.txt",
    "https://malware-filter.gitlab.io/malware-filter/urlhaus-filter-domains-online.txt",
]

DEFAULT_EXTRA_BLOCKLISTS = [
    "https://raw.githubusercontent.com/Spam404/lists/master/main-blacklist.txt",
]

# --- データモデル (Pydantic) ---
class URLSafetyResponse(BaseModel):
    safe: bool
    reason: str
    matched_domain: Optional[str] = None
    source: Optional[str] = None

# --- マネージャークラス ---
class URLBlocklistManager:
    def __init__(self, ttl_seconds: float = 86400.0):
        """
        :param ttl_seconds: ブロックリストのキャッシュ有効期限（秒）。デフォルトは24時間。
        """
        self.block_lists = DEFAULT_BLOCK_LISTS
        self.extra_lists = DEFAULT_EXTRA_BLOCKLISTS
        
        # キャッシュ: {"source_name": set(domains)}
        self._cache: Dict[str, Set[str]] = {"phishing": set(), "urlhaus": set()}
        
        self._loaded = False
        self._expire_at = 0.0
        self._lock = asyncio.Lock()
        self._ttl = ttl_seconds

    async def ensure_loaded(self, client: Optional[httpx.AsyncClient] = None, force: bool = False):
        """
        ブロックリストが未ロード、または期限切れの場合に読み込みます。
        
        :param client: httpx.AsyncClientインスタンス。指定がない場合は一時的に作成します。
        :param force: TTLに関わらず強制的に再読み込みする場合True。
        """
        now = time.time()
        if not force and self._loaded and self._expire_at > now:
            return

        async with self._lock:
            # ダブルチェックロッキング
            now = time.time()
            if not force and self._loaded and self._expire_at > now:
                return

            should_close_client = False
            if client is None:
                client = httpx.AsyncClient(timeout=10.0)
                should_close_client = True

            try:
                await self._refresh_lists(client)
                self._loaded = True
                self._expire_at = time.time() + self._ttl
                logger.info(f"Blocklists updated. TTL: {self._ttl}s")
            finally:
                if should_close_client:
                    await client.aclose()

    async def _refresh_lists(self, client: httpx.AsyncClient):
        """内部メソッド: リストの並列ダウンロードと統合"""
        # インデックス 0,1 は phishing、2 は urlhaus として扱うロジックを継承
        core_tasks = [self._download_list(client, url) for url in self.block_lists]
        extra_tasks = [self._download_list(client, url) for url in self.extra_lists]
        
        all_tasks = core_tasks + extra_tasks
        results = await asyncio.gather(*all_tasks, return_exceptions=True)

        phishing_sets: List[Set[str]] = []
        urlhaus_sets: List[Set[str]] = []

        # 結果の振り分け
        core_len = len(self.block_lists)
        for idx, res in enumerate(results):
            if isinstance(res, Exception):
                logger.error(f"Blocklist download failed (idx={idx}): {res}")
                continue
            
            # ロジック: core[2] (urlhaus) 以外は全て phishing 扱い
            if idx == 2:
                urlhaus_sets.append(res)
            else:
                phishing_sets.append(res)

        # 集合の結合
        phishing = set().union(*phishing_sets) if phishing_sets else set()
        urlhaus = set().union(*urlhaus_sets) if urlhaus_sets else set()

        # 重複除去（urlhausにあるものはphishingから消すなど、元のロジックに従う）
        common = phishing & urlhaus
        if common:
            urlhaus = urlhaus - common

        self._cache["phishing"] = phishing
        self._cache["urlhaus"] = urlhaus
        
        logger.info(f"Loaded domains - Phishing: {len(phishing)}, URLHaus: {len(urlhaus)}")

    async def _download_list(self, client: httpx.AsyncClient, url: str) -> Set[str]:
        """単一のリストをダウンロードしてドメインセットを返す"""
        try:
            resp = await self._retrying_get(client, url)
            resp.raise_for_status()
            text = resp.text
            result = set()
            for line in text.splitlines():
                line = line.strip()
                if not line or line.startswith("#") or line.startswith("!"):
                    continue
                # hosts形式対応 (127.0.0.1 domain.com)
                if " " in line:
                    line = line.split()[-1]
                
                dom = line.strip(".").lower()
                if "." in dom: # 最低限のドメインチェック
                    result.add(dom)
            return result
        except Exception as e:
            logger.error(f"Failed to download {url}: {e}")
            raise e

    async def _retrying_get(self, client: httpx.AsyncClient, url: str, max_retries: int = 2) -> httpx.Response:
        """リトライ付きGETリクエスト"""
        attempt = 0
        backoff = 0.5
        while True:
            try:
                resp = await client.get(url)
                if resp.status_code in (429, 502, 503, 504):
                    raise httpx.HTTPStatusError("Transient error", request=resp.request, response=resp)
                return resp
            except (httpx.RequestError, httpx.HTTPStatusError) as e:
                if attempt >= max_retries:
                    raise
                await asyncio.sleep(backoff)
                backoff *= 2
                attempt += 1

    def extract_domain(self, url: str) -> Optional[str]:
        """URLから正規化されたドメインを抽出"""
        try:
            parsed = urllib.parse.urlparse(url.strip())
            host = parsed.hostname
            if not host:
                return None
            return host.strip(".").lower()
        except Exception:
            return None

    def check_url(self, url: str) -> URLSafetyResponse:
        """URLの安全性を同期的にチェック（キャッシュ済みデータを使用）"""
        domain = self.extract_domain(url)
        if not domain:
            return URLSafetyResponse(safe=False, reason="invalid_url")

        # サブドメインマッチング (例: a.b.c.com -> a.b.c.com, b.c.com, c.com)
        parts = domain.split('.')
        # 少なくとも2つの部分（例: example.com）からなるドメインのみをチェック
        if len(parts) < 2:
             # localhostなどの単純なホスト名はチェックしない、または安全とする
            return URLSafetyResponse(safe=True, reason="clean")

        domain_variants = [".".join(parts[i:]) for i in range(len(parts) - 1)]

        for source, blocklist in self._cache.items():
            for variant in domain_variants:
                if variant in blocklist:
                    return URLSafetyResponse(
                        safe=False,
                        reason="matched",
                        matched_domain=variant,
                        source=source
                    )
        
        return URLSafetyResponse(safe=True, reason="clean")