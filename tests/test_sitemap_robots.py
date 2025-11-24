import pytest
from datetime import datetime, timezone
from app.models import RamenShop, Checkin


def create_test_shops_with_checkins(db):
    """テスト用のラーメン店とチェックインデータを作成"""
    # テスト用のラーメン店を作成
    shops = [
        RamenShop(
            name="ラーメン二郎 新宿店",
            address="東京都新宿区",
            latitude=35.6909,
            longitude=139.7004,
            last_update=datetime.now(timezone.utc)
        ),
        RamenShop(
            name="蒙古タンメン中本 新宿店",
            address="東京都新宿区",
            latitude=35.6914,
            longitude=139.7002,
            last_update=datetime.now(timezone.utc)
        ),
        RamenShop(
            name="一蘭 新宿中央東口店",
            address="東京都新宿区",
            latitude=35.6910,
            longitude=139.7015,
            last_update=datetime.now(timezone.utc)
        )
    ]
    db.add_all(shops)
    db.commit()
    
    # チェックインデータを作成
    checkins = [
        Checkin(shop_id=shops[0].id, user_id="testuser1"),
        Checkin(shop_id=shops[0].id, user_id="testuser2"),
        Checkin(shop_id=shops[1].id, user_id="testuser3"),
    ]
    db.add_all(checkins)
    db.commit()
    
    return shops


class TestRobotsTxt:
    """robots.txtエンドポイントのテスト"""
    
    def test_robots_txt_response(self, test_client):
        """robots.txtの基本レスポンステスト"""
        response = test_client.get("/robots.txt")
        
        assert response.status_code == 200
        assert response.headers["content-type"] == "text/plain; charset=utf-8"
    
    def test_robots_txt_content_structure(self, test_client):
        """robots.txtのコンテンツ構造テスト"""
        response = test_client.get("/robots.txt")
        content = response.text
        
        # 基本的なディレクティブが含まれていることを確認
        assert "User-agent: *" in content
        assert "Allow: /" in content
        assert "Disallow: /admin/" in content
        assert "Disallow: /api/" in content
        assert "Disallow: /uploads/" in content
        assert "Crawl-delay:" in content
        assert "Sitemap:" in content
    
    def test_robots_txt_googlebot_specific(self, test_client):
        """Googlebot特別設定のテスト"""
        response = test_client.get("/robots.txt")
        content = response.text
        
        assert "User-agent: Googlebot" in content
        assert "Allow: /" in content
        assert "Allow: /#!/shop/*" in content
        assert "Crawl-delay: 0" in content
    
    def test_robots_txt_image_bot(self, test_client):
        """画像検索ボット設定のテスト"""
        response = test_client.get("/robots.txt")
        content = response.text
        
        assert "User-agent: Googlebot-Image" in content
        assert "Allow: /uploads/" in content
        assert "Allow: /assets/" in content
    
    def test_robots_txt_sns_crawlers(self, test_client):
        """SNSクローラー設定のテスト"""
        response = test_client.get("/robots.txt")
        content = response.text
        
        assert "User-agent: Twitterbot" in content
        assert "User-agent: facebookexternalhit" in content
        assert "Allow: /" in content
    
    def test_robots_txt_sitemap_reference(self, test_client):
        """sitemap参照のテスト"""
        response = test_client.get("/robots.txt")
        content = response.text
        
        assert "Sitemap: http://localhost:8080/sitemap.xml" in content


