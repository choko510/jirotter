
import re
from playwright.sync_api import sync_playwright, expect
import time

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = browser.new_page()

    # Set a consistent viewport to ensure desktop layout is used
    page.set_viewport_size({"width": 1280, "height": 720})

    try:
        page.goto("http://localhost:8000")

        # Click the login button to show the form
        page.locator("#userProfile").get_by_role("button", name="ログイン").click()

        # Wait for the login form to be visible
        expect(page.locator("#id")).to_be_visible()

        # Switch to the registration form
        page.get_by_text("アカウント作成").click()
        expect(page.locator("#email")).to_be_visible()

        # Register a new user
        timestamp = int(time.time())
        user_id = f"user{timestamp}"
        email = f"user{timestamp}@example.com"
        password = "password123"

        page.locator("#id").fill(user_id)
        page.locator("#email").fill(email)
        page.locator("#password").fill(password)
        page.locator("#authSubmitBtn").click()

        # Wait for registration to complete and navigate to the timeline
        expect(page).to_have_url(re.compile(".*#timeline"), timeout=10000)

        # Wait for the timeline container to be rendered
        page.wait_for_selector("#timelineContainer", timeout=10000)

        # Add a small delay to ensure all JS has finished rendering
        page.wait_for_timeout(1000)

        # Navigate to the map page
        page.get_by_role("link", name="MAP").click()
        expect(page).to_have_url(re.compile(".*#map"))

        # Wait for the map to load and markers to appear
        page.wait_for_selector(".shop-marker", timeout=10000)

        # Click the first shop marker to open the popup
        page.locator(".shop-marker").first.click()

        # Click the "詳細を見る" (View Details) button in the popup
        page.locator(".leaflet-popup-content-wrapper").get_by_role("button", name="詳細を見る").click()

        # Wait for the detail panel to appear
        detail_panel = page.locator("#shopDetailPanel")
        expect(detail_panel).to_be_visible()

        # Verify that the panel contains the shop's name.
        expect(detail_panel.get_by_role("heading")).to_be_visible()

        # Take a screenshot
        page.screenshot(path="jules-scratch/verification/verification.png")

    finally:
        browser.close()

with sync_playwright() as playwright:
    run(playwright)
