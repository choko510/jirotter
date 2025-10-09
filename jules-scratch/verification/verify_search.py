
import asyncio
from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            page.goto("http://localhost:8000")

            # 検索ボックスが表示されるのを待つ
            search_input = page.wait_for_selector("#searchInput")

            # 「二郎」と入力
            search_input.type("二郎")

            # 検索結果が表示されるのを待つ (特定の店名が表示されるまで待機)
            page.wait_for_selector('#shopList div:has-text("ラーメン二郎 新宿店")')

            # スクリーンショットを撮る
            page.screenshot(path="jules-scratch/verification/verification.png")

            print("Screenshot saved to jules-scratch/verification/verification.png")

        except Exception as e:
            print(f"An error occurred: {e}")
        finally:
            browser.close()

if __name__ == "__main__":
    run()
