from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional

from app.utils.url_safety import URLBlocklistManager, URLSafetyResponse

router = APIRouter()

# シングルトンインスタンス
url_blocklist_manager = URLBlocklistManager()

class URLSafetyRequest(BaseModel):
    url: str

class URLSafetyResult(BaseModel):
    safe: bool
    reason: str
    matched_domain: Optional[str] = None
    source: Optional[str] = None

@router.post("/api/url-safety-check", response_model=URLSafetyResult)
async def check_url_safety(request: URLSafetyRequest):
    """
    URLの安全性をチェックするAPIエンドポイント
    """
    try:
        # ブロックリストの読み込みを確認
        await url_blocklist_manager.ensure_loaded()
        
        # URLの安全性をチェック
        result = url_blocklist_manager.check_url(request.url)
        
        return URLSafetyResult(
            safe=result.safe,
            reason=result.reason,
            matched_domain=result.matched_domain,
            source=result.source
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"URL安全性チェック中にエラーが発生しました: {str(e)}")

@router.get("/api/url-safety-check/status")
async def get_blocklist_status():
    """
    ブロックリストのステータスを取得するAPIエンドポイント
    """
    try:
        phishing_count = len(url_blocklist_manager._cache.get("phishing", set()))
        urlhaus_count = len(url_blocklist_manager._cache.get("urlhaus", set()))
        
        return {
            "loaded": url_blocklist_manager._loaded,
            "expire_at": url_blocklist_manager._expire_at,
            "phishing_domains": phishing_count,
            "urlhaus_domains": urlhaus_count,
            "total_domains": phishing_count + urlhaus_count
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"ステータス取得中にエラーが発生しました: {str(e)}")