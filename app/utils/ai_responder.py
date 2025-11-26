"""AIレスポンダー関連のユーティリティ"""
from __future__ import annotations

import os
import random
import secrets
from typing import Optional

from google import genai
from google.genai import types
from sqlalchemy.orm import Session

from app.models import User
from app.utils.auth import get_password_hash

AI_USER_ID = "jirok"
AI_USER_EMAIL = "jirok@jirotter.local"
AI_USER_DISPLAY_NAME = "Jirok"


class GeminiResponder:
    """Gemini API を用いた返信生成ヘルパー"""

    def __init__(self) -> None:
        self.api_key = os.getenv("GOOGLE_API_KEY")
        self.client = genai.Client(api_key=self.api_key) if self.api_key else None

    async def generate(self, post_content: str, author_id: str) -> str:
        """Gemini で返信を生成し、失敗時はフォールバックを返す"""
        fallback = _fallback_reply(post_content, author_id)

        if not self.client:
            return fallback

        prompt = _build_prompt(post_content, author_id)

        try:
            response = await self.client.aio.models.generate_content(
                model="gemini-flash-latest",
                contents=prompt,
                config=types.GenerateContentConfig(
                    system_instruction=(
                        "あなたはラーメン二郎に精通したフレンドリーなアシスタントです。"
                        "食券の買い方やカスタム方法、マナーなどを丁寧かつ分かりやすく助言してください。"
                        "必要な範囲で簡潔に回答してください。"
                    ),
                    temperature=0.6,
                    response_mime_type="text/plain",
                ),
            )

            if response and response.text:
                generated = response.text.strip()
                if generated:
                    return generated
        except Exception as exc:  # pragma: no cover - 外部API依存
            print(f"AI返信生成中にエラーが発生しました: {exc}")

        return fallback

    async def ask_guide(self, question: str) -> str:
        """ガイド用の質問に回答する"""
        if not self.client:
            return "申し訳ありません。現在AI機能は利用できません。"

        try:
            response = await self.client.aio.models.generate_content(
                model="gemini-flash-latest",
                contents=question,
                config=types.GenerateContentConfig(
                    system_instruction=(
                        "あなたはラーメン二郎の初心者向けガイドAIです。"
                        "ユーザーからの質問に対して、二郎のルール、マナー、用語などを優しく解説してください。"
                        "初心者にもわかりやすい言葉を選び、威圧感を与えないようにしてください。"
                        "もし二郎に関係のない質問が来た場合は、丁寧に「ラーメン二郎に関する質問をお願いします」と返してください。"
                    ),
                    temperature=0.7,
                    response_mime_type="text/plain",
                ),
            )

            if response and response.text:
                return response.text.strip()
            
            return "申し訳ありません。回答を生成できませんでした。"

        except Exception as exc:
            print(f"AIガイド回答生成中にエラーが発生しました: {exc}")
            return "申し訳ありません。エラーが発生しました。"


_responder = GeminiResponder()


def _build_prompt(post_content: str, author_id: str) -> str:
    base_content = (post_content or "").strip()
    addressee = f"{author_id}さん" if author_id else "お客様"
    return f"""
ユーザーの投稿に対して短い返信を作成してください。

投稿者: {addressee}
投稿内容:
{base_content or '（内容がありません）'}

返信要件:
- です・ます調で丁寧に回答する
- 必要な情報を過不足なく伝える
- 過度な断定や医療的アドバイスは避ける
- ラーメン二郎の楽しみ方や注意点に言及する
"""


def _fallback_reply(post_content: str, author_id: str) -> str:
    base_content = (post_content or "").strip()
    normalized = base_content.lower()
    addressee = f"{author_id}さん" if author_id else "お客様"

    keyword_responses = [
        (("おすすめ", "教えて", "迷う"), "おすすめが知りたいときは、まずはデフォルトの一杯から攻めてみるのが鉄板ですよ。気になるトッピングがあれば量の調整も手伝います！"),
        (("ニンニク", "にんにく"), "ニンニクは後半戦のアクセントに最高です。体調と相談しながら楽しんでくださいね。"),
        (("アブラ", "脂"), "アブラ増しのご相談ですね。カロリーは正義、でも無理は禁物です！自分ベストな量で楽しみましょう。"),
        (("カラメ", "味濃"), "カラメ希望なら食券を渡すときに一声かければOKです。濃さ調整もお気軽にどうぞ！"),
        (("麺", "硬さ", "やわ"), "麺の硬さは茹で時間で微調整できます。好みを教えていただければ茹で具合を合わせますよ。"),
    ]

    for keywords, response in keyword_responses:
        if any(keyword in normalized for keyword in keywords):
            return f"{addressee}、{response}"

    default_responses = [
        "ご指名ありがとうございます！ご注文やカスタムの相談があればいつでもどうぞ。",
        "呼び出しありがとうございます。今日のコンディションも万全ですので、気になることがあれば気軽に聞いてくださいね。",
        "いつでもサポートに入りますよ。今夜の一杯が最高の体験になりますように！",
        "お声がけ感謝です！おすすめトッピングや食べ方の相談もお任せください。",
    ]

    return f"{addressee}、{random.choice(default_responses)}"


def ensure_ai_responder_user(db: Session) -> Optional[User]:
    """AIレスポンダーユーザーを確実に作成または取得する。"""
    if not db:
        return None

    ai_user = db.query(User).filter(User.id == AI_USER_ID).first()
    if ai_user:
        return ai_user

    # パスワードは利用されないが、モデル制約を満たすために設定する
    random_password = secrets.token_urlsafe(16)
    ai_user = User(
        id=AI_USER_ID,
        email=AI_USER_EMAIL,
        password_hash=get_password_hash(random_password),
        username=AI_USER_DISPLAY_NAME,
        bio="タイムラインで呼び出せるAIアシスタントです。",
    )
    db.add(ai_user)
    db.flush()
    return ai_user


async def generate_ai_reply(post_content: str, author_id: str) -> str:
    """投稿内容に応じてGeminiでAI返信メッセージを生成する。"""
    reply = await _responder.generate(post_content, author_id)
    return reply


async def ask_ai_guide(question: str) -> str:
    """ガイドへの質問に対してAI回答を生成する。"""
    return await _responder.ask_guide(question)
