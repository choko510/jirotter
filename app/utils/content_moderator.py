import os
import json
import asyncio
from typing import Dict, List, Optional, Tuple
import aiohttp
from sqlalchemy.orm import Session
from app.models import Post, Report

class ContentModerator:
    """AIによるコンテンツ審査を行うクラス"""
    
    def __init__(self):
        self.api_key = os.getenv("OPENAI_API_KEY")
        self.base_url = "https://api.openai.com/v1/chat/completions"
        
    async def analyze_content(self, content: str, reason: str = "", user_history: str = "") -> Dict:
        """コンテンツの悪質性をAIで分析する"""
        if not self.api_key:
            # APIキーがない場合はデフォルトで安全と判定
            return {"is_violation": False, "confidence": 0.0, "reason": "APIキーが設定されていません"}
        
        prompt = f"""
        以下の投稿内容を分析し、コミュニティガイドラインに違反しているか判断してください。
        
        投稿内容:
        {content}
        
        通報理由: {reason}
        
        {user_history}
        
        以下の基準で評価してください：
        1. ヘイトスピーチや差別的な内容
        2. 暴力的または脅迫的な内容
        3. スパムや宣伝目的の投稿
        4. 性的に露骨な内容
        5. 誹謗中傷や個人攻撃
        6. デマや偽情報
        
        ユーザーの過去の行動パターンも考慮に入れて判断してください。
        過去に同様の違反を繰り返している場合は、より厳しく判定してください。
        
        JSON形式で以下の情報を返してください：
        {{
            "is_violation": true/false,
            "confidence": 0.0-1.0,
            "reason": "違反理由の詳細",
            "severity": "low/medium/high"
        }}
        """
        
        try:
            async with aiohttp.ClientSession() as session:
                headers = {
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json"
                }
                
                data = {
                    "model": "gpt-3.5-turbo",
                    "messages": [
                        {"role": "system", "content": "あなたはコンテンツモデレーターとして、投稿内容の適切性を客観的に評価します。"},
                        {"role": "user", "content": prompt}
                    ],
                    "temperature": 0.3,
                    "max_tokens": 500
                }
                
                async with session.post(self.base_url, headers=headers, json=data) as response:
                    if response.status == 200:
                        result = await response.json()
                        content_analysis = result["choices"][0]["message"]["content"]
                        
                        # JSONをパース
                        try:
                            analysis = json.loads(content_analysis)
                            return analysis
                        except json.JSONDecodeError:
                            # JSONパースに失敗した場合は安全と判定
                            return {"is_violation": False, "confidence": 0.0, "reason": "AI分析結果の解析に失敗しました"}
                    else:
                        # API呼び出し失敗時は安全と判定
                        return {"is_violation": False, "confidence": 0.0, "reason": "AI分析APIの呼び出しに失敗しました"}
                        
        except Exception as e:
            # 例外発生時は安全と判定
            return {"is_violation": False, "confidence": 0.0, "reason": f"AI分析中にエラーが発生しました: {str(e)}"}
    
    async def get_user_history(self, db: Session, user_id: str, limit: int = 10) -> str:
        """ユーザーの過去の投稿履歴を取得"""
        posts = db.query(Post).filter(Post.user_id == user_id).order_by(Post.created_at.desc()).limit(limit).all()
        reports = db.query(Report).join(Post).filter(Post.user_id == user_id).all()
        
        history_text = ""
        
        if posts:
            history_text += f"\nユーザーの過去の投稿（最新{len(posts)}件）:\n"
            for i, post in enumerate(posts):
                history_text += f"{i+1}. {post.content[:100]}{'...' if len(post.content) > 100 else ''}\n"
        
        if reports:
            history_text += f"\nこのユーザーは過去に{len(reports)}回通報されています。\n"
            history_text += "通報理由: " + ", ".join([r.reason for r in reports[-5:]]) + "\n"
        
        return history_text
    
    async def review_reported_post(self, db: Session, post_id: int, reason: str) -> Dict:
        """通報された投稿を審査する"""
        post = db.query(Post).filter(Post.id == post_id).first()
        if not post:
            return {"error": "投稿が見つかりません"}
        
        # ユーザーの過去の履歴を取得
        user_history = await self.get_user_history(db, post.user_id)
        
        # AIでコンテンツを分析
        analysis = await self.analyze_content(post.content, reason, user_history)
        
        # 違反と判断された場合
        if analysis.get("is_violation", False) and analysis.get("confidence", 0) > 0.7:
            try:
                # 投稿を削除
                db.delete(post)
                db.commit()
                
                return {
                    "action": "deleted",
                    "reason": analysis.get("reason", "コミュニティガイドライン違反"),
                    "confidence": analysis.get("confidence", 0),
                    "severity": analysis.get("severity", "medium")
                }
            except Exception as e:
                db.rollback()
                return {"error": f"投稿の削除に失敗しました: {str(e)}"}
        
        # 違反ではないと判断された場合
        return {
            "action": "kept",
            "reason": analysis.get("reason", "違反と判断されませんでした"),
            "confidence": analysis.get("confidence", 0)
        }
    
# グローバルインスタンス
content_moderator = ContentModerator()