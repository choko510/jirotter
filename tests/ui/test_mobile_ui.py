import pytest
from playwright.sync_api import Page, expect
import os

# テスト用のユーザー情報
TEST_USER_ID = "testuser"
TEST_USER_PASSWORD = "password123!"

@pytest.fixture(scope="function", autouse=True)
def login(page: Page):
    """各テストの前にログインする"""
    page.goto("http://localhost:8000/#auth/login")
    page.fill("#id", TEST_USER_ID)
    page.fill("#password", TEST_USER_PASSWORD)
    page.click("#authSubmitBtn")
    page.wait_for_url("http://localhost:8000/#timeline")
    page.wait_for_load_state("networkidle")

@pytest.mark.parametrize("route", ["timeline", "map", "waittime", "stamp-rally", "rankings", "guide", "settings"])
def test_main_routes_mobile(page: Page, route: str):
    """各メインルートのモバイル表示をテストし、スクリーンショットを撮る"""
    page.set_viewport_size({"width": 375, "height": 667})
    page.goto(f"http://localhost:8000/#{route}")
    page.wait_for_load_state("networkidle")
    os.makedirs("jules-scratch", exist_ok=True)
    page.screenshot(path=f"jules-scratch/screenshot-{route}.png")

def test_contribute_page_mobile(page: Page):
    """contribute.htmlのモバイル表示をテストし、スクリーンショットを撮る"""
    page.set_viewport_size({"width": 375, "height": 667})
    page.goto("http://localhost:8000/contribute.html")
    page.wait_for_load_state("networkidle")
    os.makedirs("jules-scratch", exist_ok=True)
    page.screenshot(path="jules-scratch/screenshot-contribute.png")

def test_checkin_modal_mobile(page: Page):
    """チェックインモーダルのモバイル表示をテストし、スクリーンショットを撮る"""
    page.set_viewport_size({"width": 375, "height": 667})
    page.goto("http://localhost:8000/#timeline")
    page.wait_for_load_state("networkidle")
    page.click(".bottom-nav-checkin-button")
    expect(page.locator(".checkin-modal-overlay")).to_be_visible()
    os.makedirs("jules-scratch", exist_ok=True)
    page.screenshot(path=f"jules-scratch/screenshot-checkin-modal.png")

def test_search_modal_mobile(page: Page):
    """検索モーダルのモバイル表示をテストし、スクリーンショットを撮る"""
    page.set_viewport_size({"width": 375, "height": 667})
    page.goto("http://localhost:8000/#timeline")
    page.wait_for_load_state("networkidle")
    # JavaScriptを直接実行してモバイル検索を開く
    page.evaluate("Utils.openMobileSearch()")
    expect(page.locator("#mobileSearch")).to_be_visible()
    os.makedirs("jules-scratch", exist_ok=True)
    page.screenshot(path=f"jules-scratch/screenshot-search-modal.png")
