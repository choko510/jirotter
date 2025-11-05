import pytest
import asyncio
from unittest.mock import Mock, patch, AsyncMock
from fastapi import HTTPException
from sqlalchemy.orm import Session
from app.routes.posts import create_post
from app.models import User, RamenShop
from app.utils.spam_detector import SpamCheckResult


@pytest.fixture
def mock_db():
    """モックデータベースセッション"""
    return Mock(spec=Session)


@pytest.fixture
def high_score_user():
    """高スコアサンプルユーザーデータ"""
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
def mock_shop():
    """モック店舗データ"""
    shop = Mock(spec=RamenShop)
    shop.id = 1
    shop.name = "テストラーメン店"
    shop.address = "テスト住所"
    return shop


@pytest.mark.asyncio
class TestPostsModeration:
    """投稿エンドポイントのモデレーション機能テスト"""

    @patch('app.routes.posts.schedule_post_moderation', new_callable=AsyncMock)
    @patch('app.routes.posts.spam_detector')
    @patch('app.routes.posts.award_points')
    @patch('app.routes.posts.ensure_user_can_contribute')
    @patch('app.routes.posts.rate_limiter.hit', new_callable=AsyncMock)
    @patch('app.routes.posts.validate_post_content')
    async def test_create_post_high_score_user_no_spam(
        self, 
        mock_validate, 
        mock_rate_limiter, 
        mock_ensure, 
        mock_award_points,
        mock_spam_detector,
        mock_schedule_moderation,
        mock_db, 
        high_score_user
    ):
        """高スコアユーザーの非スパム投稿はモデレーションされないことを確認"""
        # モックの設定
        mock_validate.return_value = ([], "正常な投稿内容")
        mock_spam_detector.evaluate_post.return_value = SpamCheckResult(is_spam=False, reasons=[])
        
        # モックDBの設定
        mock_post = Mock()
        mock_post.id = 1
        mock_post.is_shadow_banned = False
        mock_db.add.return_value = None
        mock_db.flush.return_value = None
        mock_db.commit.return_value = None
        mock_db.refresh.return_value = None
        
        with patch('app.routes.posts.Post', return_value=mock_post):
            # テスト実行
            result = await create_post(
                content="正常な投稿です",
                image=None,
                video=None,
                video_duration=None,
                shop_id=None,
                current_user=high_score_user,
                db=mock_db
            )
            
            # モデレーションがスケジュールされていないことを確認
            mock_schedule_moderation.assert_not_called()

    @patch('app.routes.posts.schedule_post_moderation', new_callable=AsyncMock)
    @patch('app.routes.posts.spam_detector')
    @patch('app.routes.posts.award_points')
    @patch('app.routes.posts.ensure_user_can_contribute')
    @patch('app.routes.posts.rate_limiter.hit', new_callable=AsyncMock)
    @patch('app.routes.posts.validate_post_content')
    async def test_create_post_low_score_user_no_spam(
        self,
        mock_validate,
        mock_rate_limiter,
        mock_ensure,
        mock_award_points,
        mock_spam_detector,
        mock_schedule_moderation,
        mock_db,
        low_score_user
    ):
        """低スコアユーザーの非スパム投稿はモデレーションされることを確認"""
        # モックの設定
        mock_validate.return_value = ([], "正常な投稿内容")
        mock_spam_detector.evaluate_post.return_value = SpamCheckResult(is_spam=False, reasons=[])
        
        # モックDBの設定
        mock_post = Mock()
        mock_post.id = 1
        mock_post.is_shadow_banned = False
        mock_db.add.return_value = None
        mock_db.flush.return_value = None
        mock_db.commit.return_value = None
        mock_db.refresh.return_value = None
        
        with patch('app.routes.posts.Post', return_value=mock_post):
            # テスト実行
            result = await create_post(
                content="正常な投稿です",
                image=None,
                video=None,
                video_duration=None,
                shop_id=None,
                current_user=low_score_user,
                db=mock_db
            )
            
            # モデレーションがスケジュールされたことを確認
            mock_schedule_moderation.assert_called_once_with(1, mock_db)

    @patch('app.routes.posts.schedule_post_moderation', new_callable=AsyncMock)
    @patch('app.routes.posts.spam_detector')
    @patch('app.routes.posts.award_points')
    @patch('app.routes.posts.ensure_user_can_contribute')
    @patch('app.routes.posts.rate_limiter.hit', new_callable=AsyncMock)
    @patch('app.routes.posts.validate_post_content')
    async def test_create_post_high_score_user_spam(
        self,
        mock_validate,
        mock_rate_limiter,
        mock_ensure,
        mock_award_points,
        mock_spam_detector,
        mock_schedule_moderation,
        mock_db,
        high_score_user
    ):
        """高スコアユーザーのスパム投稿はモデレーションされることを確認"""
        # モックの設定
        mock_validate.return_value = ([], "スパム投稿内容")
        mock_spam_detector.evaluate_post.return_value = SpamCheckResult(is_spam=True, reasons=["スパム検出"])
        
        # モックDBの設定
        mock_post = Mock()
        mock_post.id = 1
        mock_post.is_shadow_banned = True  # スパム判定
        mock_db.add.return_value = None
        mock_db.flush.return_value = None
        mock_db.commit.return_value = None
        mock_db.refresh.return_value = None
        
        with patch('app.routes.posts.Post', return_value=mock_post):
            # テスト実行
            result = await create_post(
                content="スパム投稿です",
                image=None,
                video=None,
                video_duration=None,
                shop_id=None,
                current_user=high_score_user,
                db=mock_db
            )
            
            # モデレーションがスケジュールされたことを確認
            mock_schedule_moderation.assert_called_once_with(1, mock_db)

    @patch('app.routes.posts.schedule_post_moderation', new_callable=AsyncMock)
    @patch('app.routes.posts.spam_detector')
    @patch('app.routes.posts.award_points')
    @patch('app.routes.posts.ensure_user_can_contribute')
    @patch('app.routes.posts.rate_limiter.hit', new_callable=AsyncMock)
    @patch('app.routes.posts.validate_post_content')
    async def test_create_post_low_score_user_spam(
        self,
        mock_validate,
        mock_rate_limiter,
        mock_ensure,
        mock_award_points,
        mock_spam_detector,
        mock_schedule_moderation,
        mock_db,
        low_score_user
    ):
        """低スコアユーザーのスパム投稿はモデレーションされることを確認"""
        # モックの設定
        mock_validate.return_value = ([], "スパム投稿内容")
        mock_spam_detector.evaluate_post.return_value = SpamCheckResult(is_spam=True, reasons=["スパム検出"])
        
        # モックDBの設定
        mock_post = Mock()
        mock_post.id = 1
        mock_post.is_shadow_banned = True  # スパム判定
        mock_db.add.return_value = None
        mock_db.flush.return_value = None
        mock_db.commit.return_value = None
        mock_db.refresh.return_value = None
        
        with patch('app.routes.posts.Post', return_value=mock_post):
            # テスト実行
            result = await create_post(
                content="スパム投稿です",
                image=None,
                video=None,
                video_duration=None,
                shop_id=None,
                current_user=low_score_user,
                db=mock_db
            )
            
            # モデレーションがスケジュールされたことを確認
            mock_schedule_moderation.assert_called_once_with(1, mock_db)


    @patch('app.routes.posts.schedule_post_moderation', new_callable=AsyncMock)
    @patch('app.routes.posts.spam_detector')
    @patch('app.routes.posts.award_points')
    @patch('app.routes.posts.ensure_user_can_contribute')
    @patch('app.routes.posts.rate_limiter.hit', new_callable=AsyncMock)
    @patch('app.routes.posts.validate_post_content')
    async def test_create_post_medium_spam_score(
        self,
        mock_validate,
        mock_rate_limiter,
        mock_ensure,
        mock_award_points,
        mock_spam_detector,
        mock_schedule_moderation,
        mock_db,
        high_score_user
    ):
        """中スパムスコアの投稿はモデレーションされることを確認"""
        # モックの設定
        mock_validate.return_value = ([], "少し怪しい投稿内容")
        mock_spam_detector.evaluate_post.return_value = SpamCheckResult(
            is_spam=False,
            reasons=["少し怪しい"],
            score=2.8  # 中スパムスコア
        )
        
        # モックDBの設定
        mock_post = Mock()
        mock_post.id = 1
        mock_post.is_shadow_banned = False
        mock_db.add.return_value = None
        mock_db.flush.return_value = None
        mock_db.commit.return_value = None
        mock_db.refresh.return_value = None
        
        with patch('app.routes.posts.Post', return_value=mock_post):
            # テスト実行
            result = await create_post(
                content="少し怪しい投稿です",
                image=None,
                video=None,
                video_duration=None,
                shop_id=None,
                current_user=high_score_user,
                db=mock_db
            )
            
            # モデレーションがスケジュールされたことを確認
            mock_schedule_moderation.assert_called_once_with(1, mock_db)

    @patch('app.routes.posts.schedule_post_moderation', new_callable=AsyncMock)
    @patch('app.routes.posts.spam_detector')
    @patch('app.routes.posts.award_points')
    @patch('app.routes.posts.ensure_user_can_contribute')
    @patch('app.routes.posts.rate_limiter.hit', new_callable=AsyncMock)
    @patch('app.routes.posts.validate_post_content')
    async def test_create_post_low_spam_score(
        self,
        mock_validate,
        mock_rate_limiter,
        mock_ensure,
        mock_award_points,
        mock_spam_detector,
        mock_schedule_moderation,
        mock_db,
        high_score_user
    ):
        """低スパムスコアの投稿はモデレーションされることを確認"""
        # モックの設定
        mock_validate.return_value = ([], "少し怪しいけど大丈夫そうな投稿内容")
        mock_spam_detector.evaluate_post.return_value = SpamCheckResult(
            is_spam=False,
            reasons=["少し怪しい"],
            score=1.8  # 低スパムスコア
        )
        
        # モックDBの設定
        mock_post = Mock()
        mock_post.id = 1
        mock_post.is_shadow_banned = False
        mock_db.add.return_value = None
        mock_db.flush.return_value = None
        mock_db.commit.return_value = None
        mock_db.refresh.return_value = None
        
        with patch('app.routes.posts.Post', return_value=mock_post):
            # テスト実行
            result = await create_post(
                content="少し怪しいけど大丈夫そうな投稿です",
                image=None,
                video=None,
                video_duration=None,
                shop_id=None,
                current_user=high_score_user,
                db=mock_db
            )
            
            # モデレーションがスケジュールされたことを確認
            mock_schedule_moderation.assert_called_once_with(1, mock_db)

    @patch('app.routes.posts.schedule_post_moderation', new_callable=AsyncMock)
    @patch('app.routes.posts.spam_detector')
    @patch('app.routes.posts.award_points')
    @patch('app.routes.posts.ensure_user_can_contribute')
    @patch('app.routes.posts.rate_limiter.hit', new_callable=AsyncMock)
    @patch('app.routes.posts.validate_post_content')
    async def test_create_post_no_moderation_low_score(
        self,
        mock_validate,
        mock_rate_limiter,
        mock_ensure,
        mock_award_points,
        mock_spam_detector,
        mock_schedule_moderation,
        mock_db,
        high_score_user
    ):
        """低スパムスコアの投稿はモデレーションされないことを確認"""
        # モックの設定
        mock_validate.return_value = ([], "正常な投稿内容")
        mock_spam_detector.evaluate_post.return_value = SpamCheckResult(
            is_spam=False,
            reasons=[],
            score=1.2  # モデレーション対象外のスコア
        )
        
        # モックDBの設定
        mock_post = Mock()
        mock_post.id = 1
        mock_post.is_shadow_banned = False
        mock_db.add.return_value = None
        mock_db.flush.return_value = None
        mock_db.commit.return_value = None
        mock_db.refresh.return_value = None
        
        with patch('app.routes.posts.Post', return_value=mock_post):
            # テスト実行
            result = await create_post(
                content="正常な投稿です",
                image=None,
                video=None,
                video_duration=None,
                shop_id=None,
                current_user=high_score_user,
                db=mock_db
            )
            
            # モデレーションがスケジュールされないことを確認
            mock_schedule_moderation.assert_not_called()


if __name__ == "__main__":
    pytest.main([__file__])