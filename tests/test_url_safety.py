import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
from app.routes.url_safety import router, url_blocklist_manager
from app.utils.url_safety import URLSafetyResponse

# テスト用のFastAPIアプリを作成
from fastapi import FastAPI
app = FastAPI()
app.include_router(router)

client = TestClient(app)

class TestURLSafetyAPI:
    """URL安全性チェックAPIのテスト"""

    @patch.object(url_blocklist_manager, 'ensure_loaded')
    @patch.object(url_blocklist_manager, 'check_url')
    def test_check_url_safety_safe(self, mock_check_url, mock_ensure_loaded):
        """安全なURLのテスト"""
        # モックの設定
        mock_ensure_loaded.return_value = None
        mock_check_url.return_value = URLSafetyResponse(
            safe=True, 
            reason="clean",
            matched_domain=None,
            source=None
        )

        # テスト実行
        response = client.post('/api/url-safety-check', json={'url': 'https://example.com'})
        
        # 検証
        assert response.status_code == 200
        assert response.json() == {
            'safe': True,
            'reason': 'clean',
            'matched_domain': None,
            'source': None
        }

    @patch.object(url_blocklist_manager, 'ensure_loaded')
    @patch.object(url_blocklist_manager, 'check_url')
    def test_check_url_safety_unsafe(self, mock_check_url, mock_ensure_loaded):
        """危険なURLのテスト"""
        # モックの設定
        mock_ensure_loaded.return_value = None
        mock_check_url.return_value = URLSafetyResponse(
            safe=False, 
            reason="matched",
            matched_domain="malicious.com",
            source="phishing"
        )

        # テスト実行
        response = client.post('/api/url-safety-check', json={'url': 'https://malicious.com'})
        
        # 検証
        assert response.status_code == 200
        assert response.json() == {
            'safe': False,
            'reason': 'matched',
            'matched_domain': 'malicious.com',
            'source': 'phishing'
        }

    @patch.object(url_blocklist_manager, 'ensure_loaded')
    def test_check_url_safety_error(self, mock_ensure_loaded):
        """エラー発生時のテスト"""
        # モックの設定（例外を発生させる）
        mock_ensure_loaded.side_effect = Exception("Test error")

        # テスト実行
        response = client.post('/api/url-safety-check', json={'url': 'https://example.com'})
        
        # 検証
        assert response.status_code == 500
        assert "URL安全性チェック中にエラーが発生しました" in response.json()['detail']

    def test_check_url_safety_invalid_url(self):
        """無効なURLのテスト"""
        response = client.post('/api/url-safety-check', json={'url': 'invalid-url'})
        assert response.status_code == 200  # 無効なURLでも200を返す（safe=Falseになる）

    @patch.object(url_blocklist_manager, 'ensure_loaded')
    def test_get_blocklist_status(self, mock_ensure_loaded):
        """ブロックリストステータスのテスト"""
        # モックの設定
        mock_ensure_loaded.return_value = None
        
        # テスト実行
        response = client.get('/api/url-safety-check/status')
        
        # 検証
        assert response.status_code == 200
        data = response.json()
        assert 'loaded' in data
        assert 'expire_at' in data
        assert 'phishing_domains' in data
        assert 'urlhaus_domains' in data
        assert 'total_domains' in data

class TestSpamDetectorIntegration:
    """SpamDetectorとの統合テスト"""

    def test_spam_detector_imports_url_safety(self):
        """SpamDetectorがURLBlocklistManagerを正しくインポートしているかのテスト"""
        from app.utils.spam_detector import SpamDetector
        detector = SpamDetector()
        
        # URLBlocklistManagerがインスタンス化されていることを確認
        assert hasattr(detector, 'url_blocklist_manager')
        assert detector.url_blocklist_manager is not None

    @patch('app.utils.spam_detector.URLBlocklistManager.check_url')
    def test_spam_detector_uses_url_safety(self, mock_check_url):
        """SpamDetectorがURL安全性チェックを使用するかのテスト"""
        from app.utils.spam_detector import SpamDetector
        from app.utils.url_safety import URLSafetyResponse
        
        # モックの設定
        mock_check_url.return_value = URLSafetyResponse(
            safe=False, 
            reason="matched",
            matched_domain="malicious.com",
            source="phishing"
        )

        detector = SpamDetector()
        text_with_url = "Check this out: https://malicious.com"
        
        # _check_linksメソッドを呼び出し
        reasons = []
        score = detector._check_links(text_with_url, reasons)
        
        # 検証
        assert mock_check_url.called
        # メッセージにはドメインが含まれる場合があるため、部分一致で確認するか、期待値を調整
        # assert 'ブロックリストに登録された危険なリンクが含まれています' in ['ブロックリストに登録された危険なリンクが含まれています: malicious.com', 'URLを難読化した表現が含まれています']
        # The failure was: assert '...' in ['...: malicious.com', ...]
        found = any("ブロックリストに登録された危険なリンクが含まれています" in r for r in reasons)
        assert found, f"Expected warning not found in reasons: {reasons}"
        assert score >= 5.0  # ブロックリストマッチは高スコア

class TestURLBlocklistManager:
    """URLBlocklistManagerの単体テスト"""

    def test_extract_domain(self):
        """ドメイン抽出機能のテスト"""
        from app.utils.url_safety import URLBlocklistManager
        
        manager = URLBlocklistManager()
        
        test_cases = [
            ('https://example.com/path', 'example.com'),
            ('http://sub.example.com', 'sub.example.com'),
            ('https://example.com:8080', 'example.com'),
            ('invalid-url', None),
            ('', None),
        ]
        
        for url, expected in test_cases:
            result = manager.extract_domain(url)
            assert result == expected, f"Failed for {url}: expected {expected}, got {result}"

    @patch('app.utils.url_safety.httpx.AsyncClient')
    async def test_download_list(self, mock_client_class):
        """リストダウンロード機能のテスト"""
        from app.utils.url_safety import URLBlocklistManager
        
        # モックの設定
        mock_client = MagicMock()
        mock_client_class.return_value.__aenter__.return_value = mock_client
        
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.text = """
        # コメント行
        example.com
        malicious.com
        127.0.0.1 bad-site.com
        ! 別のコメント
        """

        # AsyncMockを使ってawaitに対応
        async def mock_get(*args, **kwargs):
            return mock_response

        mock_client.get = MagicMock(side_effect=mock_get)
        
        manager = URLBlocklistManager()
        result = await manager._download_list(mock_client, 'https://test-list.com')
        
        # 検証
        assert 'example.com' in result
        assert 'malicious.com' in result
        assert 'bad-site.com' in result
        assert len(result) == 3

if __name__ == '__main__':
    pytest.main([__file__, '-v'])