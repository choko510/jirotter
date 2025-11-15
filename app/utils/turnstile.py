import httpx
from typing import Optional

from config import settings


async def verify_turnstile_token(token: Optional[str], remote_ip: Optional[str] = None) -> bool:
    """Verify Cloudflare Turnstile token.

    Args:
        token: Token string received from the client widget.
        remote_ip: Optional IP address of the user for additional validation.

    Returns:
        True if verification succeeded or Turnstile is disabled, otherwise False.
    """
    if not settings.TURNSTILE_ENABLED:
        return True

    if not token:
        return False

    payload = {
        "secret": settings.TURNSTILE_SECRET_KEY,
        "response": token,
    }

    if remote_ip:
        payload["remoteip"] = remote_ip

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.post(settings.TURNSTILE_VERIFY_URL, data=payload)
            response.raise_for_status()
            data = response.json()
            return bool(data.get("success"))
    except httpx.HTTPError as exc:
        # 失敗してもFalseを返し、呼び出し元でエラーハンドリングする
        print(f"Turnstile verification failed: {exc}")
        return False
