from fastapi import APIRouter, HTTPException, status, Depends, Request
from pydantic import BaseModel
from app.utils.ai_responder import ask_ai_guide
from app.utils.auth import get_current_user
from app.models import User
from app.utils.rate_limiter import rate_limiter
import re

router = APIRouter()

class GuideQuestion(BaseModel):
    question: str

# 簡易的なプロンプトインジェクション・悪意のあるキーワード対策
MALICIOUS_PATTERNS = [
    r"ignore all previous instructions",
    r"system prompt",
    r"システムプロンプト",
    r"命令を無視",
    r"制限を解除",
    r"jailbreak",
    r"dan mode",
    r"roleplay as",
]

MALICIOUS_REGEX = re.compile("|".join(MALICIOUS_PATTERNS), re.IGNORECASE)

@router.post("/guide/ask")
async def ask_guide_question(
    request: Request,
    body: GuideQuestion,
    current_user: User = Depends(get_current_user)
):
    # BAN済みユーザーの拒否
    if current_user.is_banned:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="アカウントの利用が制限されています。"
        )

    # レート制限 (例: 1分間に5回まで)
    # キーを user_id + endpoint にすることでユーザーごとの制限にする
    rate_limit_key = f"guide_ask:{current_user.id}"
    await rate_limiter.hit(rate_limit_key, limit=5, window_seconds=60)

    question = body.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="質問内容が空です")

    # プロンプトインジェクション対策
    if MALICIOUS_REGEX.search(question):
        # 悪意のあるリクエストとして記録したり、さらに厳しい制限をかけることも可能
        # ここでは単に拒否する
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="不適切な質問内容は受け付けられません。"
        )

    answer = await ask_ai_guide(question)
    return {"answer": answer}
