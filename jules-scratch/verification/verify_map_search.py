
import asyncio
from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            page.goto("http://localhost:8000")

            # MAPタブをクリックしてマップビューに切り替え
            page.click('div.nav-item[data-route="map"]')

            # まずはマップページのタイトルが表示されるのを待つ
            page.wait_for_selector("h1.map-title")

            # 次にマップが読み込まれるのを待つ
            page.wait_for_selector("#map .leaflet-map-pane")

            # 検索ボックスが表示されるのを待つ
            search_input = page.wait_for_selector("#searchInput")

            # 「二郎」と入力
            search_input.type("二郎")

            # マーカーが2つ表示されるのを待つ (検索結果が2件のため)
            page.wait_for_selector(".shop-marker", state="attached")
            page.wait_for_function("() => document.querySelectorAll('.shop-marker').length === 2")

            # スクリーンショットを撮る
            page.screenshot(path="jules-scratch/verification/verification_map.png")

            print("Screenshot saved to jules-scratch/verification/verification_map.png")

        except Exception as e:
            print(f"An error occurred: {e}")
        finally:
            browser.close()

if __name__ == "__main__":
    run()
