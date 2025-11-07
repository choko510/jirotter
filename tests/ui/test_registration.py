import os
import pytest
from playwright.sync_api import Page, expect
import uuid

# Playwright 環境がない場合はこのモジュール全体をスキップ
pytestmark = pytest.mark.skipif(
    "PLAYWRIGHT_BROWSERS_PATH" not in os.environ,
    reason="Playwright environment not configured",
)

# Generate a unique user ID for each test run to avoid conflicts
TEST_USER_ID = f"testuser_{uuid.uuid4().hex[:8]}"
TEST_USER_EMAIL = f"{TEST_USER_ID}@example.com"
TEST_USER_PASSWORD = "password123!"

def test_user_registration(page: Page):
    """ユーザー登録のUIテスト"""
    # 1. 登録ページにアクセス
    page.goto("http://localhost:8000/#auth/register")

    # 2. 登録フォームが表示されていることを確認
    expect(page.locator("#id")).to_be_visible()
    expect(page.locator("#email")).to_be_visible()
    expect(page.locator("#password")).to_be_visible()

    # 3. フォームに情報を入力
    page.fill("#id", TEST_USER_ID)
    page.fill("#email", TEST_USER_EMAIL)
    page.fill("#password", TEST_USER_PASSWORD)

    # 4. 登録ボタンをクリック
    page.click("#authSubmitBtn")

    # 5. タイムラインにリダイレクトされることを確認
    page.wait_for_load_state("networkidle")
    page.wait_for_url("http://localhost:8000/#timeline")
    expect(page).to_have_url("http://localhost:8000/#timeline")

    # 6. ユーザーメニューが表示されていることを確認 (ログアウトボタンの存在を確認)
    logout_button = page.locator('button:has-text("ログアウト")')
    expect(logout_button).to_be_visible()
