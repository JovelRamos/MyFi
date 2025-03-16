import csv
import requests
import urllib.parse
import time
import os
import re
from difflib import SequenceMatcher
from bs4 import BeautifulSoup

def normalize_text(text):
    """Normalize text to handle variations in spacing, punctuation, and capitalization."""
    # Remove all punctuation (except ampersand which we'll handle specially)
    normalized = re.sub(r'[^\w\s&]', '', text).lower()
    # Replace ampersand with "and"
    normalized = normalized.replace('&', 'and')
    # Replace "jr." or similar with empty string
    normalized = re.sub(r'\bjr\b|\bjunior\b', '', normalized)
    # Compress multiple spaces to single space
    normalized = re.sub(r'\s+', ' ', normalized).strip()
    return normalized

def similarity_score(str1, str2):
    """Calculate similarity between two strings using SequenceMatcher."""
    return SequenceMatcher(None, str1, str2).ratio()

def title_match(csv_title, api_title, threshold=0.85):
    """Check if titles match, accounting for variations."""
    norm_csv = normalize_text(csv_title)
    norm_api = normalize_text(api_title)
    
    # Direct match after normalization
    if norm_csv == norm_api:
        return True
    
    # Check similarity score
    return similarity_score(norm_csv, norm_api) >= threshold

def author_match(csv_author, api_authors):
    """
    Check if authors match, accounting for variations and multiple authors.
    
    Args:
        csv_author (str): Author name(s) from CSV (may contain multiple authors)
        api_authors (list): List of author names from API
    """
    if not api_authors:
        return False
    
    # Normalize CSV author
    norm_csv_author = normalize_text(csv_author)
    
    # Split CSV author if it contains multiple authors
    csv_author_list = [author.strip() for author in re.split(r'\s+and\s+|\s*&\s*', norm_csv_author)]
    
    # For single author in CSV
    if len(csv_author_list) == 1:
        for api_author in api_authors:
            norm_api_author = normalize_text(api_author)
            
            # Direct match or high similarity
            if norm_csv_author == norm_api_author or similarity_score(norm_csv_author, norm_api_author) >= 0.85:
                return True
            
        return False
    
    # For multiple authors in CSV (e.g., "Author1 & Author2")
    else:
        # Normalize all API authors
        norm_api_authors = [normalize_text(author) for author in api_authors]
        
        # Check if each CSV author appears in the API author list
        matches = 0
        for csv_auth in csv_author_list:
            for api_auth in norm_api_authors:
                # Direct match or high similarity
                if csv_auth == api_auth or similarity_score(csv_auth, api_auth) >= 0.85:
                    matches += 1
                    break
        
        # Return true if all CSV authors were matched in the API authors list
        return matches == len(csv_author_list)

def fetch_book_data(title, author):
    """Fetch book data from OpenLibrary based on title and author."""
    # URL encode the title for the API request
    encoded_title = urllib.parse.quote(title)
    url = f"https://openlibrary.org/search.json?title={encoded_title}"
    
    response = requests.get(url)
    if response.status_code != 200:
        error_msg = f"Error fetching data for {title}: {response.status_code}"
        print(error_msg)
        return None, error_msg
    
    data = response.json()
    
    if "docs" not in data or len(data["docs"]) == 0:
        error_msg = f"No results found for {title}"
        print(error_msg)
        return None, error_msg
    
    # Look for a doc that matches both title and author
    best_match = None
    highest_score = 0
    
    for doc in data["docs"]:
        if "author_name" in doc and "title" in doc:
            # Check if both title and author match
            if title_match(title, doc["title"]) and author_match(author, doc["author_name"]):
                # For exact matches, return immediately
                if normalize_text(title) == normalize_text(doc["title"]):
                    return doc, None
                
                # Calculate a match score for potential matches
                score = similarity_score(normalize_text(title), normalize_text(doc["title"]))
                if score > highest_score:
                    highest_score = score
                    best_match = doc
    
    # If we found a good match, return it
    if best_match:
        return best_match, None
    
    # Try searching by just the title if no author match was found
    for doc in data["docs"]:
        if "title" in doc and title_match(title, doc["title"], threshold=0.95):
            print(f"Found title match but no author match for {title}. Using best title match.")
            return doc, None
    
    error_msg = f"No acceptable match found for {title} by {author}"
    print(error_msg)
    return None, error_msg

