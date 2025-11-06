import pytest
from playwright.sync_api import Page, expect
import hashlib
import time
from database import get_db
from app.models import User

# テスト用のユーザー情報
TEST_USER_ID = "testuser"
TEST_USER_EMAIL = "testuser@example.com"
TEST_USER_PASSWORD = "password123!"

def test_login_and_logout(page: Page):
    """ログインとログアウトのUIテスト"""
    # アラートを自動的に閉じる
    page.on("dialog", lambda dialog: dialog.dismiss())

    # 1. ログインページにアクセス
    page.goto("http://localhost:8000/#auth/login")

    # 2. ログインフォームが表示されていることを確認
    expect(page.locator("#id")).to_be_visible()
    expect(page.locator("#password")).to_be_visible()

    # 3. ユーザーIDとパスワードを入力
    page.fill("#id", TEST_USER_ID)
    page.fill("#password", TEST_USER_PASSWORD)

    # 4. ログインボタンをクリック
    page.click("#authSubmitBtn")

    # 5. タイムラインにリダイレクトされることを確認
    page.wait_for_load_state("networkidle")
    page.wait_for_url("http://localhost:8000/#timeline")
    expect(page).to_have_url("http://localhost:8000/#timeline")

    # 6. ユーザーメニューが表示されていることを確認 (ログアウトボタンの存在を確認)
    logout_button = page.locator('button:has-text("ログアウト")')
    expect(logout_button).to_be_visible()

    # 7. ログアウトボタンをクリック
    logout_button.click()

    # 8. ログインページにリダイレクトされることを確認
    page.wait_for_url("http://localhost:8000/#auth/login")
    expect(page).to_have_url("http://localhost:8000/#auth/login")