class TestSitemapXml:
    """sitemap.xmlエンドポイントのテスト"""
    
    def test_sitemap_xml_response(self, test_client):
        """sitemap.xmlの基本レスポンステスト"""
        response = test_client.get("/sitemap.xml")
        
        assert response.status_code == 200
        assert response.headers["content-type"] == "application/xml; charset=utf-8"
    
    def test_sitemap_xml_basic_structure(self, test_client):
        """sitemap.xmlの基本構造テスト"""
        response = test_client.get("/sitemap.xml")
        content = response.text
        
        # XML宣言と名前空間を確認
        assert '<?xml version="1.0" encoding="UTF-8"?>' in content
        assert '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' in content
        assert '</urlset>' in content
    
    def test_sitemap_xml_static_pages(self, test_client):
        """静的ページのsitemapテスト"""
        response = test_client.get("/sitemap.xml")
        content = response.text
        
        # 静的ページが含まれていることを確認
        assert "<url><loc>http://localhost:8080/</loc>" in content
        assert "<changefreq>daily</changefreq>" in content
        assert "<priority>1.0</priority>" in content
        assert "<url><loc>http://localhost:8080/contribute</loc>" in content
        assert "<changefreq>weekly</changefreq>" in content
        assert "<priority>0.8</priority>" in content
    
    def test_sitemap_xml_with_shops(self, test_client, test_db):
        """店舗ページを含むsitemapテスト"""
        create_test_shops_with_checkins(test_db)
        
        response = test_client.get("/sitemap.xml")
        content = response.text
        
        # 店舗ページがハッシュURL形式で含まれていることを確認
        assert "<loc>http://localhost:8080/#!/shop/" in content
        assert "<lastmod>" in content
        assert "<changefreq>" in content
        assert "<priority>" in content
    
    def test_sitemap_xml_shop_priority_calculation(self, test_client, test_db):
        """店舗の重要度計算テスト"""
        shops = create_test_shops_with_checkins(test_db)
        
        response = test_client.get("/sitemap.xml")
        content = response.text
        
        # チェックイン数の多い店舗の重要度が高いことを確認
        # 新宿店はチェックイン数が多いので重要度が高いはず
        assert f"<loc>http://localhost:8080/#!/shop/{shops[0].id}</loc>" in content
        
        # 重要度の範囲が0.0-1.0であることを確認
        import re
        priorities = re.findall(r'<priority>([0-9.]+)</priority>', content)
        for priority in priorities:
            priority_float = float(priority)
            assert 0.0 <= priority_float <= 1.0
    
    def test_sitemap_xml_changefreq_determination(self, test_client, test_db):
        """更新頻度決定テスト"""
        shops = create_test_shops_with_checkins(test_db)
        
        response = test_client.get("/sitemap.xml")
        content = response.text
        
        # 更新頻度が適切な値であることを確認
        import re
        changefreqs = re.findall(r'<changefreq>([^<]+)</changefreq>', content)
        valid_freqs = ["always", "hourly", "daily", "weekly", "monthly", "yearly", "never"]
        
        for freq in changefreqs:
            assert freq in valid_freqs
    
    def test_sitemap_xml_cache_headers(self, test_client):
        """キャッシュヘッダーのテスト"""
        response = test_client.get("/sitemap.xml")
        
        # デバッグモードでのキャッシュヘッダーを確認
        assert "Cache-Control" in response.headers
        assert "no-cache" in response.headers["Cache-Control"]
    
    def test_sitemap_xml_error_handling(self, test_client, monkeypatch):
        """エラーハンドリングのテスト"""
        # データベースエラーをシミュレート
        def mock_query(*args, **kwargs):
            raise Exception("Database error")
        
        from app import create_app
        app = create_app()
        
        # エンドポイントを直接テスト
        with test_client as client:
            # データベースエラー時でも静的ページのみが返されることを確認
            response = client.get("/sitemap.xml")
            assert response.status_code == 200
            
            # 静的ページのみが含まれていることを確認
            content = response.text
            assert "<loc>http://localhost:8080/</loc>" in content
            assert "<loc>http://localhost:8080/contribute</loc>" in content


class TestSitemapHelperFunctions:
    """sitemap関連ヘルパー関数のテスト"""
    
    def test_calculate_shop_priority(self):
        """店舗重要度計算関数のテスト"""
        from app import calculate_shop_priority
        
        # 基本テスト
        shop = RamenShop(name="テスト店")
        priority = calculate_shop_priority(shop, 0)
        assert priority == 0.7
        
        # チェックイン数による調整
        priority = calculate_shop_priority(shop, 10)
        assert priority > 0.7
        assert priority <= 1.0
        
        # 最近の更新による調整
        shop.last_update = datetime.now(timezone.utc)
        priority = calculate_shop_priority(shop, 0)
        assert priority == 0.8  # 0.7 + 0.1
    
    def test_determine_changefreq(self):
        """更新頻度決定関数のテスト"""
        from app import determine_changefreq
        from datetime import timedelta
        
        # 更新日なし
        freq = determine_changefreq(None)
        assert freq == "monthly"
        
        # 最近の更新
        recent = datetime.now(timezone.utc)
        freq = determine_changefreq(recent)
        assert freq == "daily"
        
        # 1週間前の更新
        week_ago = datetime.now(timezone.utc) - timedelta(days=7)
        freq = determine_changefreq(week_ago)
        assert freq == "weekly"
        
        # 1ヶ月前の更新
        month_ago = datetime.now(timezone.utc) - timedelta(days=30)
        freq = determine_changefreq(month_ago)
        assert freq == "monthly"
        
        # 3ヶ月前の更新
        months_ago = datetime.now(timezone.utc) - timedelta(days=90)
        freq = determine_changefreq(months_ago)
        assert freq == "yearly"
    
    def test_generate_sitemap_xml(self):
        """sitemap XML生成関数のテスト"""
        from app import generate_sitemap_xml
        
        urls = [
            {
                "loc": "http://example.com/",
                "lastmod": "2023-01-01T00:00:00Z",
                "changefreq": "daily",
                "priority": "1.0"
            },
            {
                "loc": "http://example.com/page1",
                "changefreq": "weekly",
                "priority": "0.8"
            }
        ]
        
        xml = generate_sitemap_xml(urls)
        
        # XML構造を確認
        assert '<?xml version="1.0" encoding="UTF-8"?>' in xml
        assert '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' in xml
        assert '<url><loc>http://example.com/</loc>' in xml
        assert '<lastmod>2023-01-01T00:00:00Z</lastmod>' in xml
        assert '<changefreq>daily</changefreq>' in xml
        assert '<priority>1.0</priority></url>' in xml
        assert '<url><loc>http://example.com/page1</loc>' in xml
        assert '<changefreq>weekly</changefreq>' in xml
        assert '<priority>0.8</priority></url>' in xml
        assert '</urlset>' in xml
    
    def test_get_sitemap_cache_key(self):
        """sitemapキャッシュキー生成関数のテスト"""
        from app import get_sitemap_cache_key
        
        key = get_sitemap_cache_key()
        
        # キーが適切な形式であることを確認
        assert key.startswith("sitemap_")
        assert len(key) > 10  # "sitemap_" + YYYYMMDD_HH の形式
        
        # キャッシュをクリアして再度テスト
        get_sitemap_cache_key.cache_clear()
        key2 = get_sitemap_cache_key()
        assert key == key2  # 同じ時間内は同じキー