def extract_isbns_from_html(work_url):
    """Extract ISBNs by scraping the OpenLibrary work page."""
    try:
        response = requests.get(work_url)
        if response.status_code != 200:
            return None, None
        
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Look for ISBN-10
        isbn_10 = None
        isbn_10_dt = soup.find('dt', string='ISBN 10')
        if isbn_10_dt:
            isbn_10_dd = isbn_10_dt.find_next_sibling('dd', class_='object', itemprop='isbn')
            if isbn_10_dd:
                isbn_10 = isbn_10_dd.text.strip()
        
        # Look for ISBN-13
        isbn_13 = None
        isbn_13_dt = soup.find('dt', string='ISBN 13')
        if isbn_13_dt:
            isbn_13_dd = isbn_13_dt.find_next_sibling('dd', class_='object', itemprop='isbn')
            if isbn_13_dd:
                isbn_13 = isbn_13_dd.text.strip()
        
        return isbn_10, isbn_13
    except Exception as e:
        print(f"Error scraping HTML: {e}")
        return None, None

def fetch_work_data(work_key):
    """Fetch book data using the work key."""
    url = f"https://openlibrary.org{work_key}.json"
    
    response = requests.get(url)
    if response.status_code != 200:
        print(f"Error fetching work data for {work_key}: {response.status_code}")
        return None, None
    
    data = response.json()
    
    # Work data typically doesn't contain ISBNs directly
    # But it might have links to editions that do
    if "links" in data:
        for link in data["links"]:
            if "url" in link and "title" in link and "edition" in link.get("title", "").lower():
                edition_url = link["url"]
                # If it's an internal OpenLibrary link, fetch it
                if edition_url.startswith("/books/"):
                    return fetch_isbn_data(edition_url.split("/")[-1].rstrip(".json"))
    
    return None, None

def fetch_isbns_from_work_editions(work_key, title):
    """
    Fetch ISBNs from work editions API endpoint.
    
    Args:
        work_key (str): OpenLibrary work key
        title (str): Book title to match against
    
    Returns:
        tuple: (isbn_10, isbn_13)
    """
    url = f"https://openlibrary.org{work_key}/editions.json"
    print(f"Fetching editions from: {url}")
    
    try:
        response = requests.get(url)
        if response.status_code != 200:
            print(f"Error fetching editions: {response.status_code}")
            return None, None
        
        data = response.json()
        if "entries" not in data or not data["entries"]:
            print("No entries found in editions data")
            return None, None
        
        # Normalize the title for matching
        normalized_title = normalize_text(title)
        
        # First try to find editions that match the title
        for entry in data["entries"]:
            if "title" in entry and title_match(title, entry["title"]):
                # Check for ISBNs
                isbn_10 = entry.get("isbn_10", [None])[0] if "isbn_10" in entry and entry["isbn_10"] else None
                isbn_13 = entry.get("isbn_13", [None])[0] if "isbn_13" in entry and entry["isbn_13"] else None
                
                if isbn_10 or isbn_13:
                    print(f"Found matching edition with ISBNs: {isbn_10 or 'None'}, {isbn_13 or 'None'}")
                    return isbn_10, isbn_13
        
        # If no matching title found, just take the first entry with ISBNs
        for entry in data["entries"]:
            isbn_10 = entry.get("isbn_10", [None])[0] if "isbn_10" in entry and entry["isbn_10"] else None
            isbn_13 = entry.get("isbn_13", [None])[0] if "isbn_13" in entry and entry["isbn_13"] else None
            
            if isbn_10 or isbn_13:
                print(f"Using first available edition with ISBNs: {isbn_10 or 'None'}, {isbn_13 or 'None'}")
                return isbn_10, isbn_13
        
        print("No editions with ISBNs found")
        return None, None
            
    except Exception as e:
        print(f"Error processing editions data: {str(e)}")
        return None, None


