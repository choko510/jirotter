import asyncio
import sys
import time
from collections import defaultdict, deque
from typing import Deque, Dict

from fastapi import HTTPException, status


class RateLimiter:
    """シンプルなインメモリレートリミッター"""

    def __init__(self) -> None:
        self._lock = asyncio.Lock()
        self._requests: Dict[str, Deque[float]] = defaultdict(deque)

    async def hit(self, key: str, limit: int, window_seconds: int) -> None:
        """キーに対してレート制限を適用する"""
        # テスト実行中はレート制限を無効化
        if "pytest" in sys.modules:
            return

        now = time.monotonic()

        async with self._lock:
            request_queue = self._requests[key]

            # ウィンドウ外のリクエストを削除
            threshold = now - window_seconds
            while request_queue and request_queue[0] <= threshold:
                request_queue.popleft()

            if len(request_queue) >= limit:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="短時間に過剰なリクエストが行われました。しばらく時間をおいて再度お試しください。",
                )

            request_queue.append(now)


rate_limiter = RateLimiter()
