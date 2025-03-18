import csv
import requests
import urllib.parse
import time
import os
import re
import json
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
    debug_info = {
        "search_url": None,
        "search_response_status": None,
        "result_count": 0,
        "match_type": None,
        "matching_doc": None
    }
    
    # URL encode the title for the API request
    encoded_title = urllib.parse.quote(title)
    url = f"https://openlibrary.org/search.json?title={encoded_title}"
    debug_info["search_url"] = url
    
    response = requests.get(url)
    debug_info["search_response_status"] = response.status_code
    
    if response.status_code != 200:
        error_msg = f"Error fetching data for {title}: {response.status_code}"
        print(error_msg)
        return None, error_msg, debug_info
    
    data = response.json()
    
    if "docs" not in data or len(data["docs"]) == 0:
        error_msg = f"No results found for {title}"
        print(error_msg)
        debug_info["result_count"] = 0
        return None, error_msg, debug_info
    
    debug_info["result_count"] = len(data["docs"])
    
    # Look for a doc that matches both title and author
    best_match = None
    highest_score = 0
    
    for doc in data["docs"]:
        if "author_name" in doc and "title" in doc:
            # Check if both title and author match
            if title_match(title, doc["title"]) and author_match(author, doc["author_name"]):
                # For exact matches, return immediately
                if normalize_text(title) == normalize_text(doc["title"]):
                    debug_info["match_type"] = "exact_title_and_author_match"
                    debug_info["matching_doc"] = doc
                    return doc, None, debug_info
                
                # Calculate a match score for potential matches
                score = similarity_score(normalize_text(title), normalize_text(doc["title"]))
                if score > highest_score:
                    highest_score = score
                    best_match = doc
    
    # If we found a good match, return it
    if best_match:
        debug_info["match_type"] = "fuzzy_title_and_author_match"
        debug_info["matching_doc"] = best_match
        debug_info["match_score"] = highest_score
        return best_match, None, debug_info
    
    # Try searching by just the title if no author match was found
    for doc in data["docs"]:
        if "title" in doc and title_match(title, doc["title"], threshold=0.95):
            debug_info["match_type"] = "title_match_only"
            debug_info["matching_doc"] = doc
            print(f"Found title match but no author match for {title}. Using best title match.")
            return doc, None, debug_info
    
    error_msg = f"No acceptable match found for {title} by {author}"
    debug_info["match_type"] = "no_match"
    print(error_msg)
    return None, error_msg, debug_info

def extract_isbns_from_html(work_url):
    """Extract ISBNs by scraping the OpenLibrary work page."""
    debug_info = {
        "method": "html_scraping",
        "url": work_url,
        "response_status": None
    }
    
    try:
        response = requests.get(work_url)
        debug_info["response_status"] = response.status_code
        
        if response.status_code != 200:
            debug_info["error"] = f"HTTP {response.status_code}"
            return None, None, debug_info
        
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Look for ISBN-10
        isbn_10 = None
        isbn_10_dt = soup.find('dt', string='ISBN 10')
        if isbn_10_dt:
            isbn_10_dd = isbn_10_dt.find_next_sibling('dd', class_='object', itemprop='isbn')
            if isbn_10_dd:
                isbn_10 = isbn_10_dd.text.strip()
                debug_info["isbn_10_found"] = True
        
        # Look for ISBN-13
        isbn_13 = None
        isbn_13_dt = soup.find('dt', string='ISBN 13')
        if isbn_13_dt:
            isbn_13_dd = isbn_13_dt.find_next_sibling('dd', class_='object', itemprop='isbn')
            if isbn_13_dd:
                isbn_13 = isbn_13_dd.text.strip()
                debug_info["isbn_13_found"] = True
        
        debug_info["success"] = isbn_10 is not None or isbn_13 is not None
        
        return isbn_10, isbn_13, debug_info
    except Exception as e:
        debug_info["error"] = str(e)
        print(f"Error scraping HTML: {e}")
        return None, None, debug_info