def fetch_isbn_data(cover_edition_key):
    """
    Fetch ISBN data using the cover edition key with multiple fallback methods.
    Returns tuple: (isbn_10, isbn_13, error_message)
    """
    # First attempt: Direct edition lookup
    url = f"https://openlibrary.org/books/{cover_edition_key}.json"
    
    response = requests.get(url)
    if response.status_code != 200:
        error_msg = f"Error fetching ISBN data for {cover_edition_key}: {response.status_code}"
        print(error_msg)
        return None, None, error_msg
    
    data = response.json()
    
    isbn_10 = None
    isbn_13 = None
    
    # Check for ISBNs in the edition data
    if "isbn_10" in data and data["isbn_10"]:
        isbn_10 = data["isbn_10"][0]
    
    if "isbn_13" in data and data["isbn_13"]:
        isbn_13 = data["isbn_13"][0]
    
    # If ISBNs found, return them
    if isbn_10 or isbn_13:
        return isbn_10, isbn_13, None
    
    # Second attempt: Use the work key if available
    if "works" in data and len(data["works"]) > 0:
        work_key = data["works"][0]["key"]
        print(f"No ISBNs in edition data, trying work key: {work_key}")
        
        # Fetch data using the work key
        work_isbn_10, work_isbn_13 = fetch_work_data(work_key)
        
        if work_isbn_10 or work_isbn_13:
            return work_isbn_10, work_isbn_13, None
        
        # Second-to-last resort: Fetch editions data from work editions API
        if "title" in data:
            print(f"Trying to fetch ISBNs from work editions API")
            editions_isbn_10, editions_isbn_13 = fetch_isbns_from_work_editions(work_key, data["title"])
            
            if editions_isbn_10 or editions_isbn_13:
                return editions_isbn_10, editions_isbn_13, None
        
        # Last resort: Scrape the HTML page
        print(f"No ISBNs in work API data, attempting to scrape HTML page")
        work_url = f"https://openlibrary.org{work_key}"
        html_isbn_10, html_isbn_13 = extract_isbns_from_html(work_url)
        
        if html_isbn_10 or html_isbn_13:
            return html_isbn_10, html_isbn_13, None
    
    return None, None, "No ISBNs found after all attempts"

def fetch_alternative_book_data(title, author):
    """Try alternative API endpoint for book data with multiple fallback methods."""
    # URL encode both title and author for a more specific search
    encoded_query = urllib.parse.quote(f"{title} {author}")
    url = f"https://openlibrary.org/search.json?q={encoded_query}"
    
    response = requests.get(url)
    if response.status_code != 200:
        error_msg = f"Error fetching alternative data for {title}: {response.status_code}"
        print(error_msg)
        return None, None, error_msg
    
    data = response.json()
    
    if "docs" not in data or len(data["docs"]) == 0:
        error_msg = f"No results found in alternative search for {title}"
        print(error_msg)
        return None, None, error_msg
    
    isbn_10 = None
    isbn_13 = None
    
    # Look for a doc that matches both title and author
    for doc in data["docs"]:
        if "author_name" in doc and "title" in doc:
            if title_match(title, doc["title"]) and author_match(author, doc["author_name"]):
                # First attempt: If we have cover_edition_key, use it to get ISBNs
                if "cover_edition_key" in doc:
                    isbn_10, isbn_13, _ = fetch_isbn_data(doc["cover_edition_key"])
                    if isbn_10 or isbn_13:
                        return isbn_10, isbn_13, None
                
                # Second attempt: Check if doc directly contains ISBNs
                if "isbn" in doc and doc["isbn"]:
                    for isbn in doc["isbn"]:
                        if len(isbn) == 10 and not isbn_10:
                            isbn_10 = isbn
                        elif len(isbn) == 13 and not isbn_13:
                            isbn_13 = isbn
                    
                    if isbn_10 or isbn_13:
                        return isbn_10, isbn_13, None
                
                # Third attempt: Use the work key if available
                if "key" in doc:
                    work_key = doc["key"]
                    print(f"Trying work key: {work_key}")
                    
                    # Fetch data using the work key
                    work_response = requests.get(f"https://openlibrary.org{work_key}.json")
                    if work_response.status_code == 200:
                        work_data = work_response.json()
                        
                        # Look for editions in the work data
                        if "editions" in work_data:
                            for edition in work_data["editions"]:
                                edition_key = edition["key"]
                                e_isbn_10, e_isbn_13, _ = fetch_isbn_data(edition_key.split("/")[-1])
                                if e_isbn_10 or e_isbn_13:
                                    return e_isbn_10, e_isbn_13, None
                                
                    # Second-to-last resort: Fetch editions data from work editions API
                    print(f"Trying to fetch ISBNs from work editions API")
                    editions_isbn_10, editions_isbn_13 = fetch_isbns_from_work_editions(work_key, title)
                    if editions_isbn_10 or editions_isbn_13:
                        return editions_isbn_10, editions_isbn_13, None
                    
                    # Last resort: Scrape the HTML page
                    print(f"Attempting to scrape HTML page for {work_key}")
                    work_url = f"https://openlibrary.org{work_key}"
                    html_isbn_10, html_isbn_13 = extract_isbns_from_html(work_url)
                    
                    if html_isbn_10 or html_isbn_13:
                        return html_isbn_10, html_isbn_13, None
    
    return None, None, f"No matching ISBNs found in alternative search for {title} by {author}"

