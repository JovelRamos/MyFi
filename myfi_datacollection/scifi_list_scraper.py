import requests
from bs4 import BeautifulSoup
import re
import pandas as pd
import time
import random
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.common.by import By

def scrape_with_selenium():
    print("Scraping with Selenium...")
    
    # URLs to scrape
    urls = [
        "http://scifilists.sffjazz.com/lists_books_rank1.html",
        "http://scifilists.sffjazz.com/lists_books_rank2.html",
        "http://scifilists.sffjazz.com/lists_books_rank3.html"
    ]
    
    # Set up Chrome options
    chrome_options = Options()
    chrome_options.add_argument("--headless")  # Run in headless mode
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    chrome_options.add_argument("user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36")
    
    # Initialize the Chrome driver
    driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=chrome_options)
    
    all_books = []
    
    for url_index, url in enumerate(urls):
        print(f"Navigating to URL {url_index+1}/3: {url}")
        driver.get(url)
        
        # Wait for page to load
        time.sleep(3)
        
        # Get the page source and parse with BeautifulSoup for better HTML navigation
        soup = BeautifulSoup(driver.page_source, 'html.parser')
        
        # Find all rows in the table
        rows = soup.find_all('tr')
        print(f"  Found {len(rows)} rows")
        
        book_count = 0
        for row in rows:
            # Find all cells in this row
            cells = row.find_all('td')
            
            if len(cells) >= 3:
                # Try to identify author and title cells by their attributes
                author_cell = None
                title_cell = None
                
                for i, cell in enumerate(cells):
                    if cell.get('width') == "33%" and cell.get('align') == "left":
                        author_cell = cell
                        if i + 1 < len(cells) and cells[i + 1].get('width') == "44%" and cells[i + 1].get('align') == "left":
                            title_cell = cells[i + 1]
                            break
                
                if author_cell and title_cell:
                    author = author_cell.text.strip()
                    full_title = title_cell.text.strip()
                    
                    # Skip header rows containing "Author/Editor" or "Title"
                    if "author/editor" in author.lower() or "title" == full_title.lower():
                        print("  Skipping header row")
                        continue
                    
                    # Remove brackets and their contents
                    title = re.sub(r'\s*\[[^\]]*\]', '', full_title).strip()
                    
                    all_books.append({"Author": author, "Title": title})
                    book_count += 1
        
        print(f"  Extracted {book_count} books from this page")
    
    driver.quit()
    
    # Convert to DataFrame
    df = pd.DataFrame(all_books)
    print(f"\nTotal books scraped with Selenium: {len(df)}")
    
    return df

def validate_results(df):
    """Validate the scraped results to ensure we have good data"""
    if len(df) == 0:
        print("ERROR: No books were scraped!")
        return False
    
    # Check if we have any Title or Author entries that match header values
    header_entries = df[df['Author'].str.contains('Author/Editor', case=False, na=False) | 
                       df['Title'].str.contains('Title', case=False, na=False)]
    
    if len(header_entries) > 0:
        print(f"WARNING: Found {len(header_entries)} entries that might be headers:")
        print(header_entries)
        return False
    
    # Check that we have the expected number of results
    if len(df) != 300 and len(df) not in [99, 100, 101]:
        print(f"WARNING: Expected 300 books total (or around 100 per page), but found {len(df)}")
        return False
    
    return True

# Run the scraper and display results
if __name__ == "__main__":
    # Scrape with Selenium since it's our best option
    books_df = scrape_with_selenium()
    
    # Validate our results
    is_valid = validate_results(books_df)
    
    if is_valid:
        print("\nFirst 10 books:")
        print(books_df.head(10))
        
        # Save to CSV
        books_df.to_csv("scifi_books.csv", index=False)
        print(f"\nComplete dataset of {len(books_df)} books saved to 'scifi_books.csv'")
    else:
        print("\nScraping finished but validation failed - check output for details")
        
        # Save anyway so we can examine the results
        if len(books_df) > 0:
            books_df.to_csv("scifi_books_unvalidated.csv", index=False)
            print(f"Saved {len(books_df)} unvalidated results to 'scifi_books_unvalidated.csv'")
