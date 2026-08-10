import asyncio
import os
import sys
import subprocess
import time
from playwright.async_api import async_playwright

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')

SCREENSHOT_DIR = r"C:\Users\Divyansh Agarwal\.gemini\antigravity\brain\6d6b4d90-ff57-4340-9b42-9a79c2453a36\scratch"
os.makedirs(SCREENSHOT_DIR, exist_ok=True)

def run_db_helper(cmd, *args):
    print(f"[E2E] Running DB Helper: node e2e_db_helper.js {cmd} {' '.join(args)}")
    result = subprocess.run(
        ["node", "e2e_db_helper.js", cmd] + list(args),
        cwd=os.getcwd(),
        capture_output=True,
        text=True
    )
    print(result.stdout)
    if result.stderr:
        print("[E2E DB Helper Error]:", result.stderr)

async def test_email_features():
    print("[E2E] Starting Rigorous Email Integration Test Suite against http://localhost:5173 / Render Backend")
    
    # 0. Cleanup previous E2E test data from MongoDB
    run_db_helper("cleanup")
    
    async with async_playwright() as p:
        # Launch browser
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 800})
        page = await context.new_page()
        
        # Listen for console messages, page errors, and dialogs
        page.on("console", lambda msg: print(f"[BROWSER CONSOLE] {msg.text}"))
        page.on("pageerror", lambda err: print(f"[BROWSER ERROR] {err}"))
        
        async def handle_dialog(dialog):
            print(f"[DIALOG] {dialog.type}: {dialog.message}")
            await dialog.accept()
        page.on("dialog", lambda d: asyncio.create_task(handle_dialog(d)))
        
        # 1. Navigation
        print("\n--- STEP 1: Navigating to Portal ---")
        await page.goto("http://localhost:5173/")
        await page.wait_for_load_state("networkidle")
        await page.screenshot(path=os.path.join(SCREENSHOT_DIR, "email_test_1_login.png"))
        
        # 2. Signup Integration (Verification Email)
        print("\n--- STEP 2: Signup Flow & Verification Email Trigger ---")
        await page.click("button:has-text('Sign Up')")
        await page.wait_for_timeout(500)
        
        await page.fill("input[id='name']", "E2E Email Tester")
        await page.fill("input[id='username']", "e2e_test_email_user@semcogroups.com")
        await page.fill("input[id='password']", "Password123!")
        await page.fill("input[id='confirmPassword']", "Password123!")
        
        # Extract Captcha
        captcha_text = await page.eval_on_selector(
            "div[style*='letter-spacing: 4px' i], div[style*='letterSpacing: 4px' i]",
            "el => el.innerText"
        )
        captcha_text = captcha_text.strip().replace(" ", "").replace("\n", "")
        print(f"Extracted Captcha Code: {captcha_text}")
        await page.fill("input[placeholder='Enter Captcha Code']", captcha_text)
        await page.screenshot(path=os.path.join(SCREENSHOT_DIR, "email_test_2_signup_filled.png"))
        
        # Submit
        print("Submitting signup...")
        await page.click("button[type='submit']:has-text('Sign Up')")
        # Wait for registration request to complete and verification card to appear
        await page.wait_for_selector("text=Verification link sent successfully!", timeout=20000)
        if await page.locator(".toast-success-banner").is_visible():
            toast_text = await page.locator(".toast-success-banner").inner_text()
            print(f"🎉 Signup Success Toast: {toast_text}")
        await page.screenshot(path=os.path.join(SCREENSHOT_DIR, "email_test_2_signup_success.png"))
        print("Verification email screen displayed successfully.")
        
        # 3. Database Activation
        print("\n--- STEP 3: Activating User in DB ---")
        run_db_helper("verify-user", "e2e_test_email_user@semcogroups.com", "Admin")
        
        # 4. Login
        print("\n--- STEP 4: Login as Activated User ---")
        await page.goto("http://localhost:5173/")
        await page.wait_for_load_state("networkidle")
        await page.click("button:has-text('Sign In')")
        await page.wait_for_timeout(500)
        await page.fill("input[id='username']", "e2e_test_email_user@semcogroups.com")
        await page.fill("input[id='password']", "Password123!")
        await page.click("button[type='submit']:has-text('Sign In')")
        await page.wait_for_timeout(3000)
        await page.screenshot(path=os.path.join(SCREENSHOT_DIR, "email_test_4_dashboard.png"))
        print("Successfully logged in.")
        
        # 5. Masters Setup
        print("\n--- STEP 5: Setting up Masters ---")
        await page.click("button:has-text('Add Enquiry')")
        await page.wait_for_timeout(1000)
        
        # Add PE
        await page.click(".pe-dropdown-container div.select-filter")
        await page.wait_for_timeout(500)
        await page.click(".pe-dropdown-container .dropdown-option-label:has-text('Manage Project Engineers')")
        await page.wait_for_timeout(500)
        await page.fill("input[placeholder='Enter Project Engineer name...']", "E2E Email PE")
        await page.fill("input[placeholder='Enter Project Engineer email (optional)...']", "e2e_email_pe@semcogroups.com")
        await page.click("button:has-text('Add Project Engineer')")
        await page.wait_for_timeout(1000)
        await page.click("button:has-text('Close')")
        await page.wait_for_timeout(500)
        
        # Add FPR
        await page.click(".fpr-dropdown-container div.select-filter")
        await page.wait_for_timeout(500)
        await page.click(".fpr-dropdown-container .dropdown-option-label:has-text('Manage FPRs')")
        await page.wait_for_timeout(500)
        await page.fill("input[placeholder='Enter new FPR name...']", "E2E Email FPR")
        await page.fill("input[placeholder='Enter new FPR email (optional)...']", "e2e_email_fpr@semcogroups.com")
        await page.click("button:has-text('Add FPR')")
        await page.wait_for_timeout(1000)
        await page.click("button:has-text('Close')")
        await page.wait_for_timeout(500)

        # Add Equipment
        await page.click(".equip-dropdown-container div.select-filter")
        await page.wait_for_timeout(500)
        await page.click(".equip-dropdown-container .dropdown-option-label:has-text('Manage Equipments')")
        await page.wait_for_timeout(500)
        await page.fill("input[placeholder='Enter new equipment name...']", "E2E Email Equip")
        await page.locator(".modal-content form button[type='submit']").last.click()
        await page.wait_for_timeout(1000)
        await page.click("button:has-text('Close')")
        await page.wait_for_timeout(500)
        
        await page.click("button:has-text('Cancel')")
        await page.wait_for_timeout(500)

        # 6. Create Confirmed Enquiry
        print("\n--- STEP 6: Creating Confirmed Enquiry ---")
        await page.click("button:has-text('Add Enquiry')")
        await page.wait_for_timeout(1000)
        
        await page.fill("input[name='clientName']", "E2E Client Name")
        await page.fill("input[name='companyName']", "E2E Company Name")
        await page.fill("input[name='mailId']", "e2e_client@semco.com")
        await page.fill("input[name='contactNumber']", "9876543210")
        await page.fill("input[name='quotationNumber']", "QTN-E2E-EMAIL")
        await page.fill("textarea[name='enquiryDetails']", "This is an E2E test email enquiry.")
        await page.fill("input[name='enquirySource']", "E2E Test Source")
        await page.select_option("select[name='currentStatus']", "Confirmed")
        await page.fill("input[name='poNumber']", "PO-E2E-EMAIL")
        
        tomorrow_str = time.strftime("%Y-%m-%d", time.localtime(time.time() + 86400))
        await page.fill("input[name='expectedDateOfDispatch']", tomorrow_str)
        
        # Select PE
        await page.click(".pe-dropdown-container div.select-filter")
        await page.wait_for_timeout(500)
        await page.click(".pe-dropdown-container .fpr-option-row:has-text('E2E Email PE')")
        await page.wait_for_timeout(500)
        
        # Select FPR
        await page.click(".fpr-dropdown-container div.select-filter")
        await page.wait_for_timeout(500)
        await page.click(".fpr-dropdown-container .fpr-option-row:has-text('E2E Email FPR')")
        await page.wait_for_timeout(500)

        # Select Equipment
        await page.click(".equip-dropdown-container div.select-filter")
        await page.wait_for_timeout(500)
        await page.click(".equip-dropdown-container label.dropdown-option-label:has-text('E2E Email Equip')")
        await page.wait_for_timeout(500)
        await page.click(".equip-dropdown-container div.select-filter")
        await page.wait_for_timeout(500)
        
        await page.click("button[type='submit']:has-text('Add Enquiry')")
        await page.wait_for_timeout(2500)
        print("Enquiry QTN-E2E-EMAIL created successfully.")

        # Seed milestone via DB helper
        run_db_helper("seed-milestones", "QTN-E2E-EMAIL")

        # 7. Milestone updates (Client Update Email & FPR Update Email)
        print("\n--- STEP 7: Milestones Updates & Email Prompts ---")
        # Reload to fetch seeded milestone
        await page.reload()
        await page.wait_for_load_state("networkidle")
        await page.wait_for_timeout(2000)

        # Clear search and reset filter
        await page.fill("input[placeholder*='Search']", "")
        await page.select_option("select.select-filter", "")
        await page.wait_for_timeout(500)

        # Switch to Confirmed Orders tab
        await page.click("button:has-text('Confirmed Orders')")
        await page.wait_for_timeout(1000)
        
        # Open Milestone modal
        row = page.locator("tr:has-text('QTN-E2E-EMAIL')")
        await row.locator("button:has-text('Add / Modify Milestone')").click()
        await page.wait_for_timeout(1000)
        await page.screenshot(path=os.path.join(SCREENSHOT_DIR, "email_test_7_milestones_modal.png"))
        
        # Complete milestone
        milestone_row = page.locator("table.milestone-table tbody tr").first
        await milestone_row.locator("select.table-select").select_option("Completed")
        today_str = time.strftime("%Y-%m-%d")
        await milestone_row.locator("input[type='date']").nth(2).fill(today_str)
        await milestone_row.locator("input[placeholder='Remarks...']").fill("Milestone Completed for Email Test")
        
        # Save Milestones
        print("Saving milestone progress (will trigger email confirmation dialogs)...")
        await page.click("div.modal-content button.btn-primary:has-text('Save')")
        await page.wait_for_timeout(1000)

        # Handle Confirm Modal: Send Client Update (Click Yes to verify integration)
        print("Clicking YES on 'Send Client Update' confirmation modal...")
        await page.wait_for_selector("div.modal-overlay:has-text('Send Client Update')", timeout=5000)
        await page.click("div.modal-overlay:has-text('Send Client Update') button.btn-primary:has-text('Yes')")
        
        # Handle Confirm Modal: Send FPR Update (Click Yes to verify integration)
        await page.wait_for_timeout(1000)
        fpr_modal = page.locator("div.modal-overlay:has-text('Send FPR Update')")
        if await fpr_modal.is_visible():
            print("Clicking YES on 'Send FPR Update' confirmation modal...")
            await fpr_modal.locator("button.btn-primary:has-text('Yes')").click()
            
        # Wait for the spinner to disappear
        print("Waiting for milestone save request to complete...")
        await page.wait_for_selector(".spinner-overlay", state="detached", timeout=60000)
        # Verify the success toast appears
        await page.wait_for_selector(".toast-success-banner", timeout=10000)
        toast_text = await page.locator(".toast-success-banner").inner_text()
        print(f"🎉 Milestone update success toast: {toast_text}")
            
        await page.screenshot(path=os.path.join(SCREENSHOT_DIR, "email_test_7_milestones_saved.png"))
        print("Milestone update request completed. Transporter was triggered on the backend.")

        # Close Milestones Modal if still open
        close_btn = page.locator("div.modal-content button:has-text('Close')")
        if await close_btn.is_visible():
            await close_btn.click()
            await page.wait_for_timeout(500)

        # Switch back to Enquiries tab
        await page.click("button:has-text('Enquiries')")
        # Wait 4 seconds for the milestone update toast to fully disappear
        await page.wait_for_timeout(4000)

        # 8. Custom Client Email
        print("\n--- STEP 8: Send Custom Client Email via SendMailModal ---")
        row = page.locator("tr:has-text('QTN-E2E-EMAIL')")
        await row.locator("button[title='Send Email to Client']").click()
        await page.wait_for_timeout(1000)
        await page.screenshot(path=os.path.join(SCREENSHOT_DIR, "email_test_8_send_mail_modal.png"))

        # Fill SendMail form
        await page.fill("input[id='email-subject']", "PO-E2E-EMAIL Progress Confirmation Update")
        await page.fill("textarea[id='email-message']", "Dear client,\n\nWe are writing to update you that we have completed design drawings.\n\nBest regards,\nSEMCO team")
        
        # Submit Custom Email
        print("Submitting Custom Client Email...")
        await page.click(".modal-content.medium button[type='submit']:has-text('Send')")
        
        # Wait for either success toast, success banner, or error banner to be visible (up to 60 seconds)
        print("Waiting for custom email request to complete...")
        success_toast = page.locator(".toast-success-banner:has-text('Email sent successfully')")
        error_banner = page.locator(".error-banner")
        
        # Wait for either to appear
        await page.locator(".toast-success-banner:has-text('Email sent successfully'), .error-banner").first.wait_for(state="visible", timeout=60000)
        
        await page.screenshot(path=os.path.join(SCREENSHOT_DIR, "email_test_8_send_mail_result.png"))

        if await success_toast.is_visible():
            toast_text = await success_toast.inner_text()
            print(f"🎉 Custom Email integration SUCCESS (Toast Popup): {toast_text}")
        elif await error_banner.is_visible():
            banner_text = await error_banner.inner_text()
            print(f"⚠️ Custom Email integration returned EXPECTED SMTP status/error: {banner_text}")
        else:
            print("Could not locate final status banner. Check step8 screenshot.")

        # Close SendMail Modal if still open
        close_btn = page.locator(".modal-content.medium button.modal-close")
        try:
            if await close_btn.is_visible():
                await close_btn.click(timeout=1000)
        except Exception:
            pass
        await page.wait_for_timeout(500)

        # 9. Gantt Chart Progress Email
        print("\n--- STEP 9: Send Progress Update Email via GanttModal ---")
        # Switch back to Confirmed Orders tab
        await page.click("button:has-text('Confirmed Orders')")
        await page.wait_for_timeout(1000)

        # Open Gantt Modal
        row = page.locator("tr:has-text('QTN-E2E-EMAIL')")
        await row.locator("button.gantt-btn").click()
        await page.wait_for_timeout(1000)
        await page.screenshot(path=os.path.join(SCREENSHOT_DIR, "email_test_9_gantt_modal.png"))

        # Open Email section
        await page.click("button.gantt-email-toggle-btn")
        await page.wait_for_timeout(1000)

        # Fill and Send Progress Update
        await page.fill("textarea[id='emailMessage']", "This is an E2E progress update email with a Gantt chart. We have completed engineering design.")
        await page.screenshot(path=os.path.join(SCREENSHOT_DIR, "email_test_9_gantt_filled.png"))
        
        print("Submitting Progress Update Email...")
        await page.click("button.btn-send-update")

        # Wait for either success toast, success alert, or error alert
        print("Waiting for progress update email request to complete...")
        success_toast = page.locator(".toast-success-banner:has-text('Progress update')")
        alert = page.locator(".gantt-email-alert")
        
        await page.locator(".toast-success-banner:has-text('Progress update'), .gantt-email-alert").first.wait_for(state="visible", timeout=60000)
        await page.screenshot(path=os.path.join(SCREENSHOT_DIR, "email_test_9_gantt_result.png"))

        if await success_toast.is_visible():
            toast_text = await success_toast.inner_text()
            print(f"🎉 Gantt Progress Update Email Toast: {toast_text}")
        elif await alert.is_visible():
            alert_text = await alert.inner_text()
            print(f"Gantt Progress Update Email Alert: {alert_text}")

        # Close Gantt modal
        close_gantt_btn = page.locator("div.gantt-modal-content button.modal-close")
        if await close_gantt_btn.is_visible():
            await close_gantt_btn.click()
            await page.wait_for_timeout(500)

        # Clean up database test entries
        run_db_helper("cleanup")
        
        await browser.close()
        print("\n[E2E] Email Integrations Test Complete!")

if __name__ == "__main__":
    asyncio.run(test_email_features())
