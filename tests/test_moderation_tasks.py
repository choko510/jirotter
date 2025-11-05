import pytest
import asyncio
from unittest.mock import Mock, patch, AsyncMock, MagicMock
from sqlalchemy.orm import Session, sessionmaker, joinedload
from app.utils.moderation_tasks import _moderate_post, schedule_post_moderation
from app.models import Post, Report, User

# Post.authorリレーションシップをモック
Post.author = Mock()


@pytest.fixture
def mock_db():
    """モックデータベースセッション"""
    return Mock(spec=Session)


@pytest.fixture
def mock_session_factory():
    """モックセッションファクトリ"""
    return Mock(spec=sessionmaker)


@pytest.fixture
def sample_user():
    """サンプルユーザーデータ"""
    user = Mock(spec=User)
    user.id = "user123"
    user.username = "testuser"
    user.internal_score = 80  # 高スコアユーザー
    return user


@pytest.fixture
def low_score_user():
    """低スコアサンプルユーザーデータ"""
    user = Mock(spec=User)
    user.id = "user456"
    user.username = "lowscoreuser"
    user.internal_score = 50  # 低スコアユーザー
    return user


@pytest.fixture
def sample_post():
    """サンプル投稿データ"""
    post = Mock(spec=Post)
    post.id = 1
    post.content = "これは正常な投稿です"
    post.user_id = "user123"
    post.is_shadow_banned = False
    post.spam_score = 0.0
    post.author = None  # author属性を初期化
    return post


@pytest.fixture
def spam_post():
    """スパム投稿データ"""
    post = Mock(spec=Post)
    post.id = 2
    post.content = "スパム投稿です"
    post.user_id = "user789"
    post.is_shadow_banned = True
    post.spam_score = 5.0
    post.author = None  # author属性を初期化
    return post


