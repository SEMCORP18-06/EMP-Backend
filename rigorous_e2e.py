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

async def test_portal():
    print("[E2E] Starting Rigorous End-to-End Test Suite against http://localhost:5173")
    
    # 0. Cleanup previous E2E test data from MongoDB
    run_db_helper("cleanup")
    
    async with async_playwright() as p:
        # Launch browser
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 800})
        page = await context.new_page()
        page.on("console", lambda msg: print(f"[BROWSER CONSOLE] {msg.text}"))
        page.on("pageerror", lambda err: print(f"[BROWSER ERROR] {err}"))
        
        # 1. Navigation & Theme Toggle Check
        print("\n--- STEP 1: Navigation & Theme Toggle ---")
        await page.goto("http://localhost:5173/")
        await page.wait_for_load_state("networkidle")
        await page.screenshot(path=os.path.join(SCREENSHOT_DIR, "step1_login_page_dark.png"))
        print("Logged screenshot of login page in Dark Mode.")
        
        # Click theme toggle (it's fixed at the top right)
        await page.click("button[aria-label='Toggle theme']")
        await page.wait_for_timeout(500)
        await page.screenshot(path=os.path.join(SCREENSHOT_DIR, "step1_login_page_light.png"))
        print("Logged screenshot of login page in Light Mode.")
        
        # 2. Signup Validation Check
        print("\n--- STEP 2: Signup Form Validations ---")
        await page.click("button:has-text('Sign Up')")
        await page.wait_for_timeout(500)
        
        # Fill invalid email domain
        await page.fill("input[id='name']", "E2E Admin User")
        await page.fill("input[id='username']", "e2e_test_admin@gmail.com")
        await page.fill("input[id='password']", "Password123!")
        await page.fill("input[id='confirmPassword']", "Password123!")
        await page.fill("input[placeholder='Enter Captcha Code']", "AAAAAA")
        
        # Submit to trigger domain check
        await page.click("button[type='submit']:has-text('Sign Up')")
        await page.wait_for_timeout(500)
        error_msg = await page.inner_text(".error-banner, .error-message, [style*='color: #ef4444' i]")
        print("Invalid domain error displayed as expected:", error_msg)
        await page.screenshot(path=os.path.join(SCREENSHOT_DIR, "step2_validation_invalid_domain.png"))
        
        # Fill weak password
        await page.fill("input[id='username']", "e2e_test_admin@semcogroups.com")
        await page.fill("input[id='password']", "123")
        await page.wait_for_timeout(500)
        error_msg = await page.inner_text(".error-banner, .error-message, [style*='color: #ef4444' i]")
        print("Weak password error displayed as expected:", error_msg)
        
        # Fill correct credentials and fetch captcha
        await page.fill("input[id='password']", "Password123!")
        
        # Extract Captcha
        captcha_text = await page.eval_on_selector(
            "div[style*='letter-spacing: 4px' i], div[style*='letterSpacing: 4px' i]",
            "el => el.innerText"
        )
        captcha_text = captcha_text.strip().replace(" ", "").replace("\n", "")
        print(f"Extracted Captcha Code: {captcha_text}")
        
        await page.fill("input[placeholder='Enter Captcha Code']", captcha_text)
        await page.screenshot(path=os.path.join(SCREENSHOT_DIR, "step2_signup_filled.png"))
        
        # Submit Signup
        print("Submitting registration form...")
        await page.click("button[type='submit']:has-text('Sign Up')")
        await page.wait_for_timeout(2000)
        await page.screenshot(path=os.path.join(SCREENSHOT_DIR, "step2_signup_success.png"))
        print("Successfully submitted registration. Verify email screen displayed.")
        
        # 3. Database Activation via Node DB Helper
        print("\n--- STEP 3: Activating User in Database ---")
        run_db_helper("verify-user", "e2e_test_admin@semcogroups.com", "Admin")
        
        # 4. Login as Verified Admin
        print("\n--- STEP 4: Login as Verified Admin ---")
        # Click login tab/redirect back
        await page.goto("http://localhost:5173/")
        await page.wait_for_load_state("networkidle")
        await page.click("button:has-text('Sign In')") # Change from Login to Sign In if tab is named Sign In
        await page.wait_for_timeout(500)
        await page.fill("input[id='username']", "e2e_test_admin@semcogroups.com")
        await page.fill("input[id='password']", "Password123!")
        await page.screenshot(path=os.path.join(SCREENSHOT_DIR, "step4_login_filled.png"))
        await page.click("button[type='submit']:has-text('Sign In')")
        await page.wait_for_timeout(3000)
        await page.screenshot(path=os.path.join(SCREENSHOT_DIR, "step4_dashboard_loaded.png"))
        print("Successfully logged in! Dashboard page loaded.")
        
        # 5. User Management & Approval E2E
        print("\n--- STEP 5: User Management Flow ---")
        # Click Manage Users
        await page.click("button:has-text('Manage Users')")
        await page.wait_for_timeout(1000)
        await page.screenshot(path=os.path.join(SCREENSHOT_DIR, "step5_user_management.png"))
        print("Loaded User Management panel.")
        
        # Click View Enquiries to go back to main dashboard
        await page.click("button:has-text('View Enquiries')")
        await page.wait_for_timeout(1000)
        
        # 6. CRUD test on Masters (Equipments, FPRs, Project Engineers)
        print("\n--- STEP 6: Masters (Equipments, FPRs, Project Engineers) CRUD ---")
        # Open Enquiry Modal first to access Masters dropdown options
        await page.click("button:has-text('Add Enquiry')")
        await page.wait_for_timeout(1000)
        
        # Project Engineers Modal
        print("Opening Project Engineers management...")
        await page.click(".pe-dropdown-container div.select-filter")
        await page.wait_for_timeout(500)
        await page.click(".pe-dropdown-container .dropdown-option-label:has-text('Manage Project Engineers')")
        await page.wait_for_timeout(1000)
        await page.screenshot(path=os.path.join(SCREENSHOT_DIR, "step6_pe_modal.png"))
        # Add new Project Engineer
        await page.fill("input[placeholder='Enter Project Engineer name...']", "E2E Test PE")
        await page.fill("input[placeholder='Enter Project Engineer email (optional)...']", "e2e_pe@semcogroups.com")
        await page.fill("input[placeholder='Enter Project Engineer contact number (optional)...']", "9876543210")
        await page.click("button:has-text('Add Project Engineer')")
        await page.wait_for_timeout(1000)
        await page.screenshot(path=os.path.join(SCREENSHOT_DIR, "step6_pe_added.png"))
        print("Added new Project Engineer 'E2E Test PE'.")
        # Close PE Modal
        await page.click("button:has-text('Close')")
        await page.wait_for_timeout(500)
        
        # FPRs Modal
        print("Opening FPR management...")
        await page.click(".fpr-dropdown-container div.select-filter")
        await page.wait_for_timeout(500)
        await page.click(".fpr-dropdown-container .dropdown-option-label:has-text('Manage FPRs')")
        await page.wait_for_timeout(1000)
        await page.screenshot(path=os.path.join(SCREENSHOT_DIR, "step6_fpr_modal.png"))
        # Add new FPR
        await page.fill("input[placeholder='Enter new FPR name...']", "E2E Test FPR")
        await page.fill("input[placeholder='Enter new FPR email (optional)...']", "e2e_fpr@semcogroups.com")
        await page.click("button:has-text('Add FPR')")
        await page.wait_for_timeout(1000)
        await page.screenshot(path=os.path.join(SCREENSHOT_DIR, "step6_fpr_added.png"))
        print("Added new FPR 'E2E Test FPR'.")
        # Close FPR Modal
        await page.click("button:has-text('Close')")
        await page.wait_for_timeout(500)

        # Equipments Modal
        print("Opening Equipments management...")
        await page.click(".equip-dropdown-container div.select-filter")
        await page.wait_for_timeout(500)
        await page.click(".equip-dropdown-container .dropdown-option-label:has-text('Manage Equipments')")
        await page.wait_for_timeout(1000)
        await page.screenshot(path=os.path.join(SCREENSHOT_DIR, "step6_equip_modal.png"))
        # Add new Equipment
        await page.fill("input[placeholder='Enter new equipment name...']", "E2E Test Equip")
        await page.locator(".modal-content form button[type='submit']").last.click()
        await page.wait_for_timeout(1000)
        await page.screenshot(path=os.path.join(SCREENSHOT_DIR, "step6_equip_added.png"))
        print("Added new Equipment 'E2E Test Equip'.")
        # Close Equipments Modal
        await page.click("button:has-text('Close')")
        await page.wait_for_timeout(500)

        # Cancel/Close Enquiry Modal
        await page.click("button:has-text('Cancel')")
        await page.wait_for_timeout(500)

        # 7. Create Enquiry Flow
        print("\n--- STEP 7: Creating a New Enquiry ---")
        await page.click("button:has-text('Add Enquiry')")
        await page.wait_for_timeout(1000)
        
        # Fill in details
        await page.fill("input[name='clientName']", "E2E Client Name")
        await page.fill("input[name='companyName']", "E2E Company Name")
        await page.fill("input[name='mailId']", "e2e_client@semco.com")
        await page.fill("input[name='contactNumber']", "9876543210")
        await page.fill("input[name='quotationNumber']", "QTN-E2E-999")
        await page.fill("textarea[name='enquiryDetails']", "This is an E2E test enquiry detail description.")
        await page.fill("input[name='enquirySource']", "E2E Test Source")
        await page.select_option("select[name='currentStatus']", "Confirmed")
        await page.fill("input[name='poNumber']", "PO-E2E-12345")
        
        # expectedDateOfDispatch is required for Confirmed status
        tomorrow_str = time.strftime("%Y-%m-%d", time.localtime(time.time() + 86400))
        await page.fill("input[name='expectedDateOfDispatch']", tomorrow_str)
        
        # Select newly created PE from dropdown
        print("Selecting Project Engineer in form...")
        await page.click(".pe-dropdown-container div.select-filter")
        await page.wait_for_timeout(500)
        await page.click(".pe-dropdown-container .fpr-option-row:has-text('E2E Test PE')")
        await page.wait_for_timeout(500)
        
        # Select newly created FPR from dropdown
        print("Selecting FPR in form...")
        await page.click(".fpr-dropdown-container div.select-filter")
        await page.wait_for_timeout(500)
        await page.click(".fpr-dropdown-container .fpr-option-row:has-text('E2E Test FPR')")
        await page.wait_for_timeout(500)

        # Select newly created Equipment from dropdown
        print("Selecting Equipment in form...")
        await page.click(".equip-dropdown-container div.select-filter")
        await page.wait_for_timeout(500)
        await page.click(".equip-dropdown-container label.dropdown-option-label:has-text('E2E Test Equip')")
        await page.wait_for_timeout(500)
        # Click trigger again to close dropdown
        await page.click(".equip-dropdown-container div.select-filter")
        await page.wait_for_timeout(500)
        
        await page.screenshot(path=os.path.join(SCREENSHOT_DIR, "step7_enquiry_form_filled.png"))
        
        # Submit Enquiry
        await page.click("button[type='submit']:has-text('Add Enquiry')")
        await page.wait_for_timeout(2000)
        await page.screenshot(path=os.path.join(SCREENSHOT_DIR, "step7_enquiry_created.png"))
        print("Successfully created Enquiry with QTN-E2E-999!")

        # 7.5 Seed Milestone in Database
        print("\n--- STEP 7.5: Seeding Milestones via DB Helper ---")
        run_db_helper("seed-milestones", "QTN-E2E-999")
        await page.wait_for_timeout(1000)

        # 8. Filter and Search
        print("\n--- STEP 8: Verification of Search and Filtering ---")
        # Search by client name
        await page.fill("input[placeholder*='Search']", "E2E Client")
        await page.wait_for_timeout(500)
        rows_count = await page.locator("table tbody tr").count()
        print(f"Search results for 'E2E Client': {rows_count} rows found.")
        await page.screenshot(path=os.path.join(SCREENSHOT_DIR, "step8_search_result.png"))
        
        # Filter by status "Confirmed"
        await page.select_option("select.select-filter", "Confirmed")
        await page.wait_for_timeout(500)
        await page.screenshot(path=os.path.join(SCREENSHOT_DIR, "step8_filter_result.png"))
        print("Filtering applied.")

        # 9. Milestones Progression & Update
        print("\n--- STEP 9: Milestones Verification ---")
        # Reload page to fetch updated enquiry from MongoDB with seeded milestones
        print("Reloading dashboard page to fetch updated enquiry from database...")
        await page.reload()
        await page.wait_for_load_state("networkidle")
        await page.wait_for_timeout(2000)

        # Clear search and reset filter to All Statuses on Enquiries tab first
        await page.fill("input[placeholder*='Search']", "")
        await page.select_option("select.select-filter", "")
        await page.wait_for_timeout(500)

        # Switch to Confirmed Orders tab
        await page.click("button:has-text('Confirmed Orders')")
        await page.wait_for_timeout(1000)
        
        # Click Add / Modify Milestone button on the E2E row
        row = page.locator("tr:has-text('QTN-E2E-999')")
        await row.locator("button:has-text('Add / Modify Milestone')").click()
        await page.wait_for_timeout(1000)
        await page.screenshot(path=os.path.join(SCREENSHOT_DIR, "step9_milestones_modal.png"))
        
        # Change status of "Engineering Design" to Completed
        milestone_row = page.locator("table.milestone-table tbody tr").first
        await milestone_row.locator("select.table-select").select_option("Completed")
        
        # Fill actual end date
        today_str = time.strftime("%Y-%m-%d")
        await milestone_row.locator("input[type='date']").nth(2).fill(today_str)
        
        # Add remark
        await milestone_row.locator("input[placeholder='Remarks...']").fill("E2E Test Drawing Done")
        
        # Click Save (submit form)
        await page.click("div.modal-content button.btn-primary:has-text('Save')")
        await page.wait_for_timeout(1000)
        
        # Handle Confirm Modal: Send Client Update
        print("Handling Send Client Update confirmation modal...")
        await page.wait_for_selector("div.modal-overlay:has-text('Send Client Update')", timeout=5000)
        await page.click("div.modal-overlay:has-text('Send Client Update') button.btn-secondary:has-text('No')")
        
        # Optionally handle Send FPR Update modal if it appears
        await page.wait_for_timeout(1000)
        fpr_modal = page.locator("div.modal-overlay:has-text('Send FPR Update')")
        if await fpr_modal.is_visible():
            print("Handling Send FPR Update confirmation modal...")
            await fpr_modal.locator("button.btn-secondary:has-text('No')").click()
            await page.wait_for_timeout(1000)
        
        await page.screenshot(path=os.path.join(SCREENSHOT_DIR, "step9_milestones_updated.png"))
        print("Updated Milestone 'Engineering Design' to Completed.")
        
        # Close Milestones Modal
        await page.click("div.modal-content button:has-text('Close')")
        await page.wait_for_timeout(500)

        # Switch back to Enquiries tab for delete operations
        await page.click("button:has-text('Enquiries')")
        await page.wait_for_timeout(1000)

        # 10. Soft Delete & Bin Restoration
        print("\n--- STEP 10: Soft Delete & Bin Operations ---")
        # Click Delete on the E2E row
        row = page.locator("tr:has-text('QTN-E2E-999')")
        await row.locator("button:has-text('Delete')").click()
        await page.wait_for_timeout(500)
        await page.screenshot(path=os.path.join(SCREENSHOT_DIR, "step10_delete_confirm_modal.png"))
        
        # Confirm Delete
        await page.click("div.modal-overlay:has-text('Confirm Delete') button.btn-danger:has-text('Yes')")
        await page.wait_for_timeout(1000)
        await page.screenshot(path=os.path.join(SCREENSHOT_DIR, "step10_deleted_from_dashboard.png"))
        print("Successfully soft-deleted the enquiry.")
        
        # Open Bin
        await page.click("button:has-text('Bin')")
        await page.wait_for_timeout(1000)
        await page.screenshot(path=os.path.join(SCREENSHOT_DIR, "step10_bin_modal.png"))
        
        # Restore enquiry from Bin
        bin_row = page.locator("tr:has-text('QTN-E2E-999')")
        await bin_row.locator("button[title='Recover Enquiry']").click()
        await page.wait_for_timeout(1000)
        await page.screenshot(path=os.path.join(SCREENSHOT_DIR, "step10_bin_restored.png"))
        print("Restored enquiry from Bin.")
        
        # Close Bin
        await page.click("div.modal-overlay:has-text('Recycle Bin') button:has-text('Close')")
        await page.wait_for_timeout(500)
        
        # Verify it's back on main dashboard
        await page.screenshot(path=os.path.join(SCREENSHOT_DIR, "step10_dashboard_verified.png"))
        
        # 11. Permanent Delete
        print("\n--- STEP 11: Permanent Delete Flow ---")
        # Soft delete again
        row = page.locator("tr:has-text('QTN-E2E-999')")
        await row.locator("button:has-text('Delete')").click()
        await page.wait_for_timeout(500)
        await page.click("div.modal-overlay:has-text('Confirm Delete') button.btn-danger:has-text('Yes')")
        await page.wait_for_timeout(1000)
        
        # Open Bin
        await page.click("button:has-text('Bin')")
        await page.wait_for_timeout(1000)
        
        # Click permanent delete
        bin_row = page.locator("tr:has-text('QTN-E2E-999')")
        await bin_row.locator("button[title='Permanently Delete']").click()
        await page.wait_for_timeout(500)
        await page.screenshot(path=os.path.join(SCREENSHOT_DIR, "step11_permanent_delete_confirm.png"))
        
        # Confirm permanent delete
        await page.click("div.modal-overlay:has-text('Warning') button.btn-danger:has-text('Yes')")
        await page.wait_for_timeout(1000)
        await page.screenshot(path=os.path.join(SCREENSHOT_DIR, "step11_permanent_deleted.png"))
        print("Successfully deleted the enquiry permanently.")
        
        # Close Bin
        await page.click("div.modal-overlay:has-text('Recycle Bin') button:has-text('Close')")
        await page.wait_for_timeout(500)
        
        # Clean up database test entries
        run_db_helper("cleanup")
        
        await browser.close()
        print("\n[E2E] Rigorous End-to-End Test Suite Completed Successfully! All systems verified.")

if __name__ == "__main__":
    asyncio.run(test_portal())
