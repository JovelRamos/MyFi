import time
import argparse
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait, Select
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
import sys

def scrape_storygraph_sci_fi_books(username, password, headless=True, debug=False):
    # Setup Chrome WebDriver with customizable headless option
    options = Options()
    
    if headless:
        options.add_argument("--headless")
        # Add user agent to avoid detection as headless browser
        options.add_argument("user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36")
    
    options.add_argument("--disable-gpu")
    options.add_argument("--window-size=1920,1080")
    options.add_argument("--disable-notifications")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-blink-features=AutomationControlled")  # Hide automation
    options.add_experimental_option("excludeSwitches", ["enable-automation"])
    options.add_experimental_option('useAutomationExtension', False)
    
    # Use webdriver-manager to handle driver installation
    print("Initializing browser...")
    driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)
    
    # Hide automation flags from JavaScript
    driver.execute_cdp_cmd("Page.addScriptToEvaluateOnNewDocument", {
        "source": """
        Object.defineProperty(navigator, 'webdriver', {
          get: () => undefined
        })
        """
    })
    
    try:
        # First navigate directly to login page
        driver.get('https://app.thestorygraph.com/users/sign_in')
        print("Navigating to login page...")
        
        # Wait for login page to load
        WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.ID, "new_user"))
        )
        
        if debug:
            driver.save_screenshot("login_page.png")
            print("Saved login page screenshot")
        
        # Handle login process with detailed debugging
        print("Attempting to log in...")
        try:
            # Find email field 
            email_field = WebDriverWait(driver, 5).until(
                EC.element_to_be_clickable((By.ID, "user_email"))
            )
            print("Found email field")
            
            # Find password field
            password_field = WebDriverWait(driver, 5).until(
                EC.element_to_be_clickable((By.ID, "user_password"))
            )
            print("Found password field")
            
            # Clear and fill fields
            email_field.clear()
            email_field.send_keys(username)
            password_field.clear()
            password_field.send_keys(password)
            
            if debug:
                print("Filled in credentials")
                driver.save_screenshot("credentials_filled.png")
            
            # Looking for login button
            login_button = WebDriverWait(driver, 5).until(
                EC.element_to_be_clickable((By.XPATH, "//input[@type='submit' and @value='Log in']"))
            )
            print("Found login button")
            
            # Click login button with JavaScript for reliability
            driver.execute_script("arguments[0].click();", login_button)
            print("Clicked login button")
            
            # Wait for login to complete and redirect
            WebDriverWait(driver, 10).until(
                lambda d: "sign_in" not in d.current_url
            )
            print(f"Login successful. Current URL: {driver.current_url}")
            
            if debug:
                driver.save_screenshot("after_login.png")
        
        except Exception as e:
            print(f"Login error: {e}")
            if debug:
                driver.save_screenshot("login_error.png")
                print("Page source (excerpt):")
                print(driver.page_source[:1000])
            return []
        
        # Now navigate to the books page
        print("Navigating to books page...")
        
        # Navigate to the books-read page directly
        driver.get('https://app.thestorygraph.com/books-read/scrooge3')
        time.sleep(3)  # Allow time for page load
        
        if "books-read/scrooge3" not in driver.current_url:
            print(f"Navigation failed. Current URL: {driver.current_url}")
            if debug:
                driver.save_screenshot("navigation_error.png")
                print("Page source (excerpt):")
                print(driver.page_source[:1000])
            return []
        
        print("Successfully loaded books page")
        if debug:
            driver.save_screenshot("books_page.png")
        
        # Click the filter button with multiple safeguards
        print("Activating filter menu...")
        filter_clicked = False
        
        # Try method 1: Normal selenium click
        try:
            filter_button = WebDriverWait(driver, 5).until(
                EC.element_to_be_clickable((By.XPATH, "//svg[@class='chevron-right filter w-6 inline']"))
            )
            filter_button.click()
            filter_clicked = True
            print("Clicked filter button with method 1")
        except Exception as e:
            if debug:
                print(f"Method 1 failed: {e}")
        
        # Try method 2: JavaScript click
        if not filter_clicked:
            try:
                driver.execute_script("""
                    var filterButtons = document.querySelectorAll('svg.chevron-right.filter.w-6.inline');
                    if (filterButtons.length > 0) filterButtons[0].click();
                """)
                filter_clicked = True
                print("Clicked filter button with method 2")
            except Exception as e:
                if debug:
                    print(f"Method 2 failed: {e}")
        
        # Try method 3: Look for any button with filter role
        if not filter_clicked:
            try:
                buttons = driver.find_elements(By.XPATH, "//svg[@role='button']")
                for button in buttons:
                    if "filter" in button.get_attribute("class"):
                        driver.execute_script("arguments[0].click();", button)
                        filter_clicked = True
                        print("Clicked filter button with method 3")
                        break
            except Exception as e:
                if debug:
                    print(f"Method 3 failed: {e}")
        
        if not filter_clicked:
            print("Failed to click filter button after trying all methods")
            if debug:
                driver.save_screenshot("filter_click_failure.png")
                print("Available buttons:")
                buttons = driver.find_elements(By.XPATH, "//button | //svg[@role='button']")
                for i, button in enumerate(buttons[:10]):  # Show first 10
                    print(f"Button {i}: {button.get_attribute('outerHTML')[:100]}")
            return []
        
        # Wait for filter dropdown to appear
        time.sleep(2)
        
        if debug:
            driver.save_screenshot("after_filter_click.png")
        
        # Select Science Fiction from genre dropdown
        print("Selecting Science Fiction genre...")
        genre_selected = False
        
        # Try method 1: Select by visible text
        try:
            genre_select = WebDriverWait(driver, 5).until(
                EC.presence_of_element_located((By.ID, "filter-by-genre-input-include"))
            )
            select = Select(genre_select)
            select.select_by_visible_text("Science Fiction")
            genre_selected = True
            print("Selected genre with method 1")
        except Exception as e:
            if debug:
                print(f"Genre selection method 1 failed: {e}")
        
        # Try method 2: Select by value
        if not genre_selected:
            try:
                select = Select(driver.find_element(By.ID, "filter-by-genre-input-include"))
                select.select_by_value("32")  # Science Fiction value
                genre_selected = True
                print("Selected genre with method 2")
            except Exception as e:
                if debug:
                    print(f"Genre selection method 2 failed: {e}")
        
        # Try method 3: JavaScript direct selection
        if not genre_selected:
            try:
                driver.execute_script("""
                    var select = document.getElementById('filter-by-genre-input-include');
                    var option = Array.from(select.options).find(opt => opt.text.includes('Science Fiction'));
                    if (option) {
                        option.selected = true;
                        var event = new Event('change', {bubbles: true});
                        select.dispatchEvent(event);
                    }
                """)
                genre_selected = True
                print("Selected genre with method 3")
            except Exception as e:
                if debug:
                    print(f"Genre selection method 3 failed: {e}")
        
        if not genre_selected:
            print("Failed to select Science Fiction genre")
            if debug:
                driver.save_screenshot("genre_selection_failure.png")
            return []
        
        if debug:
            driver.save_screenshot("after_genre_selection.png")
        
        # Submit the filter form
        print("Submitting filter form...")
        form_submitted = False
        
        # Try method 1: Find and click submit button
        try:
            submit_button = WebDriverWait(driver, 5).until(
                EC.element_to_be_clickable((By.XPATH, "//input[@type='submit' and @value='Filter']"))
            )
            driver.execute_script("arguments[0].click();", submit_button)
            form_submitted = True
            print("Submitted form with method 1")
        except Exception as e:
            if debug:
                print(f"Form submission method 1 failed: {e}")
        
        # Try method 2: JavaScript form submission
        if not form_submitted:
            try:
                driver.execute_script("""
                    var submitButtons = document.querySelectorAll('input[type="submit"][value="Filter"]');
                    if (submitButtons.length > 0) submitButtons[0].click();
                """)
                form_submitted = True
                print("Submitted form with method 2")
            except Exception as e:
                if debug:
                    print(f"Form submission method 2 failed: {e}")
        
        # Try method 3: Find form and submit directly
        if not form_submitted:
            try:
                form = driver.find_element(By.XPATH, "//form[.//input[@type='submit' and @value='Filter']]")
                driver.execute_script("arguments[0].submit();", form)
                form_submitted = True
                print("Submitted form with method 3")
            except Exception as e:
                if debug:
                    print(f"Form submission method 3 failed: {e}")
        
        if not form_submitted:
            print("Failed to submit filter form")
            if debug:
                driver.save_screenshot("form_submission_failure.png")
            return []
        
        # Wait for filtered results to load
        print("Waiting for filtered results...")
        time.sleep(4)
        
        if debug:
            driver.save_screenshot("after_form_submission.png")
        
        # Extract book data
        print("Extracting book data...")
        book_data = []
        
        try:
            # Try to find the book elements with the specific class
            book_elements = driver.find_elements(By.CSS_SELECTOR, 
                "div.max-w-3xl.mb-4.md\\:mb-6.text-darkestGrey.dark\\:text-grey.book-pane.break-words")
            
            print(f"Found {len(book_elements)} book elements")
            
            if debug and not book_elements:
                print("No book elements found, showing available elements:")
                divs = driver.find_elements(By.TAG_NAME, "div")
                book_like_divs = [d for d in divs if d.get_attribute("data-book-id")]
                print(f"Found {len(book_like_divs)} divs with data-book-id attribute")
                for i, div in enumerate(book_like_divs[:5]):
                    print(f"Div {i}: {div.get_attribute('outerHTML')[:200]}")
            
            for book_element in book_elements:
                book_id = book_element.get_attribute("data-book-id")
                
                # Find rating using optimized selector
                try:
                    rating = book_element.find_element(By.CSS_SELECTOR, 
                        "span.-ml-3.font-medium").text
                except NoSuchElementException:
                    rating = "N/A"
                
                if book_id:
                    book_data.append((book_id, rating))
            
            if debug and not book_data:
                print("Book elements found but couldn't extract data")
                driver.save_screenshot("book_elements_found.png")
                if book_elements:
                    print(f"First book element HTML: {book_elements[0].get_attribute('outerHTML')}")
            
            print("\n--- Science Fiction Books ---")
            print("Book ID | Rating")
            print("-----------------")
            for book_id, rating in book_data:
                print(f"{book_id} | {rating}")
            print(f"\nTotal Science Fiction books found: {len(book_data)}")
            
            return book_data
            
        except Exception as e:
            print(f"Error extracting book data: {e}")
            if debug:
                driver.save_screenshot("data_extraction_error.png")
            return []
            
    except TimeoutException as e:
        print(f"Operation timed out: {e}")
        if debug:
            driver.save_screenshot("timeout_error.png")
        return []
        
    except Exception as e:
        print(f"Unexpected error: {e}")
        if debug:
            driver.save_screenshot("unexpected_error.png")
        return []
        
    finally:
        driver.quit()
        print("Browser closed")

def main():
    # Setup command-line argument parsing
    parser = argparse.ArgumentParser(description='Scrape science fiction books from StoryGraph')
    parser.add_argument('-u', '--username', required=True, help='StoryGraph username/email')
    parser.add_argument('-p', '--password', required=True, help='StoryGraph password')
    parser.add_argument('--no-headless', action='store_true', help='Run in visible browser mode (not headless)')
    parser.add_argument('--debug', action='store_true', help='Enable debug mode with screenshots and verbose output')
    args = parser.parse_args()
    
    # Run the scraper
    book_data = scrape_storygraph_sci_fi_books(
        args.username, 
        args.password, 
        headless=not args.no_headless,
        debug=args.debug
    )
    
    # Could add additional processing here if needed
    if book_data:
        print("Scraping completed successfully")
        # Example of saving to a file
        with open("sci_fi_books.txt", "w") as f:
            f.write("Book ID | Rating\n")
            f.write("-----------------\n")
            for book_id, rating in book_data:
                f.write(f"{book_id} | {rating}\n")
        print("Results saved to sci_fi_books.txt")

if __name__ == "__main__":
    main()