@pytest.mark.asyncio
class TestModerationTasks:
    """モデレーションタスクのテスト"""

    @patch('app.utils.moderation_tasks.content_moderator')
    @patch('app.utils.moderation_tasks.joinedload')
    async def test_moderate_normal_post_high_score_user(self, mock_joinedload, mock_moderator, mock_session_factory, sample_user, sample_post):
        """高スコアユーザーの正常投稿は審査されないことを確認"""
        # モックの設定
        mock_db = Mock(spec=Session)
        mock_session_factory.return_value = mock_db
        
        # 投稿のauthorを事前に設定
        sample_post.author = sample_user
        # joinedloadをモック
        mock_joinedload.return_value = MagicMock()
        mock_query = Mock()
        mock_query.options.return_value = mock_query
        mock_query.filter.return_value = mock_query
        mock_query.first.return_value = sample_post
        mock_db.query.return_value = mock_query
        
        # モデレーションは呼ばれないはず
        mock_moderator.get_user_history = AsyncMock(return_value="")
        mock_moderator.analyze_content = AsyncMock(return_value={"is_violation": False})
        
        # テスト実行
        await _moderate_post(1, mock_session_factory)
        
        # analyze_contentが呼ばれていないことを確認
        mock_moderator.analyze_content.assert_not_called()
        mock_db.commit.assert_not_called()

    @patch('app.utils.moderation_tasks.content_moderator')
    @patch('app.utils.moderation_tasks.joinedload')
    async def test_moderate_normal_post_low_score_user(self, mock_joinedload, mock_moderator, mock_session_factory, low_score_user, sample_post):
        """低スコアユーザーの正常投稿は審査されることを確認"""
        # モックの設定
        mock_db = Mock(spec=Session)
        mock_session_factory.return_value = mock_db
        
        # 投稿のauthorを事前に設定
        sample_post.author = low_score_user
        # joinedloadをモック
        mock_joinedload.return_value = MagicMock()
        mock_query = Mock()
        mock_query.options.return_value = mock_query
        mock_query.filter.return_value = mock_query
        mock_query.first.return_value = sample_post
        mock_db.query.return_value = mock_query
        
        # モデレーションのモック
        mock_moderator.get_user_history = AsyncMock(return_value="")
        mock_moderator.analyze_content = AsyncMock(return_value={"is_violation": False, "confidence": 0.1})
        
        # テスト実行
        await _moderate_post(1, mock_session_factory)
        
        # analyze_contentが呼ばれたことを確認
        mock_moderator.analyze_content.assert_called_once()
        mock_db.commit.assert_called_once()

    @patch('app.utils.moderation_tasks.content_moderator')
    @patch('app.utils.moderation_tasks.joinedload')
    async def test_moderate_spam_post_high_score_user(self, mock_joinedload, mock_moderator, mock_session_factory, sample_user, spam_post):
        """高スコアユーザーのスパム投稿は審査されることを確認"""
        # モックの設定
        mock_db = Mock(spec=Session)
        mock_session_factory.return_value = mock_db
        
        # 投稿のauthorを事前に設定
        spam_post.author = sample_user
        # joinedloadをモック
        mock_joinedload.return_value = MagicMock()
        mock_query = Mock()
        mock_query.options.return_value = mock_query
        mock_query.filter.return_value = mock_query
        mock_query.first.return_value = spam_post
        mock_db.query.return_value = mock_query
        
        # モデレーションのモック
        mock_moderator.get_user_history = AsyncMock(return_value="")
        mock_moderator.analyze_content = AsyncMock(return_value={"is_violation": False, "confidence": 0.1})
        
        # テスト実行
        await _moderate_post(2, mock_session_factory)
        
        # analyze_contentが呼ばれたことを確認
        mock_moderator.analyze_content.assert_called_once()
        mock_db.commit.assert_called_once()

    @patch('app.utils.moderation_tasks.content_moderator')
    @patch('app.utils.moderation_tasks.joinedload')
    async def test_moderate_violation_post_creates_report(self, mock_joinedload, mock_moderator, mock_session_factory, low_score_user, sample_post):
        """違反投稿が通報レコードを作成することを確認"""
        # モックの設定
        mock_db = Mock(spec=Session)
        mock_session_factory.return_value = mock_db
        
        # 投稿のauthorを事前に設定
        sample_post.author = low_score_user
        # joinedloadをモック
        mock_joinedload.return_value = MagicMock()
        mock_query = Mock()
        mock_query.options.return_value = mock_query
        mock_query.filter.return_value = mock_query
        mock_query.first.return_value = sample_post
        mock_db.query.return_value = mock_query
        
        # 違反コンテンツのモック
        mock_moderator.get_user_history = AsyncMock(return_value="")
        mock_moderator.analyze_content = AsyncMock(return_value={
            "is_violation": True,
            "confidence": 0.8,
            "reason": "不適切なコンテンツ"
        })
        
        # テスト実行
        await _moderate_post(1, mock_session_factory)
        
        # analyze_contentが呼ばれ、通報レコードが作成されたことを確認
        mock_moderator.analyze_content.assert_called_once()
        mock_db.add.assert_called()
        mock_db.commit.assert_called()
        
        # 追加されたオブジェクトがReportであることを確認
        added_object = mock_db.add.call_args[0][0]
        assert hasattr(added_object, 'post_id')
        assert hasattr(added_object, 'reporter_id')
        assert hasattr(added_object, 'reason')

    @patch('app.utils.moderation_tasks.content_moderator')
    @patch('app.utils.moderation_tasks.joinedload')
    async def test_moderate_post_not_found(self, mock_joinedload, mock_moderator, mock_session_factory):
        """投稿が見つからない場合のテスト"""
        # モックの設定
        mock_db = Mock(spec=Session)
        mock_session_factory.return_value = mock_db
        
        # joinedloadをモック
        mock_joinedload.return_value = MagicMock()
        mock_query = Mock()
        mock_query.options.return_value = mock_query
        mock_query.filter.return_value = mock_query
        mock_query.first.return_value = None
        mock_db.query.return_value = mock_query
        
        # モデレーションは呼ばれないはず
        mock_moderator.get_user_history = AsyncMock(return_value="")
        mock_moderator.analyze_content = AsyncMock(return_value={"is_violation": False})
        
        # テスト実行
        await _moderate_post(999, mock_session_factory)
        
        # analyze_contentが呼ばれていないことを確認
        mock_moderator.analyze_content.assert_not_called()
        mock_db.commit.assert_not_called()

    @patch('app.utils.moderation_tasks.asyncio.create_task')
    def test_schedule_post_moderation(self, mock_create_task, mock_db):
        """モデレーションスケジューリングのテスト"""
        # モックの設定
        mock_db.get_bind.return_value = Mock()
        
        # テスト実行
        asyncio.run(schedule_post_moderation(1, mock_db))
        
        # create_taskが呼ばれたことを確認
        mock_create_task.assert_called_once()

    @patch('app.utils.moderation_tasks.content_moderator')
    @patch('app.utils.moderation_tasks.joinedload')
    async def test_moderate_low_spam_score_post(self, mock_joinedload, mock_moderator, mock_session_factory, sample_user, sample_post):
        """低スパムスコアの投稿は低優先度審査されることを確認"""
        # モックの設定
        mock_db = Mock(spec=Session)
        mock_session_factory.return_value = mock_db
        
        # 投稿のauthorとspam_scoreを事前に設定
        sample_post.author = sample_user
        sample_post.spam_score = 1.8  # 低スパムスコア
        # joinedloadをモック
        mock_joinedload.return_value = MagicMock()
        mock_query = Mock()
        mock_query.options.return_value = mock_query
        mock_query.filter.return_value = mock_query
        mock_query.first.return_value = sample_post
        mock_db.query.return_value = mock_query
        
        # モデレーションのモック
        mock_moderator.get_user_history = AsyncMock(return_value="")
        mock_moderator.analyze_content = AsyncMock(return_value={"is_violation": False, "confidence": 0.1})
        
        # テスト実行
        await _moderate_post(1, mock_session_factory)
        
        # analyze_contentが呼ばれたことを確認
        mock_moderator.analyze_content.assert_called_once()
        mock_db.commit.assert_called_once()

    @patch('app.utils.moderation_tasks.content_moderator')
    @patch('app.utils.moderation_tasks.joinedload')
    async def test_moderate_medium_spam_score_post(self, mock_joinedload, mock_moderator, mock_session_factory, sample_user, sample_post):
        """中スパムスコアの投稿は中優先度審査されることを確認"""
        # モックの設定
        mock_db = Mock(spec=Session)
        mock_session_factory.return_value = mock_db
        
        # 投稿のauthorとspam_scoreを事前に設定
        sample_post.author = sample_user
        sample_post.spam_score = 2.8  # 中スパムスコア
        # joinedloadをモック
        mock_joinedload.return_value = MagicMock()
        mock_query = Mock()
        mock_query.options.return_value = mock_query
        mock_query.filter.return_value = mock_query
        mock_query.first.return_value = sample_post
        mock_db.query.return_value = mock_query
        
        # モデレーションのモック
        mock_moderator.get_user_history = AsyncMock(return_value="")
        mock_moderator.analyze_content = AsyncMock(return_value={"is_violation": False, "confidence": 0.1})
        
        # テスト実行
        await _moderate_post(1, mock_session_factory)
        
        # analyze_contentが呼ばれたことを確認
        mock_moderator.analyze_content.assert_called_once()
        mock_db.commit.assert_called_once()

    @patch('app.utils.moderation_tasks.content_moderator')
    @patch('app.utils.moderation_tasks.joinedload')
    async def test_moderate_high_spam_score_post(self, mock_joinedload, mock_moderator, mock_session_factory, sample_user, sample_post):
        """高スパムスコアの投稿は高優先度審査されることを確認"""
        # モックの設定
        mock_db = Mock(spec=Session)
        mock_session_factory.return_value = mock_db
        
        # 投稿のauthorとspam_scoreを事前に設定
        sample_post.author = sample_user
        sample_post.spam_score = 3.8  # 高スパムスコア
        # joinedloadをモック
        mock_joinedload.return_value = MagicMock()
        mock_query = Mock()
        mock_query.options.return_value = mock_query
        mock_query.filter.return_value = mock_query
        mock_query.first.return_value = sample_post
        mock_db.query.return_value = mock_query
        
        # モデレーションのモック
        mock_moderator.get_user_history = AsyncMock(return_value="")
        mock_moderator.analyze_content = AsyncMock(return_value={"is_violation": False, "confidence": 0.1})
        
        # テスト実行
        await _moderate_post(1, mock_session_factory)
        
        # analyze_contentが呼ばれたことを確認
        mock_moderator.analyze_content.assert_called_once()
        mock_db.commit.assert_called_once()

    @patch('app.utils.moderation_tasks.content_moderator')
    @patch('app.utils.moderation_tasks.apply_penalty')
    @patch('app.utils.moderation_tasks.joinedload')
    async def test_moderate_violation_post_deletes_post(self, mock_joinedload, mock_apply_penalty, mock_moderator, mock_session_factory, low_score_user, sample_post):
        """違反投稿が削除されることを確認"""
        # モックの設定
        mock_db = Mock(spec=Session)
        mock_session_factory.return_value = mock_db
        
        # 投稿のauthorを事前に設定
        sample_post.author = low_score_user
        # joinedloadをモック
        mock_joinedload.return_value = MagicMock()
        mock_query = Mock()
        mock_query.options.return_value = mock_query
        mock_query.filter.return_value = mock_query
        mock_query.first.return_value = sample_post
        mock_db.query.return_value = mock_query
        
        # 違反コンテンツのモック
        mock_moderator.get_user_history = AsyncMock(return_value="")
        mock_moderator.analyze_content = AsyncMock(return_value={
            "is_violation": True,
            "confidence": 0.8,
            "reason": "不適切なコンテンツ",
            "severity": "high"
        })
        
        # 関連する通報レコードのモック
        mock_reports = [Mock(), Mock()]
        mock_db.query.return_value.filter.return_value.all.return_value = mock_reports
        
        # テスト実行
        await _moderate_post(1, mock_session_factory)
        
        # analyze_contentが呼ばれたことを確認
        mock_moderator.analyze_content.assert_called_once()
        
        # ペナルティが適用されたことを確認
        mock_apply_penalty.assert_called_once()
        
        # 通報レコードが削除されたことを確認
        assert mock_db.delete.call_count >= 2  # 投稿 + 通報レコード
        
        # コミットが呼ばれたことを確認
        mock_db.commit.assert_called()
        
        # 投稿が削除されたことを確認
        delete_calls = [call for call in mock_db.delete.call_args_list if call[0][0] == sample_post]
        assert len(delete_calls) == 1


if __name__ == "__main__":
    pytest.main([__file__])