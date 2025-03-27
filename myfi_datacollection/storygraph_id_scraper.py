import csv
import requests
from bs4 import BeautifulSoup
import time
import pandas as pd
import os
import re

#fails 'How to Live Safely in a Sci-Fi Universe' by Charles Yu
#fails 'The Butlerian Jihad' by Brian Herbert
#fails 'Dangerous Visions' by Harlan Ellison


def scrape_storygraph(title, author):
    """Send GET request to TheStoryGraph and extract book information."""
    search_term = f"{title}+{author}"
    url = f"https://app.thestorygraph.com/search?search_term={search_term}&button="
    
    try:
        # Add User-Agent header to mimic a browser
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        
        # Parse HTML
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Find the first book result (if any)
        book_item = soup.find('li', class_='book-list-item')
        
        if not book_item:
            return None, None, None
        
        # Extract book ID
        book_link = book_item.find('a', class_='list-option')
        book_id = None
        if book_link and 'href' in book_link.attrs:
            href = book_link['href']
            # Extract the ID from the href
            book_id = href.split('/')[-1] if href.startswith('/books/') else None
            
        # Extract title and author information
        title_span = book_item.find('span', class_='text-sm font-semibold list-option-text clamp-2')
        sg_title = title_span.text.strip() if title_span else None
        
        author_elem = book_item.find('h2', class_='text-sm list-option-text clamp-1')
        sg_author = author_elem.text.strip() if author_elem else None
        
        return sg_title, sg_author, book_id
        
    except requests.exceptions.RequestException as e:
        print(f"Error making request for {title} by {author}: {e}")
        return None, None, None
    except Exception as e:
        print(f"Error processing {title} by {author}: {e}")
        return None, None, None

def main():
    # Check if file exists
    if not os.path.exists('scifi_list_OL.csv'):
        print("Error: 'scifi_list_OL.csv' not found.")
        return
    
    # Read the CSV file
    df = pd.read_csv('scifi_list_OL.csv')
    
    # Check if required columns exist
    if 'Author' not in df.columns or 'Title' not in df.columns:
        print("Error: CSV must contain 'Author' and 'Title' columns.")
        return
    
    # Add new columns if they don't exist
    if 'OL_title' not in df.columns:
        df['OL_title'] = None
    if 'OL_library' not in df.columns:
        df['OL_library'] = None
    if 'OL_ID' not in df.columns:
        df['OL_ID'] = None
    
    # Process each row
    for index, row in df.iterrows():
        # Skip rows that already have StoryGraph data
        if pd.notna(row.get('OL_ID')) and row.get('OL_ID'):
            print(f"Skipping already processed {row['Title']} by {row['Author']}")
            continue
            
        print(f"Processing {row['Title']} by {row['Author']}...")
        
        # Clean the title and author for the URL
        title = re.sub(r'[^\w\s]', '', row['Title']).strip().replace(' ', '+')
        author = re.sub(r'[^\w\s]', '', row['Author']).strip().replace(' ', '+')
        
        # Get StoryGraph data
        sg_title, sg_author, book_id = scrape_storygraph(title, author)
        
        # Update DataFrame
        df.at[index, 'OL_title'] = sg_title
        df.at[index, 'OL_library'] = sg_author
        df.at[index, 'OL_ID'] = book_id
        
        # Save progress after each book (in case of interruption)
        df.to_csv('scifi_list_OL.csv', index=False)
        
        # Respect the server by waiting between requests
        time.sleep(2)
    
    print("Processing complete. Data saved to scifi_list_OL.csv")

if __name__ == "__main__":
    main()