def fetch_work_data(work_key):
    """Fetch book data using the work key."""
    debug_info = {
        "method": "work_data",
        "work_key": work_key,
        "url": None,
        "response_status": None
    }
    
    url = f"https://openlibrary.org{work_key}.json"
    debug_info["url"] = url
    
    response = requests.get(url)
    debug_info["response_status"] = response.status_code
    
    if response.status_code != 200:
        debug_info["error"] = f"HTTP {response.status_code}"
        print(f"Error fetching work data for {work_key}: {response.status_code}")
        return None, None, debug_info
    
    data = response.json()
    debug_info["has_links"] = "links" in data
    
    # Work data typically doesn't contain ISBNs directly
    # But it might have links to editions that do
    if "links" in data:
        links_processed = []
        for link in data["links"]:
            link_info = {
                "url": link.get("url"),
                "title": link.get("title")
            }
            links_processed.append(link_info)
            
            if "url" in link and "title" in link and "edition" in link.get("title", "").lower():
                edition_url = link["url"]
                debug_info["edition_link_found"] = True
                debug_info["edition_url"] = edition_url
                # If it's an internal OpenLibrary link, fetch it
                if edition_url.startswith("/books/"):
                    isbn_10, isbn_13, edition_debug = fetch_isbn_data(edition_url.split("/")[-1].rstrip(".json"))
                    debug_info["edition_result"] = edition_debug
                    return isbn_10, isbn_13, debug_info
        
        debug_info["processed_links"] = links_processed
    
    debug_info["success"] = False
    return None, None, debug_info

def fetch_isbns_from_work_editions(work_key, title):
    """
    Fetch ISBNs from work editions API endpoint.
    
    Args:
        work_key (str): OpenLibrary work key
        title (str): Book title to match against
    
    Returns:
        tuple: (isbn_10, isbn_13, debug_info)
    """
    debug_info = {
        "method": "work_editions",
        "work_key": work_key,
        "title": title,
        "url": None,
        "response_status": None,
        "entries_count": 0,
        "matching_entries_found": False
    }
    
    url = f"https://openlibrary.org{work_key}/editions.json"
    debug_info["url"] = url
    print(f"Fetching editions from: {url}")
    
    try:
        response = requests.get(url)
        debug_info["response_status"] = response.status_code
        
        if response.status_code != 200:
            debug_info["error"] = f"HTTP {response.status_code}"
            print(f"Error fetching editions: {response.status_code}")
            return None, None, debug_info
        
        data = response.json()
        if "entries" not in data or not data["entries"]:
            debug_info["error"] = "No entries found"
            print("No entries found in editions data")
            return None, None, debug_info
        
        debug_info["entries_count"] = len(data["entries"])
        
        # Normalize the title for matching
        normalized_title = normalize_text(title)
        
        # First try to find editions that match the title
        for i, entry in enumerate(data["entries"]):
            entry_info = {
                "title": entry.get("title"),
                "has_isbn_10": "isbn_10" in entry and bool(entry["isbn_10"]),
                "has_isbn_13": "isbn_13" in entry and bool(entry["isbn_13"]),
                "title_match": False
            }
            
            if "title" in entry and title_match(title, entry["title"]):
                entry_info["title_match"] = True
                debug_info["matching_entries_found"] = True
                
                # Check for ISBNs
                isbn_10 = entry.get("isbn_10", [None])[0] if "isbn_10" in entry and entry["isbn_10"] else None
                isbn_13 = entry.get("isbn_13", [None])[0] if "isbn_13" in entry and entry["isbn_13"] else None
                
                if isbn_10 or isbn_13:
                    entry_info["isbn_10"] = isbn_10
                    entry_info["isbn_13"] = isbn_13
                    debug_info[f"matching_entry_{i}"] = entry_info
                    debug_info["success"] = True
                    print(f"Found matching edition with ISBNs: {isbn_10 or 'None'}, {isbn_13 or 'None'}")
                    return isbn_10, isbn_13, debug_info
                
                debug_info[f"matching_entry_{i}"] = entry_info
        
        # If no matching title found, just take the first entry with ISBNs
        for i, entry in enumerate(data["entries"]):
            entry_info = {
                "title": entry.get("title"),
                "has_isbn_10": "isbn_10" in entry and bool(entry["isbn_10"]),
                "has_isbn_13": "isbn_13" in entry and bool(entry["isbn_13"]),
                "title_match": False
            }
            
            isbn_10 = entry.get("isbn_10", [None])[0] if "isbn_10" in entry and entry["isbn_10"] else None
            isbn_13 = entry.get("isbn_13", [None])[0] if "isbn_13" in entry and entry["isbn_13"] else None
            
            if isbn_10 or isbn_13:
                entry_info["isbn_10"] = isbn_10
                entry_info["isbn_13"] = isbn_13
                debug_info[f"first_entry_with_isbn_{i}"] = entry_info
                debug_info["success"] = True
                debug_info["note"] = "Used first available entry with ISBNs (no title match)"
                print(f"Using first available edition with ISBNs: {isbn_10 or 'None'}, {isbn_13 or 'None'}")
                return isbn_10, isbn_13, debug_info
            
            if i < 3:  # Store just the first few entries for debugging
                debug_info[f"entry_{i}"] = entry_info
        
        debug_info["error"] = "No editions with ISBNs found"
        print("No editions with ISBNs found")
        return None, None, debug_info
            
    except Exception as e:
        debug_info["error"] = str(e)
        print(f"Error processing editions data: {str(e)}")
        return None, None, debug_info


