import pytest
import asyncio
from unittest.mock import Mock, patch, MagicMock, AsyncMock, mock_open
from sqlalchemy.orm import Session
from app.utils.content_moderator import ContentModerator, ContentAnalysisResult
from app.models import Post, Report, User

@pytest.fixture
def mock_db():
    """モックデータベースセッション"""
    return Mock(spec=Session)

@pytest.fixture
def mock_client_class():
    """genai.Clientのモッククラス"""
    with patch('app.utils.content_moderator.genai.Client') as mock:
        yield mock

@pytest.fixture
def mock_moderator(mock_client_class):
    """モックContentModeratorインスタンス"""
    with patch.dict('os.environ', {'GOOGLE_API_KEY': 'test-api-key'}):
        moderator = ContentModerator()
        # Ensure client is the mock
        moderator.client = mock_client_class.return_value
        return moderator

@pytest.fixture
def sample_post():
    """サンプル投稿データ"""
    post = Mock(spec=Post)
    post.id = 1
    post.content = "これはテスト投稿です"
    post.user_id = "user123"
    return post

@pytest.fixture
def sample_user():
    """サンプルユーザーデータ"""
    user = Mock(spec=User)
    user.id = "user123"
    user.username = "testuser"
    return user

@pytest.fixture
def sample_report():
    """サンプル通報データ"""
    report = Mock(spec=Report)
    report.reason = "不適切なコンテンツ"
    return report