def process_books():
    """Main function to process the books data."""
    input_file = "scifi_books.csv"
    output_file = "scifi_list_OL.csv"
    
    # Check if input file exists
    if not os.path.exists(input_file):
        print(f"Error: Input file {input_file} not found")
        return
    
    # Read from CSV
    with open(input_file, 'r', newline='', encoding='utf-8') as csvfile:
        reader = csv.reader(csvfile)
        # Skip header row
        header = next(reader)
        books = list(reader)
    
    # Create a new list for enriched data
    enriched_books = []
    success_count = 0
    total_books = len(books)
    
    # Process each book
    for book in books:
        author, title = book
        print(f"Processing: {title} by {author}")
        
        isbn_10 = None
        isbn_13 = None
        error_message = None
        
        # Fetch book data from OpenLibrary search endpoint
        book_data, error = fetch_book_data(title, author)
        
        if error:
            error_message = error
        
        if book_data:
            # First try cover_edition_key if available
            if "cover_edition_key" in book_data:
                cover_edition_key = book_data["cover_edition_key"]
                print(f"Found cover edition key: {cover_edition_key}")
                
                # Fetch ISBN data
                isbn_10, isbn_13, isbn_error = fetch_isbn_data(cover_edition_key)
                
                if isbn_error:
                    error_message = isbn_error
            
            # If no ISBNs found and work key is available, try that
            if (not isbn_10 and not isbn_13) and "key" in book_data:
                print(f"Trying work key from book data: {book_data['key']}")
                
                # Last resort: Scrape the HTML page
                work_url = f"https://openlibrary.org{book_data['key']}"
                html_isbn_10, html_isbn_13 = extract_isbns_from_html(work_url)
                
                if html_isbn_10 or html_isbn_13:
                    isbn_10 = html_isbn_10 or isbn_10
                    isbn_13 = html_isbn_13 or isbn_13
        
        # If no ISBNs found, try alternative endpoint
        if not isbn_10 and not isbn_13:
            print(f"No ISBNs found for {title}, trying alternative endpoint...")
            isbn_10, isbn_13, alt_error = fetch_alternative_book_data(title, author)
            
            if alt_error:
                error_message = alt_error
        
        # Record success if either ISBN is found
        if isbn_10 or isbn_13:
            success_count += 1
            print(f"Successfully retrieved ISBNs for {title}")
        else:
            if not error_message:
                error_message = f"Failed to retrieve ISBNs for {title}"
            print(error_message)
        
        # Add to enriched books list
        enriched_books.append([author, title, isbn_10, isbn_13, error_message])
        
        # Be nice to the API - small delay between requests
        time.sleep(1)
    
    # Write to new CSV
    with open(output_file, 'w', newline='', encoding='utf-8') as csvfile:
        writer = csv.writer(csvfile)
        writer.writerow(['Author', 'Title', 'ISBN-10', 'ISBN-13', 'Error'])
        writer.writerows(enriched_books)
    
    # Calculate and log success percentage
    success_percentage = (success_count / total_books) * 100 if total_books > 0 else 0
    print(f"\nProcessing complete. Results written to {output_file}")
    print(f"ISBN retrieval success rate: {success_count} out of {total_books} books ({success_percentage:.2f}%)")

if __name__ == "__main__":
    process_books()
