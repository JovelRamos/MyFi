import time
import json
import pickle
import os.path
import argparse
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import requests

def parse_arguments():
    """Parse command line arguments"""
    parser = argparse.ArgumentParser(description='Scrape Goodreads reviews with flexible parameters')
    
    parser.add_argument('--book_id', 
                        type=str, 
                        default="amzn1.gr.work.v1.Lz0uy5HK0V10aaz2IVAoQA",
                        help='The Goodreads work ID for the book (default: "amzn1.gr.work.v1.Lz0uy5HK0V10aaz2IVAoQA")')
    
    parser.add_argument('--rating_min', 
                        type=int, 
                        default=None,
                        choices=range(1, 6),
                        help='Minimum rating to filter (1-5, default: None - no minimum)')
    
    parser.add_argument('--rating_max', 
                        type=int, 
                        default=None,
                        choices=range(1, 6),
                        help='Maximum rating to filter (1-5, default: None - no maximum)')
    
    parser.add_argument('--limit', 
                        type=int, 
                        default=30,
                        help='Number of reviews to retrieve per request (default: 30)')
    
    parser.add_argument('--after', 
                        type=str, 
                        default=None,
                        help='Pagination token to retrieve reviews after a certain point')
    
    parser.add_argument('--email', 
                        type=str, 
                        help='Goodreads login email')
    
    parser.add_argument('--password', 
                        type=str, 
                        help='Goodreads login password')
    
    parser.add_argument('--headless', 
                        action='store_true',
                        help='Run browser in headless mode')
    
    parser.add_argument('--output', 
                        type=str, 
                        default='goodreads_reviews_response.json',
                        help='Output file name (default: goodreads_reviews_response.json)')
    
    return parser.parse_args()

def setup_driver(headless=False):
    """Set up the Chrome WebDriver with appropriate options"""
    chrome_options = Options()
    
    if headless:
        chrome_options.add_argument("--headless")
        
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    chrome_options.add_argument("--disable-blink-features=AutomationControlled")
    chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
    chrome_options.add_experimental_option("useAutomationExtension", False)
    
    driver = webdriver.Chrome(options=chrome_options)
    # Change user agent to avoid detection
    driver.execute_cdp_cmd("Network.setUserAgentOverride", {
        "userAgent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36"
    })
    driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
    
    return driver

def login_to_goodreads(driver, email, password):
    """Log in to Goodreads using Selenium"""
    # Navigate to the login page
    driver.get("https://www.goodreads.com/user/sign_in")
    
    try:
        # Look for the "Sign in with email" button and click it if present
        email_sign_in = WebDriverWait(driver, 10).until(
            EC.element_to_be_clickable((By.XPATH, "//button[contains(text(), 'Sign in with email')]"))
        )
        email_sign_in.click()
        
        print("Clicked on 'Sign in with email' button")
        time.sleep(2)
    except:
        print("Direct email login form or already on email form")
    
    try:
        # Fill in the login form
        email_input = WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.ID, "ap_email"))
        )
        email_input.send_keys(email)
        
        password_input = driver.find_element(By.ID, "ap_password")
        password_input.send_keys(password)
        
        # Submit the form
        sign_in_button = driver.find_element(By.ID, "signInSubmit")
        sign_in_button.click()
        
        # Wait for login to complete
        WebDriverWait(driver, 15).until(
            EC.presence_of_element_located((By.XPATH, "//a[contains(@href, '/user/show')]"))
        )
        
        print("Successfully logged in to Goodreads")
        return True
    except Exception as e:
        print(f"Login failed: {e}")
        return False

def get_jwt_token(driver):
    """Extract JWT token from cookies after login"""
    cookies = driver.get_cookies()
    jwt_token = None
    
    for cookie in cookies:
        if cookie['name'] == 'jwt_token':
            jwt_token = cookie['value']
            break
    
    return jwt_token, cookies

def save_cookies(cookies, filename='goodreads_cookies.pkl'):
    """Save cookies to a file"""
    with open(filename, 'wb') as f:
        pickle.dump(cookies, f)
    print(f"Cookies saved to {filename}")

def load_cookies(filename='goodreads_cookies.pkl'):
    """Load cookies from a file"""
    if os.path.exists(filename):
        with open(filename, 'rb') as f:
            return pickle.load(f)
    return None