class TestContentModerator:
    """ContentModeratorクラスのテスト"""
    
    def test_init_with_api_key(self):
        """APIキーがある場合の初期化テスト"""
        with patch.dict('os.environ', {'GOOGLE_API_KEY': 'test-api-key'}):
            moderator = ContentModerator()
            assert moderator.api_key == "test-api-key"
            assert moderator.client is not None
    
    def test_init_without_api_key(self):
        """APIキーがない場合の初期化テスト"""
        with patch.dict('os.environ', {}, clear=True):
            moderator = ContentModerator()
            assert moderator.api_key is None
            assert moderator.client is None
    
    async def test_analyze_content_with_api_key(self, mock_moderator):
        """APIキーがある場合のコンテンツ分析テスト"""
        # モックレスポンスの設定
        analysis_result = ContentAnalysisResult(is_violation=False, confidence=0.1, reason="問題なし", severity="low")
        mock_response = Mock()
        mock_response.text = analysis_result.model_dump_json()

        # AsyncMock for the async method call
        mock_moderator.client.aio.models.generate_content = AsyncMock(return_value=mock_response)
        
        # テスト実行
        result = await mock_moderator.analyze_content("テストコンテンツ", "テスト理由", "テスト履歴")
        
        # 結果の検証
        assert result["is_violation"] is False
        assert result["confidence"] == 0.1
        assert result["reason"] == "問題なし"
        assert result["severity"] == "low"
    
    async def test_analyze_content_without_api_key(self, mock_moderator):
        """APIキーがない場合のコンテンツ分析テスト"""
        mock_moderator.api_key = None
        mock_moderator.client = None
        
        result = await mock_moderator.analyze_content("テストコンテンツ")
        
        assert result["is_violation"] is False
        assert result["confidence"] == 0.0
        assert "APIキーが設定されていません" in result["reason"]
    
    async def test_analyze_content_with_exception(self, mock_moderator):
        """API呼び出しで例外が発生した場合のテスト"""
        mock_moderator.client.aio.models.generate_content = AsyncMock(side_effect=Exception("テスト例外"))
        
        result = await mock_moderator.analyze_content("テストコンテンツ")
        
        assert result["is_violation"] is False
        assert result["confidence"] == 0.0
        assert "AI分析中にエラーが発生しました" in result["reason"]
    
    async def test_analyze_multimodal_content_with_image(self, mock_moderator):
        """画像を含むマルチモーダルコンテンツ分析テスト"""
        # モックレスポンスの設定
        analysis_result = ContentAnalysisResult(is_violation=False, confidence=0.1, reason="問題なし", severity="low")
        mock_response = Mock()
        mock_response.text = analysis_result.model_dump_json()
        
        mock_moderator.client.aio.models.generate_content = AsyncMock(return_value=mock_response)

        # Mock open to avoid FileNotFoundError and handle file reading
        with patch("builtins.open", mock_open(read_data=b"image data")):
            # Also patch genai.types.Part.from_bytes because it might be used
            with patch("app.utils.content_moderator.genai.types.Part.from_bytes") as mock_from_bytes:
                # テスト実行
                result = await mock_moderator.analyze_multimodal_content(
                    content="テストコンテンツ",
                    media_path="/path/to/image.jpg",
                    media_type="image/jpeg",
                    reason="テスト理由",
                    user_history="テスト履歴"
                )
            
                # 結果の検証
                assert result["is_violation"] is False
                assert result["confidence"] == 0.1
                assert result["reason"] == "問題なし"
                assert result["severity"] == "low"
    
    async def test_analyze_content_with_thinking(self, mock_moderator):
        """思考機能を使用したコンテンツ分析テスト"""
        # モックレスポンスの設定
        analysis_result = ContentAnalysisResult(is_violation=False, confidence=0.1, reason="問題なし", severity="low")
        mock_response = Mock()
        mock_response.text = analysis_result.model_dump_json()

        mock_moderator.client.aio.models.generate_content = AsyncMock(return_value=mock_response)
        
        # テスト実行
        result = await mock_moderator.analyze_content_with_thinking(
            "テストコンテンツ", 
            "テスト理由", 
            "テスト履歴"
        )
        
        # 結果の検証
        assert result["is_violation"] is False
        assert result["confidence"] == 0.1
        assert result["reason"] == "問題なし"
        assert result["severity"] == "low"
        
        # 思考設定が正しく渡されていることを確認
        args, kwargs = mock_moderator.client.aio.models.generate_content.call_args
        config = kwargs.get('config')
        assert config is not None
        assert hasattr(config, 'thinking_config')
    
    async def test_get_user_history(self, mock_moderator, mock_db, sample_post, sample_report):
        """ユーザー履歴取得テスト"""
        # モッククエリの設定
        mock_db.query.return_value.filter.return_value.order_by.return_value.limit.return_value.all.return_value = [sample_post]
        mock_db.query.return_value.join.return_value.filter.return_value.all.return_value = [sample_report]

        # テスト実行
        history = await mock_moderator.get_user_history(mock_db, "user123")
        
        # 結果の検証
        assert "ユーザーの過去の投稿" in history
        assert "通報されています" in history
    
    @patch('app.utils.content_moderator.apply_penalty')
    async def test_review_reported_post_violation(self, mock_apply_penalty, mock_moderator, mock_db, sample_post, sample_user):
        """違反投稿の審査テスト"""
        # モックレスポンスの設定
        analysis_result = ContentAnalysisResult(is_violation=True, confidence=0.9, reason="違反コンテンツ", severity="high")
        mock_response = Mock()
        mock_response.text = analysis_result.model_dump_json()

        mock_moderator.client.aio.models.generate_content = AsyncMock(return_value=mock_response)
        
        # モッククエリの設定
        # 1. Post取得 (filter(id==...).first())
        # 2. User取得 (filter(id==...).first()) - offender
        mock_db.query.return_value.filter.return_value.first.side_effect = [sample_post, sample_user]

        # 3. get_user_history (query(Post)...all(), query(Report)...all())
        # 4. 関連レポート削除 (query(Report).filter(post_id==...).all())

        # ここで query(...).filter(...) の戻り値を構成する
        mock_query = mock_db.query.return_value
        mock_filter = mock_query.filter.return_value

        # all() の戻り値を制御するのは難しいので、汎用的に空リストを返すように設定しつつ、必要な箇所でサイドエフェクトを使うか、
        # もっと詳細にモックチェーンを組む。
        # 単純化: all() は常に空リストを返すが、side_effectで制御する

        # get_user_history uses:
        # db.query(Post).filter(...).order_by(...).limit(...).all()
        # db.query(Report).join(...).filter(...).all()

        # review_reported_post uses:
        # db.query(Post).filter(...).first() -> covered by above side_effect [sample_post]
        # db.query(User).filter(...).first() -> covered by above side_effect [sample_user]
        # db.query(Report).filter(...).all() -> for deletion

        # chainが複雑なので、個別に設定する

        # filter()の戻り値オブジェクトを共通化
        mock_filter_obj = Mock()
        mock_db.query.return_value.filter.return_value = mock_filter_obj
        mock_db.query.return_value.join.return_value.filter.return_value = mock_filter_obj

        # first() は上で設定した side_effect [sample_post, sample_user] を使う
        mock_filter_obj.first.side_effect = [sample_post, sample_user]

        # all() は空リスト（レポート削除用など）
        mock_filter_obj.all.return_value = []
        mock_filter_obj.order_by.return_value.limit.return_value.all.return_value = []
        
        # テスト実行
        result = await mock_moderator.review_reported_post(mock_db, 1, "テスト理由")
        
        # 結果の検証
        assert result["action"] == "deleted"
        assert result["reason"] == "違反コンテンツ"
        assert result["confidence"] == 0.9
        assert result["severity"] == "high"
        
        # ペナルティ適用が呼ばれたことを確認
        mock_apply_penalty.assert_called_once()
    
    async def test_review_reported_post_no_violation(self, mock_moderator, mock_db, sample_post):
        """非違反投稿の審査テスト"""
        # モックレスポンスの設定
        analysis_result = ContentAnalysisResult(is_violation=False, confidence=0.1, reason="問題なし", severity="low")
        mock_response = Mock()
        mock_response.text = analysis_result.model_dump_json()

        mock_moderator.client.aio.models.generate_content = AsyncMock(return_value=mock_response)
        
        # モッククエリの設定
        mock_filter_obj = Mock()
        mock_db.query.return_value.filter.return_value = mock_filter_obj
        mock_db.query.return_value.join.return_value.filter.return_value = mock_filter_obj

        mock_filter_obj.first.return_value = sample_post
        mock_filter_obj.all.return_value = []
        mock_filter_obj.order_by.return_value.limit.return_value.all.return_value = []
        
        # テスト実行
        result = await mock_moderator.review_reported_post(mock_db, 1, "テスト理由")
        
        # 結果の検証
        assert result["action"] == "kept"
        assert result["reason"] == "問題なし"
        assert result["confidence"] == 0.1
    
    async def test_review_reported_post_not_found(self, mock_moderator, mock_db):
        """投稿が見つからない場合のテスト"""
        # モッククエリの設定
        mock_db.query.return_value.filter.return_value.first.return_value = None
        
        # テスト実行
        result = await mock_moderator.review_reported_post(mock_db, 999, "テスト理由")
        
        # 結果の検証
        assert "error" in result
        assert "投稿が見つかりません" in result["error"]
    
    @patch('app.utils.content_moderator.apply_penalty')
    async def test_review_reported_post_with_media(self, mock_apply_penalty, mock_moderator, mock_db):
        """メディアを含む投稿の審査テスト"""
        # モックレスポンスの設定
        analysis_result = ContentAnalysisResult(is_violation=True, confidence=0.9, reason="違反コンテンツ", severity="high")
        mock_response = Mock()
        mock_response.text = analysis_result.model_dump_json()

        mock_moderator.client.aio.models.generate_content = AsyncMock(return_value=mock_response)
        
        # サンプル投稿にメディア属性を追加
        sample_post = Mock(spec=Post)
        sample_post.id = 1
        sample_post.content = "これはテスト投稿です"
        sample_post.user_id = "user123"
        sample_post.media_path = "/path/to/image.jpg"
        sample_post.media_type = "image/jpeg"
        
        # サンプルユーザー
        sample_user = Mock(spec=User)
        sample_user.id = "user123"
        
        # モッククエリの設定
        mock_filter_obj = Mock()
        mock_db.query.return_value.filter.return_value = mock_filter_obj
        mock_db.query.return_value.join.return_value.filter.return_value = mock_filter_obj
        
        # first() returns [post, user]
        mock_filter_obj.first.side_effect = [sample_post, sample_user]
        mock_filter_obj.all.return_value = []
        mock_filter_obj.order_by.return_value.limit.return_value.all.return_value = []

        # Mock open and genai parts
        with patch("builtins.open", mock_open(read_data=b"image data")):
             with patch("google.genai.types.Part.from_bytes"):
                # テスト実行
                result = await mock_moderator.review_reported_post_with_media(mock_db, 1, "テスト理由")
            
                # 結果の検証
                assert result["action"] == "deleted"
                assert result["reason"] == "違反コンテンツ"
                assert result["confidence"] == 0.9
                assert result["severity"] == "high"

class TestContentAnalysisResult:
    """ContentAnalysisResultモデルのテスト"""
    
    def test_valid_model(self):
        """有効なモデルのテスト"""
        result = ContentAnalysisResult(
            is_violation=True,
            confidence=0.8,
            reason="違反コンテンツ",
            severity="high"
        )
        
        assert result.is_violation is True
        assert result.confidence == 0.8
        assert result.reason == "違反コンテンツ"
        assert result.severity == "high"
    
    def test_model_serialization(self):
        """モデルシリアライゼーションのテスト"""
        result = ContentAnalysisResult(
            is_violation=False,
            confidence=0.2,
            reason="問題なし",
            severity="low"
        )
        
        # モデルを辞書に変換
        result_dict = result.model_dump()
        
        assert result_dict["is_violation"] is False
        assert result_dict["confidence"] == 0.2
        assert result_dict["reason"] == "問題なし"
        assert result_dict["severity"] == "low"

if __name__ == "__main__":
    pytest.main([__file__])