def fetch_isbn_data(cover_edition_key):
    """
    Fetch ISBN data using the cover edition key with multiple fallback methods.
    Returns tuple: (isbn_10, isbn_13, error_message, debug_info)
    """
    debug_info = {
        "method": "cover_edition_key",
        "cover_edition_key": cover_edition_key,
        "url": None,
        "isbn_source": None,
        "fallback_methods_used": []
    }
    
    # First attempt: Direct edition lookup
    url = f"https://openlibrary.org/books/{cover_edition_key}.json"
    debug_info["url"] = url
    
    response = requests.get(url)
    debug_info["response_status"] = response.status_code
    
    if response.status_code != 200:
        error_msg = f"Error fetching ISBN data for {cover_edition_key}: {response.status_code}"
        debug_info["error"] = error_msg
        print(error_msg)
        return None, None, error_msg, debug_info
    
    data = response.json()
    debug_info["edition_data_keys"] = list(data.keys())
    
    isbn_10 = None
    isbn_13 = None
    
    # Check for ISBNs in the edition data
    if "isbn_10" in data and data["isbn_10"]:
        isbn_10 = data["isbn_10"][0]
        debug_info["isbn_10_found_in_edition"] = True
    
    if "isbn_13" in data and data["isbn_13"]:
        isbn_13 = data["isbn_13"][0]
        debug_info["isbn_13_found_in_edition"] = True
    
    # If ISBNs found, return them
    if isbn_10 or isbn_13:
        debug_info["isbn_source"] = "direct_edition_lookup"
        return isbn_10, isbn_13, None, debug_info
    
    # Second attempt: Use the work key if available
    if "works" in data and len(data["works"]) > 0:
        work_key = data["works"][0]["key"]
        debug_info["work_key"] = work_key
        debug_info["fallback_methods_used"].append("work_key")
        print(f"No ISBNs in edition data, trying work key: {work_key}")
        
        # Fetch data using the work key
        work_isbn_10, work_isbn_13, work_debug = fetch_work_data(work_key)
        debug_info["work_method_debug"] = work_debug
        
        if work_isbn_10 or work_isbn_13:
            debug_info["isbn_source"] = "work_data"
            return work_isbn_10, work_isbn_13, None, debug_info
        
        # Second-to-last resort: Fetch editions data from work editions API
        if "title" in data:
            debug_info["fallback_methods_used"].append("work_editions_api")
            print(f"Trying to fetch ISBNs from work editions API")
            editions_isbn_10, editions_isbn_13, editions_debug = fetch_isbns_from_work_editions(work_key, data["title"])
            debug_info["work_editions_debug"] = editions_debug
            
            if editions_isbn_10 or editions_isbn_13:
                debug_info["isbn_source"] = "work_editions_api"
                return editions_isbn_10, editions_isbn_13, None, debug_info
        
        # Last resort: Scrape the HTML page
        debug_info["fallback_methods_used"].append("html_scraping")
        print(f"No ISBNs in work API data, attempting to scrape HTML page")
        work_url = f"https://openlibrary.org{work_key}"
        html_isbn_10, html_isbn_13, html_debug = extract_isbns_from_html(work_url)
        debug_info["html_scraping_debug"] = html_debug
        
        if html_isbn_10 or html_isbn_13:
            debug_info["isbn_source"] = "html_scraping"
            return html_isbn_10, html_isbn_13, None, debug_info
    
    debug_info["error"] = "No ISBNs found after all attempts"
    return None, None, "No ISBNs found after all attempts", debug_info

