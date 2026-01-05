import os
import json
import asyncio
from typing import Dict, List, Optional, Tuple, Union
from pydantic import BaseModel
from sqlalchemy.orm import Session
from fastapi import UploadFile
from app.models import Post, Report, User
from app.utils.scoring import apply_penalty
from app.utils.image_validation import validate_image_file
from app.utils.image_processor import process_image
from google import genai
from google.genai import types

class ContentAnalysisResult(BaseModel):
    """コンテンツ分析結果の構造化モデル"""
    is_violation: bool
    confidence: float
    reason: str
    severity: str  # "low", "medium", "high"

class ContentModerator:
    """Gemini AIによるコンテンツ審査を行うクラス"""
    
    def __init__(self):
        self.api_key = os.getenv("GOOGLE_API_KEY")
        self.client = genai.Client(api_key=self.api_key) if self.api_key else None
        
    async def analyze_content(self, content: str, reason: str = "", user_history: str = "") -> Dict:
        """コンテンツの悪質性をGemini AIで分析する"""
        if not self.api_key or not self.client:
            # APIキーがない場合はデフォルトで安全と判定
            return {"is_violation": False, "confidence": 0.0, "reason": "APIキーが設定されていません"}
        
        prompt = f"""
        以下の投稿内容を分析し、コミュニティガイドラインに違反しているか判断してください。
        
        投稿内容:
        {content}
        
        通報理由: {reason}
        
        ユーザーの過去の投稿:
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
        """
        
        try:
            print("コンテンツ分析を開始します...")
            response = await self.client.aio.models.generate_content(
                model="gemini-flash-latest",
                contents=prompt,
                config=types.GenerateContentConfig(
                    system_instruction="あなたはコンテンツモデレーターとして、投稿内容の適切性を客観的に評価します。",
                    response_mime_type="application/json",
                    response_schema=ContentAnalysisResult,
                    temperature=0.3,
                )
            )
            
            # レスポンスを解析
            if response and response.text:
                analysis = json.loads(response.text)
                print(f"分析結果: {analysis}")
                return analysis
            else:
                print("APIからの応答が空です")
                return {"is_violation": False, "confidence": 0.0, "reason": "APIからの応答が空です"}
            
        except Exception as e:
            # 例外発生時は安全と判定
            print(f"分析中にエラーが発生しました: {str(e)}")
            return {"is_violation": False, "confidence": 0.0, "reason": f"AI分析中にエラーが発生しました: {str(e)}"}
    
    async def analyze_multimodal_content(
        self,
        content: Optional[str] = None,
        image: Optional[UploadFile] = None,
        media_path: Optional[str] = None,
        media_type: Optional[str] = None,
        reason: str = "",
        user_history: str = "",
    ) -> Dict:
        """
        テキストと画像を含むコンテンツを分析する（画像アップロード対応版）

        - image が指定されていれば優先して使用
        - media_path / media_type は後方互換用
        """
        if not self.api_key or not self.client:
            return {
                "is_violation": False,
                "confidence": 0.0,
                "reason": "APIキーが設定されていません",
            }

        contents: List = []

        # テキストコンテンツ
        if content:
            contents.append(content)

        # 画像（UploadFile）入力に対応
        temp_media_path: Optional[str] = None
        temp_media_type: Optional[str] = None

        try:
            if image is not None:
                # 画像バリデーション
                validation = validate_image_file(image)
                if not validation.get("is_valid", False):
                    return {
                        "is_violation": False,
                        "confidence": 0.0,
                        "reason": f"画像バリデーションエラー: {validation.get('error')}",
                    }

                # 画像処理（WebP化など）＋保存
                thumbnail_url, original_url = process_image(image, user_id="moderation")
                if not original_url:
                    return {
                        "is_violation": False,
                        "confidence": 0.0,
                        "reason": "画像処理に失敗しました",
                    }

                # Gemini API に渡すために実ファイルパスを取得
                # process_image は "/uploads/..." を返すため先頭の "/" を落として相対パスとして扱う
                temp_media_path = original_url.lstrip("/")
                temp_media_type = "image/webp"

            # 後方互換: media_path/media_type が直接指定されるケース
            if not temp_media_path and media_path and media_type:
                temp_media_path = media_path
                temp_media_type = media_type

            # メディアがあれば Gemini 用に組み立て
            if temp_media_path and temp_media_type:
                from google.genai import types as genai_types

                if temp_media_type.startswith("image/"):
                    try:
                        with open(temp_media_path, "rb") as f:
                            image_bytes = f.read()
                        contents.append(
                            genai_types.Part.from_bytes(
                                data=image_bytes,
                                mime_type=temp_media_type,
                            )
                        )
                    except Exception as exc:
                        return {
                            "is_violation": False,
                            "confidence": 0.0,
                            "reason": f"画像ファイルの読み込みに失敗しました: {exc}",
                        }
                elif temp_media_type.startswith("video/"):
                    try:
                        video_file = await self.client.aio.files.upload(file=temp_media_path)
                        contents.append(video_file)
                    except Exception as exc:
                        return {
                            "is_violation": False,
                            "confidence": 0.0,
                            "reason": f"動画ファイルのアップロードに失敗しました: {exc}",
                        }

            # 分析プロンプト
            prompt = f"""
以下の投稿内容（テキストおよびメディア）を分析し、コミュニティガイドラインに違反しているか判断してください。

通報理由: {reason}

{user_history}

以下の基準で評価してください：
1. ヘイトスピーチや差別的な内容
2. 暴力的または脅迫的な内容
3. スパムや宣伝目的の投稿
4. 性的に露骨な内容
5. 誹謗中傷や個人攻撃
6. デマや偽情報
7. 不適切な画像や動画コンテンツ

ユーザーの過去の行動パターンも考慮に入れて判断してください。
過去に同様の違反を繰り返している場合は、より厳しく判定してください。
"""
            contents.append(prompt)

            print(f"マルチモーダルコンテンツ分析を開始します... (media_type: {temp_media_type})")
            response = await self.client.aio.models.generate_content(
                model="gemini-flash-latest",
                contents=contents,
                config=types.GenerateContentConfig(
                    system_instruction="あなたはコンテンツモデレーターとして、投稿内容の適切性を客観的に評価します。",
                    response_mime_type="application/json",
                    response_schema=ContentAnalysisResult,
                    temperature=0.3,
                ),
            )

            if response and response.text:
                analysis = json.loads(response.text)
                print(f"マルチモーダル分析結果: {analysis}")
                return analysis

            print("APIからの応答が空です")
            return {
                "is_violation": False,
                "confidence": 0.0,
                "reason": "APIからの応答が空です",
            }

        except Exception as e:
            print(f"マルチモーダル分析中にエラーが発生しました: {e}")
            return {
                "is_violation": False,
                "confidence": 0.0,
                "reason": f"AI分析中にエラーが発生しました: {e}",
            }
    
    async def analyze_content_with_thinking(self, content: str, reason: str = "", user_history: str = "") -> Dict:
        """思考機能を使用して複雑なコンテンツ判断を行う"""
        if not self.api_key or not self.client:
            return {"is_violation": False, "confidence": 0.0, "reason": "APIキーが設定されていません"}
        
        prompt = f"""
        以下の投稿内容を詳細に分析し、コミュニティガイドラインに違反しているか判断してください。
        
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
        
        注意深く分析し、文脈やニュアンスを考慮してください。曖昧な場合は、より安全な判断を下してください。
        """
        
        try:
            print("思考機能を使用したコンテンツ分析を開始します...")
            response = await self.client.aio.models.generate_content(
                model="gemini-flash-latest",
                contents=prompt,
                config=types.GenerateContentConfig(
                    system_instruction="あなたは経験豊富なコンテンツモデレーターとして、投稿内容の適切性を注意深く評価します。",
                    response_mime_type="application/json",
                    response_schema=ContentAnalysisResult,
                    temperature=0.3,  # より一貫性のため温度を低く設定
                    thinking_config=types.ThinkingConfig(
                        thinking_budget=1024  # 思考バジェットを設定
                    )
                )
            )
            
            # レスポンスを解析
            if response and response.text:
                analysis = json.loads(response.text)
                print(f"思考機能を使用した分析結果: {analysis}")
                return analysis
            else:
                print("APIからの応答が空です")
                return {"is_violation": False, "confidence": 0.0, "reason": "APIからの応答が空です"}
            
        except Exception as e:
            # 例外発生時は安全と判定
            print(f"思考機能を使用した分析中にエラーが発生しました: {str(e)}")
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
        print(f"投稿ID {post_id} の審査を開始します。理由: {reason}")
        post = db.query(Post).filter(Post.id == post_id).first()
        if not post:
            print("投稿が見つかりません")
            return {"error": "投稿が見つかりません"}
        
        # ユーザーの過去の履歴を取得
        print(f"ユーザーID {post.user_id} の履歴を取得します...")
        user_history = await self.get_user_history(db, post.user_id)
        
        # AIでコンテンツを分析
        analysis = await self.analyze_content(post.content, reason, user_history)
        
        # 違反と判断された場合
        if analysis.get("is_violation", False) and analysis.get("confidence", 0) > 0.7:
            print("違反コンテンツと判断されました。投稿を削除します...")
            try:
                offender = db.query(User).filter(User.id == post.user_id).first()
                if offender:
                    print(f"ユーザー {offender.id} にペナルティを適用します")
                    apply_penalty(
                        db,
                        offender,
                        "content_violation",
                        analysis.get("severity", "medium") or "medium",
                        metadata={
                            "post_id": post_id,
                            "reported_reason": reason,
                        },
                        override_reason=analysis.get("reason"),
                    )

                # 関連する通報レコードを先に削除
                from app.models import Report
                reports = db.query(Report).filter(Report.post_id == post_id).all()
                for report in reports:
                    db.delete(report)
                print(f"{len(reports)}件の関連通報レコードを削除しました")

                # 投稿を削除
                db.delete(post)
                print("現在の投稿を削除しました")
                
                # 過去の投稿もチェックして悪質なものがあれば削除
                await self.check_and_delete_user_past_posts(db, post.user_id, analysis.get("reason", "コミュニティガイドライン違反"))
                
                db.commit()
                print("投稿の削除が完了しました")
                
                return {
                    "action": "deleted",
                    "reason": analysis.get("reason", "コミュニティガイドライン違反"),
                    "confidence": analysis.get("confidence", 0),
                    "severity": analysis.get("severity", "medium")
                }
            except Exception as e:
                db.rollback()
                print(f"投稿の削除に失敗しました: {str(e)}")
                return {"error": f"投稿の削除に失敗しました: {str(e)}"}
        
        # 違反ではないと判断された場合
        print("違反ではないと判断されました。投稿を保持します")
        return {
            "action": "kept",
            "reason": analysis.get("reason", "違反と判断されませんでした"),
            "confidence": analysis.get("confidence", 0)
        }
    
    async def review_reported_post_with_media(self, db: Session, post_id: int, reason: str) -> Dict:
        """メディアを含む通報された投稿を審査する"""
        print(f"メディアを含む投稿ID {post_id} の審査を開始します。理由: {reason}")
        post = db.query(Post).filter(Post.id == post_id).first()
        if not post:
            print("投稿が見つかりません")
            return {"error": "投稿が見つかりません"}
        
        # ユーザーの過去の履歴を取得
        print(f"ユーザーID {post.user_id} の履歴を取得します...")
        user_history = await self.get_user_history(db, post.user_id)
        
        # メディアパスとタイプを取得（仮定 - 実際の実装に合わせて調整）
        media_path = getattr(post, 'media_path', None)
        media_type = getattr(post, 'media_type', None)
        
        # AIでコンテンツを分析
        if media_path and media_type:
            print(f"メディアを含むコンテンツを分析します: {media_type}")
            analysis = await self.analyze_multimodal_content(
                content=post.content,
                media_path=media_path,
                media_type=media_type,
                reason=reason,
                user_history=user_history
            )
        else:
            print("テキストのみのコンテンツを分析します")
            analysis = await self.analyze_content(post.content, reason, user_history)
        
        # 違反と判断された場合
        if analysis.get("is_violation", False) and analysis.get("confidence", 0) > 0.7:
            print("違反コンテンツと判断されました。投稿を削除します...")
            try:
                offender = db.query(User).filter(User.id == post.user_id).first()
                if offender:
                    print(f"ユーザー {offender.id} にペナルティを適用します")
                    apply_penalty(
                        db,
                        offender,
                        "content_violation",
                        analysis.get("severity", "medium") or "medium",
                        metadata={
                            "post_id": post_id,
                            "reported_reason": reason,
                        },
                        override_reason=analysis.get("reason"),
                    )

                # 関連する通報レコードを先に削除
                from app.models import Report
                reports = db.query(Report).filter(Report.post_id == post_id).all()
                for report in reports:
                    db.delete(report)
                print(f"{len(reports)}件の関連通報レコードを削除しました")

                # 投稿を削除
                db.delete(post)
                print("現在の投稿を削除しました")
                
                # 過去の投稿もチェックして悪質なものがあれば削除
                await self.check_and_delete_user_past_posts(db, post.user_id, analysis.get("reason", "コミュニティガイドライン違反"))
                
                db.commit()
                print("投稿の削除が完了しました")
                
                return {
                    "action": "deleted",
                    "reason": analysis.get("reason", "コミュニティガイドライン違反"),
                    "confidence": analysis.get("confidence", 0),
                    "severity": analysis.get("severity", "medium")
                }
            except Exception as e:
                db.rollback()
                print(f"投稿の削除に失敗しました: {str(e)}")
                return {"error": f"投稿の削除に失敗しました: {str(e)}"}
        
        # 違反ではないと判断された場合
        print("違反ではないと判断されました。投稿を保持します")
        return {
            "action": "kept",
            "reason": analysis.get("reason", "違反と判断されませんでした"),
            "confidence": analysis.get("confidence", 0)
        }

    async def check_and_delete_user_past_posts(self, db: Session, user_id: str, violation_reason: str, limit: int = 20) -> None:
        """ユーザーの過去の投稿をチェックし、悪質なものがあれば削除する（非同期）"""
        print(f"ユーザーID {user_id} の過去の投稿を最大{limit}件チェックします...")
        
        # ユーザーの過去の投稿を取得
        past_posts = db.query(Post).filter(Post.user_id == user_id).order_by(Post.created_at.desc()).limit(limit).all()
        
        if not past_posts:
            print("過去の投稿がありません")
            return
        
        print(f"{len(past_posts)}件の過去の投稿を並列してチェックします...")
        
        # 非同期で各投稿を分析
        tasks = []
        for post in past_posts:
            task = self.analyze_content(post.content, "関連投稿の違反による確認", "")
            tasks.append((post, task))
        
        # 並列実行して結果を収集
        results = await asyncio.gather(*[task for _, task in tasks], return_exceptions=True)
        
        deleted_count = 0
        for i, (post, _) in enumerate(tasks):
            analysis_result = results[i]
            
            # 例外が発生した場合はスキップ
            if isinstance(analysis_result, Exception):
                print(f"投稿ID {post.id} の分析中にエラーが発生しました: {str(analysis_result)}")
                continue
            
            analysis = analysis_result
            
            # 違反と判断された場合（信頼度を少し下げて慎重に判断）
            if analysis.get("is_violation", False) and analysis.get("confidence", 0) > 0.8:
                print(f"投稿ID {post.id} も違反コンテンツと判断されました。削除します...")
                
                try:
                    # 関連する通報レコードを削除
                    from app.models import Report
                    reports = db.query(Report).filter(Report.post_id == post.id).all()
                    for report in reports:
                        db.delete(report)
                    
                    # 投稿を削除
                    db.delete(post)
                    deleted_count += 1
                    print(f"投稿ID {post.id} を削除しました")
                except Exception as e:
                    print(f"投稿ID {post.id} の削除に失敗しました: {str(e)}")
                    db.rollback()
        
        if deleted_count > 0:
            print(f"合計 {deleted_count} 件の過去の違反投稿を削除しました")
        else:
            print("削除すべき違反投稿はありませんでした")

    async def delete_all_user_posts_on_ban(self, db: Session, user_id: str) -> Dict:
        """ユーザーがbanされた場合に全投稿を削除する"""
        print(f"ユーザーID {user_id} の全投稿を削除します...")
        
        try:
            # ユーザーの全投稿を取得
            posts = db.query(Post).filter(Post.user_id == user_id).all()
            
            if not posts:
                print("削除する投稿がありません")
                return {"deleted_count": 0, "message": "削除する投稿がありませんでした"}
            
            deleted_count = len(posts)
            
            # 関連する通報レコードを削除
            from app.models import Report
            post_ids = [post.id for post in posts]
            reports = db.query(Report).filter(Report.post_id.in_(post_ids)).all()
            for report in reports:
                db.delete(report)
            
            # 関連するいいねレコードを削除
            from app.models import Like
            likes = db.query(Like).filter(Like.post_id.in_(post_ids)).all()
            for like in likes:
                db.delete(like)
            
            # 関連する返信レコードを削除
            from app.models import Reply
            replies = db.query(Reply).filter(Reply.post_id.in_(post_ids)).all()
            for reply in replies:
                db.delete(reply)
            
            # 投稿を削除
            for post in posts:
                db.delete(post)
            
            db.commit()
            
            print(f"ユーザーID {user_id} の全投稿 {deleted_count} 件を削除しました")
            return {
                "deleted_count": deleted_count,
                "message": f"全投稿 {deleted_count} 件を削除しました"
            }
            
        except Exception as e:
            db.rollback()
            error_msg = f"投稿の削除に失敗しました: {str(e)}"
            print(error_msg)
            return {"error": error_msg, "deleted_count": 0}

# グローバルインスタンス
content_moderator = ContentModerator()