import asyncio
import time
from playwright.async_api import async_playwright, expect

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()

        # Generate a unique user ID for this test run
        unique_id = f"playwright_user_{int(time.time())}"

        try:
            # Navigate to the app
            await page.goto("http://localhost:8000")

            # Go to the registration page
            await page.locator(".user-profile button").click()
            await page.get_by_text("アカウント作成").click()

            # Fill out the registration form
            await page.fill("#id", unique_id)
            await page.fill("#email", f"{unique_id}@example.com")
            await page.fill("#password", "password123")
            await page.get_by_role("button", name="登録").click()

            # Wait for successful registration message
            await expect(page.get_by_text("登録が完了しました！")).to_be_visible(timeout=10000)
            await expect(page).to_have_url("http://localhost:8000/#timeline", timeout=15000)

            # Wait for the timeline to be ready
            await expect(page.locator("#postTextarea")).to_be_visible(timeout=10000)

            # Create a post
            post_content = f"This is a test post by {unique_id}!"
            await page.fill("#postTextarea", post_content)

            # **FIX:** Explicitly wait for the button to be enabled
            await expect(page.get_by_role("button", name="ツイート")).to_be_enabled()

            # Click the tweet button and wait for the timeline refresh network request
            async with page.expect_response("**/api/v1/posts?page=1&per_page=20") as response_info:
                await page.get_by_role("button", name="ツイート").click()

            await response_info.value

            # Now that the timeline has reloaded, check for the post
            await expect(page.get_by_text(post_content)).to_be_visible(timeout=5000)

            # Navigate to the user's profile
            await page.locator(f".post-header:has-text('{unique_id}')").click()

            # Wait for the profile page to load and verify content
            await expect(page).to_have_url(f"http://localhost:8000/#profile/{unique_id}", timeout=10000)
            await expect(page.get_by_text(post_content)).to_be_visible(timeout=5000)

            # Take a screenshot
            await page.screenshot(path="jules-scratch/verification/verification.png")

        finally:
            await browser.close()

if __name__ == "__main__":
    asyncio.run(main())