def make_graphql_request(jwt_token, book_work_id, rating_min=None, rating_max=None, limit=30, after=None):
    """Make GraphQL request with JWT token and customizable parameters"""
    url = "https://kxbwmqov6jgg3daaamb744ycu4.appsync-api.us-east-1.amazonaws.com/graphql"
    
    headers = {
        "authority": "kxbwmqov6jgg3daaamb744ycu4.appsync-api.us-east-1.amazonaws.com",
        "method": "POST",
        "path": "/graphql",
        "scheme": "https",
        "Accept": "*/*",
        "Accept-Language": "en-US,en;q=0.9",
        "Authorization": jwt_token,
        "Content-Type": "application/json",
        "Origin": "https://www.goodreads.com",
        "Referer": "https://www.goodreads.com/",
        "Sec-Ch-Ua": '"Chromium";v="134", "Not A;Brand";v="24", "Google Chrome";v="134"',
        "Sec-Ch-Ua-Mobile": "?0",
        "Sec-Ch-Ua-Platform": '"macOS"',
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "cross-site",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36"
    }
    
    # Build filters dictionary
    filters = {
        "resourceType": "WORK",
        "resourceId": f"kca://work/{book_work_id}"
    }
    
    # Only add rating filters if they are provided
    if rating_min is not None:
        filters["ratingMin"] = rating_min
    if rating_max is not None:
        filters["ratingMax"] = rating_max
    
    # Build pagination dictionary
    pagination = {"limit": limit}
    if after:
        pagination["after"] = after
    
    payload = {
        "operationName": "getReviews",
        "variables": {
            "filters": filters,
            "pagination": pagination
        },
        "query": "query getReviews($filters: BookReviewsFilterInput!, $pagination: PaginationInput) {\n  getReviews(filters: $filters, pagination: $pagination) {\n    ...BookReviewsFragment\n    __typename\n  }\n}\n\nfragment BookReviewsFragment on BookReviewsConnection {\n  totalCount\n  edges {\n    node {\n      ...ReviewCardFragment\n      __typename\n    }\n    __typename\n  }\n  pageInfo {\n    prevPageToken\n    nextPageToken\n    __typename\n  }\n  __typename\n}\n\nfragment ReviewCardFragment on Review {\n  __typename\n  id\n  creator {\n    ...ReviewerProfileFragment\n    __typename\n  }\n  recommendFor\n  updatedAt\n  createdAt\n  spoilerStatus\n  lastRevisionAt\n  text\n  rating\n  shelving {\n    shelf {\n      name\n      webUrl\n      __typename\n    }\n    taggings {\n      tag {\n        name\n        webUrl\n        __typename\n      }\n      __typename\n    }\n    webUrl\n    __typename\n  }\n  likeCount\n  viewerHasLiked\n  commentCount\n}\n\nfragment ReviewerProfileFragment on User {\n  id: legacyId\n  imageUrlSquare\n  isAuthor\n  ...SocialUserFragment\n  textReviewsCount\n  viewerRelationshipStatus {\n    isBlockedByViewer\n    __typename\n  }\n  name\n  webUrl\n  contributor {\n    id\n    works {\n      totalCount\n      __typename\n    }\n    __typename\n  }\n  __typename\n}\n\nfragment SocialUserFragment on User {\n  viewerRelationshipStatus {\n    isFollowing\n    isFriend\n    __typename\n  }\n  followersCount\n  __typename\n}"
    }
    
    payload_json = json.dumps(payload)
    
    session = requests.Session()
    response = session.post(url, headers=headers, data=payload_json)
    
    try:
        response_data = response.json()
    except json.JSONDecodeError:
        response_data = {
            "error": "Could not decode JSON response", 
            "content": response.text[:1000]
        }
    
    return response.status_code, response_data

def main():
    args = parse_arguments()
    
    # Get credentials from arguments or use environment variables or prompt
    email = args.email or os.environ.get("GOODREADS_EMAIL")
    password = args.password or os.environ.get("GOODREADS_PASSWORD")
    
    if not email:
        email = input("Enter Goodreads email: ")
    if not password:
        import getpass
        password = getpass.getpass("Enter Goodreads password: ")
    
    # Check for saved cookies first
    cookies = load_cookies()
    jwt_token = None
    
    if cookies:
        for cookie in cookies:
            if cookie['name'] == 'jwt_token':
                jwt_token = cookie['value']
                break
        
        if jwt_token:
            print("Using saved JWT token from cookies file")
            status_code, response_data = make_graphql_request(
                jwt_token, 
                args.book_id,
                args.rating_min,
                args.rating_max,
                args.limit,
                args.after
            )
            
            # Check if the token is still valid
            if status_code == 200 and 'errors' not in response_data:
                print(f"Status Code: {status_code}")
                print("\n--- Response Data Sample ---")
                print(json.dumps(response_data, indent=2, ensure_ascii=False)[:1000])
                
                with open(args.output, 'w', encoding='utf-8') as f:
                    json.dump(response_data, f, indent=2, ensure_ascii=False)
                print(f"Full response saved to {args.output}")
                return
            else:
                print("Saved token is expired or invalid. Logging in again.")
    
    # Need to log in with Selenium
    driver = None
    try:
        driver = setup_driver(headless=args.headless)
        login_success = login_to_goodreads(driver, email, password)
        
        if login_success:
            # Visit book page to ensure all cookies are set
            driver.get("https://www.goodreads.com/book/show/99219")
            time.sleep(3)
            
            jwt_token, cookies = get_jwt_token(driver)
            
            if jwt_token:
                print(f"JWT Token: {jwt_token[:30]}...")
                save_cookies(cookies)
                
                # Make GraphQL request with custom parameters
                print("\nMaking GraphQL request...")
                status_code, response_data = make_graphql_request(
                    jwt_token, 
                    args.book_id,
                    args.rating_min,
                    args.rating_max,
                    args.limit,
                    args.after
                )
                
                print(f"Status Code: {status_code}")
                print("\n--- Response Data Sample ---")
                print(json.dumps(response_data, indent=2, ensure_ascii=False)[:1000])
                
                with open(args.output, 'w', encoding='utf-8') as f:
                    json.dump(response_data, f, indent=2, ensure_ascii=False)
                print(f"Full response saved to {args.output}")
            else:
                print("Could not find JWT token after login")
        else:
            print("Login failed")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        if driver:
            driver.quit()

if __name__ == "__main__":
    main()