def fetch_alternative_book_data(title, author):
    """Try alternative API endpoint for book data with multiple fallback methods."""
    debug_info = {
        "method": "alternative_search",
        "query": f"{title} {author}",
        "url": None,
        "response_status": None,
        "result_count": 0,
        "fallback_methods_used": [],
        "match_found": False
    }
    
    # URL encode both title and author for a more specific search
    encoded_query = urllib.parse.quote(f"{title} {author}")
    url = f"https://openlibrary.org/search.json?q={encoded_query}"
    debug_info["url"] = url
    
    response = requests.get(url)
    debug_info["response_status"] = response.status_code
    
    if response.status_code != 200:
        error_msg = f"Error fetching alternative data for {title}: {response.status_code}"
        debug_info["error"] = error_msg
        print(error_msg)
        return None, None, error_msg, debug_info
    
    data = response.json()
    
    if "docs" not in data or len(data["docs"]) == 0:
        error_msg = f"No results found in alternative search for {title}"
        debug_info["error"] = error_msg
        print(error_msg)
        return None, None, error_msg, debug_info
    
    debug_info["result_count"] = len(data["docs"])
    
    isbn_10 = None
    isbn_13 = None
    
    # Look for a doc that matches both title and author
    for i, doc in enumerate(data["docs"]):
        doc_info = {
            "title": doc.get("title"),
            "authors": doc.get("author_name"),
            "title_match": False,
            "author_match": False
        }
        
        if "author_name" in doc and "title" in doc:
            title_matches = title_match(title, doc["title"])
            author_matches = author_match(author, doc["author_name"])
            doc_info["title_match"] = title_matches
            doc_info["author_match"] = author_matches
            
            if title_matches and author_matches:
                debug_info["match_found"] = True
                doc_info["methods_available"] = []
                
                # First attempt: If we have cover_edition_key, use it to get ISBNs
                if "cover_edition_key" in doc:
                    doc_info["cover_edition_key"] = doc["cover_edition_key"]
                    doc_info["methods_available"].append("cover_edition_key")
                    debug_info["fallback_methods_used"].append("cover_edition_key")
                    
                    isbn_10, isbn_13, _, edition_debug = fetch_isbn_data(doc["cover_edition_key"])
                    doc_info["edition_method_result"] = edition_debug
                    
                    if isbn_10 or isbn_13:
                        debug_info[f"matching_doc_{i}"] = doc_info
                        debug_info["isbn_source"] = "cover_edition_key"
                        return isbn_10, isbn_13, None, debug_info
                
                # Second attempt: Check if doc directly contains ISBNs
                if "isbn" in doc and doc["isbn"]:
                    doc_info["methods_available"].append("direct_isbn")
                    doc_info["has_isbns"] = True
                    debug_info["fallback_methods_used"].append("direct_isbn")
                    
                    for isbn in doc["isbn"]:
                        if len(isbn) == 10 and not isbn_10:
                            isbn_10 = isbn
                            doc_info["isbn_10_found"] = True
                        elif len(isbn) == 13 and not isbn_13:
                            isbn_13 = isbn
                            doc_info["isbn_13_found"] = True
                    
                    if isbn_10 or isbn_13:
                        debug_info[f"matching_doc_{i}"] = doc_info
                        debug_info["isbn_source"] = "direct_isbn"
                        return isbn_10, isbn_13, None, debug_info
                
                # Third attempt: Use the work key if available
                if "key" in doc:
                    work_key = doc["key"]
                    doc_info["work_key"] = work_key
                    doc_info["methods_available"].append("work_key")
                    debug_info["fallback_methods_used"].append("work_key")
                    print(f"Trying work key: {work_key}")
                    
                    # Fetch data using the work key
                    work_url = f"https://openlibrary.org{work_key}.json"
                    work_response = requests.get(work_url)
                    doc_info["work_response_status"] = work_response.status_code
                    
                    if work_response.status_code == 200:
                        work_data = work_response.json()
                        
                        # Look for editions in the work data
                        if "editions" in work_data:
                            doc_info["editions_count"] = len(work_data["editions"])
                            
                            for j, edition in enumerate(work_data["editions"]):
                                edition_key = edition["key"]
                                e_isbn_10, e_isbn_13, _, edition_debug = fetch_isbn_data(edition_key.split("/")[-1])
                                
                                if j < 2:  # Just store first few for debugging
                                    doc_info[f"edition_{j}_result"] = edition_debug
                                
                                if e_isbn_10 or e_isbn_13:
                                    debug_info[f"matching_doc_{i}"] = doc_info
                                    debug_info["isbn_source"] = "work_editions"
                                    return e_isbn_10, e_isbn_13, None, debug_info
                                
                    # Second-to-last resort: Fetch editions data from work editions API
                    debug_info["fallback_methods_used"].append("work_editions_api")
                    print(f"Trying to fetch ISBNs from work editions API")
                    editions_isbn_10, editions_isbn_13, editions_debug = fetch_isbns_from_work_editions(work_key, title)
                    doc_info["work_editions_api_result"] = editions_debug
                    
                    if editions_isbn_10 or editions_isbn_13:
                        debug_info[f"matching_doc_{i}"] = doc_info
                        debug_info["isbn_source"] = "work_editions_api"
                        return editions_isbn_10, editions_isbn_13, None, debug_info
                    
                    # Last resort: Scrape the HTML page
                    debug_info["fallback_methods_used"].append("html_scraping")
                    print(f"Attempting to scrape HTML page for {work_key}")
                    work_url = f"https://openlibrary.org{work_key}"
                    html_isbn_10, html_isbn_13, html_debug = extract_isbns_from_html(work_url)
                    doc_info["html_scraping_result"] = html_debug
                    
                    if html_isbn_10 or html_isbn_13:
                        debug_info[f"matching_doc_{i}"] = doc_info
                        debug_info["isbn_source"] = "html_scraping"
                        return html_isbn_10, html_isbn_13, None, debug_info
                
                debug_info[f"matching_doc_{i}"] = doc_info
            
            # Store info about first few docs for debugging
            if i < 3:
                debug_info[f"doc_{i}"] = doc_info
    
    error_msg = f"No matching ISBNs found in alternative search for {title} by {author}"
    debug_info["error"] = error_msg
    return None, None, error_msg, debug_info

