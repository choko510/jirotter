
import re
import uuid
from playwright.sync_api import sync_playwright, Page, expect

def run(playwright):
    user_id = f"user{uuid.uuid4().hex[:8]}"
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    try:
        page.goto("http://localhost:8000", wait_until="networkidle")

        # 新規登録
        page.goto("http://localhost:8000/#auth/register")
        page.locator("#id").fill(user_id)
        page.locator("#email").fill(f"{user_id}@example.com")
        page.locator("#password").fill("password123!") # Updated password
        page.locator("#authForm").get_by_role("button", name="登録").click()

        # タイムラインへのリダイレクトを待つ
        expect(page).to_have_url(re.compile(r".*#timeline"), timeout=15000)

        # プロフィールページへ移動
        page.goto(f"http://localhost:8000/#profile/{user_id}")

        # 編集ボタンをクリック
        edit_button = page.get_by_role("button", name="プロフィールを編集")
        expect(edit_button).to_be_visible(timeout=10000)
        edit_button.click()

        # モーダルを開く
        modal = page.locator(".profile-edit-modal")
        expect(modal).to_be_visible(timeout=5000)

        # フォームを入力
        modal.locator("#username").fill("Secured_User")
        modal.locator("#bio").fill("This profile is now secure.")
        modal.locator("#profileImageUrl").fill("https://via.placeholder.com/150/0000FF/808080?Text=Secure")

        # 保存ボタンをクリック
        modal.get_by_role("button", name="保存").click()

        # UIの更新を待つ
        expect(page.locator(".profile-name")).to_have_text("Secured_User", timeout=10000)
        expect(page.locator(".profile-bio")).to_have_text("This profile is now secure.")

        page.screenshot(path="jules-scratch/verification/final_profile_view.png")

    finally:
        browser.close()

with sync_playwright() as playwright:
    run(playwright)