def process_books():
    """Main function to process the books data."""
    input_file = "scifi_books.csv"
    output_file = "scifi_list_OL_debug.csv"
    
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
        debug_results = {
            "title": title,
            "author": author,
            "isbn_retrieval_method": None,
            "matching_procedure": None,
            "work_key": None,
            "cover_edition_key": None,
            "search_fallbacks_used": [],
            "success": False
        }
        
        # Fetch book data from OpenLibrary search endpoint
        book_data, error, search_debug = fetch_book_data(title, author)
        debug_results["initial_search_results"] = search_debug
        
        if error:
            error_message = error
        
        if book_data:
            # Record the match type
            debug_results["matching_procedure"] = search_debug.get("match_type")
            
            # First try cover_edition_key if available
            if "cover_edition_key" in book_data:
                cover_edition_key = book_data["cover_edition_key"]
                debug_results["cover_edition_key"] = cover_edition_key
                print(f"Found cover edition key: {cover_edition_key}")
                
                # Fetch ISBN data
                isbn_10, isbn_13, isbn_error, isbn_debug = fetch_isbn_data(cover_edition_key)
                debug_results["cover_edition_method_results"] = isbn_debug
                
                if isbn_10 or isbn_13:
                    debug_results["isbn_retrieval_method"] = isbn_debug.get("isbn_source")
                    debug_results["success"] = True
                
                if isbn_error:
                    error_message = isbn_error
                    debug_results["search_fallbacks_used"].extend(isbn_debug.get("fallback_methods_used", []))
            
            # If no ISBNs found and work key is available, try that
            if (not isbn_10 and not isbn_13) and "key" in book_data:
                work_key = book_data["key"]
                debug_results["work_key"] = work_key
                debug_results["search_fallbacks_used"].append("work_key_from_search")
                print(f"Trying work key from book data: {book_data['key']}")
                
                # Last resort: Scrape the HTML page
                work_url = f"https://openlibrary.org{book_data['key']}"
                html_isbn_10, html_isbn_13, html_debug = extract_isbns_from_html(work_url)
                debug_results["html_scraping_results"] = html_debug
                
                if html_isbn_10 or html_isbn_13:
                    isbn_10 = html_isbn_10 or isbn_10
                    isbn_13 = html_isbn_13 or isbn_13
                    debug_results["isbn_retrieval_method"] = "html_scraping"
                    debug_results["success"] = True
        
        # If no ISBNs found, try alternative endpoint
        if not isbn_10 and not isbn_13:
            debug_results["search_fallbacks_used"].append("alternative_search")
            print(f"No ISBNs found for {title}, trying alternative endpoint...")
            isbn_10, isbn_13, alt_error, alt_debug = fetch_alternative_book_data(title, author)
            debug_results["alternative_search_results"] = alt_debug
            
            if isbn_10 or isbn_13:
                debug_results["isbn_retrieval_method"] = alt_debug.get("isbn_source")
                debug_results["search_fallbacks_used"].extend(alt_debug.get("fallback_methods_used", []))
                debug_results["success"] = True
            
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
        
        # Convert debug_results to JSON string
        debug_json = json.dumps(debug_results, indent=2)
        
        # Add to enriched books list with debug info
        enriched_books.append([
            author, 
            title, 
            isbn_10, 
            isbn_13, 
            error_message, 
            debug_results.get("matching_procedure", "unknown"),
            debug_results.get("isbn_retrieval_method", "none"),
            debug_results.get("work_key", ""),
            debug_results.get("cover_edition_key", ""),
            ", ".join(debug_results.get("search_fallbacks_used", [])),
            "Yes" if debug_results.get("success", False) else "No",
            debug_json
        ])
        
        # Be nice to the API - small delay between requests
        time.sleep(1)
    
    # Write to new CSV
    with open(output_file, 'w', newline='', encoding='utf-8') as csvfile:
        writer = csv.writer(csvfile)
        writer.writerow([
            'Author', 'Title', 'ISBN-10', 'ISBN-13', 'Error', 
            'Matching Procedure', 'ISBN Retrieval Method', 
            'Work Key', 'Cover Edition Key', 'Fallbacks Used',
            'Success', 'Debug JSON'
        ])
        writer.writerows(enriched_books)
    
    # Calculate and log success percentage
    success_percentage = (success_count / total_books) * 100 if total_books > 0 else 0
    print(f"\nProcessing complete. Results written to {output_file}")
    print(f"ISBN retrieval success rate: {success_count} out of {total_books} books ({success_percentage:.2f}%)")

if __name__ == "__main__":
    process_books()
