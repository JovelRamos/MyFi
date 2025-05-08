import requests
import time
import re

def get_book_reviews(book_id, page=1, output_file=None):
    url = f"https://app.thestorygraph.com/book_reviews/{book_id}"
    
    # Add timestamp parameter similar to the original request
    current_timestamp = int(time.time() * 1000)  # Current time in milliseconds
    params = {
        'page': page,
        '_': str(current_timestamp)
    }
    
    headers = {
        'Host': 'app.thestorygraph.com',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:138.0) Gecko/20100101 Firefox/138.0',
        'Accept': 'text/javascript, application/javascript, application/ecmascript, application/x-ecmascript, */*; q=0.01',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br, zstd',
        'Referer': f'https://app.thestorygraph.com/book_reviews/{book_id}',
        'X-CSRF-Token': 'z6KV0aagO5Xl0QKh2QWAhibU-HOcGdfTemAzYiRdwDCaMR42g2EdOc7p1UxoHUHLGdhHQoBqxvlrhGtXM3LiHg',
        'X-Requested-With': 'XMLHttpRequest',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin',
        'Connection': 'keep-alive',
        'TE': 'trailers'
    }
    
    cookies = {
        'cf_clearance': 'C3Gbh8M_UbLXevI51HYteRqVS83x7xbc9IuuXknnfy8-1746209107-1.2.1.1-Yb2Yyc39iObEm1KeOFQNBnQn3u64q4kck813uDkwrX8co9cWdL7grU5J5PzJIyWm3hDNOX9igsDmzBNC5y5DeCYh.7sBYavDyObXXfdPBtFhjH9GfehpB2cj2NQbI.Jlp797QklaM2Hbvc1Sbbop8RC9me9EUXqTjOgzpcSLr8y0LxwpwO7dQayw6CSm1uYP6MyNMS4OjaFn_kN7A3WAKjwyq02ie_cPDgQpLhcSyBh1_j.y5QMIPm1eLWRtup9XLVPid7JdHns2i5jHuApQb8jZGCt6hgv9FgFy_vDwLNwd3qpQbraUzUeXExam4D6PPANCrWw1E5JCj3zQf6IpecvZn5KkOzSVWJBOQbbDzDN0ZeO4KvCHKFLmRRTvpNEa',
        '_storygraph_session': '7lpM%2BIhUQfVB1%2BWaPGpW1ZpYrEAfeuZYUoDwRdCHBwxSDZjjpc9ymP2JmPzMaKd6DmtrDoWGuB8pC%2BcYEcPEA%2BG1YRj4OE%2FA8QTy8YX1aZq7yftX8ugAFtpnX4kev3JBT4jHM6j%2FYkdmdLpYgDmRoJ1dO48ukGA1%2FiIsR%2B02c2k1w1uA4WuoggAEcGA2ApaSLTMXPLmnppmAlN6ASeWbQcxPnMBYs8yJ868SwI%2FjC11eMcXEcrLyJ%2F36bTXTE1CsI5jIhhemkOhJLk8EeuLBhKXcf0KTqthLXNukOfEi2erWDhN3jPNUssQFpr2pbkDTAnpxMtphl4kPlEPGB0sEtdcixsZ54zcblh1Ebpqw2t2CPWxHL9SdiXLQ8wTihZo%2BisnrMcYLAkCc4dQd1idgXOffTeU7ZhB%2BY3QNZaxRLjis3lgGP1b7mpRS4VUrwX91H%2BySzvyCVbOPtM25D%2FEq45gXliHbq0Mio9NNhB3oaYDYpGDttgAI5o427jm21tl%2BO5iGeYWH28anVjbJbRA3peFmrr5y90ic6GzCwjyf2qWvnXpPKGO1D8VvDScpJb7cJqHASVW24IDyJdJIlVr518C%2Fk0Wx--vkuioLUbyaihqj21--T1UM0XZldErpycUJ5jmQiw%3D%3D',
        'remember_user_token': 'eyJfcmFpbHMiOnsibWVzc2FnZSI6Ilcxc2lNREEzTURWbU5Ua3RNbUpoTXkwMFpEWmxMVGcxT1dVdE1qbGpOVGcyTjJZM09HUXdJbDBzSWlReVlTUXhNU1JhVEhCdVpsVnhjUzlrTWpVMlNuUlBhM1JUYmxsUElpd2lNVGMwTmpJd09UazFNeTQ1T0RJMk5qUTJJbDA9IiwiZXhwIjoiMjA0NS0wNS0wMlQxODoxOToxMy45ODJaIiwicHVyIjoiY29va2llLnJlbWVtYmVyX3VzZXJfdG9rZW4ifX0%3D--ee56488e93d85d76b000ee99b4e33683f054f1c6'
    }
    
    print(f"Fetching reviews for book ID {book_id}, page {page}...")
    response = requests.get(url, params=params, headers=headers, cookies=cookies)
    
    if response.status_code == 200:
        print(f"Request successful with status code: {response.status_code}")
        
        # Use very specific regex patterns for the exact structure in the response
        
        # For usernames:
        # Look for patterns like: href="/profile/USERNAME">USERNAME</a>&#39;s review
        # Use raw string to properly handle backslashes
        username_pattern = r'href=\\"\/profile\/([^"\\]+)\\"[^>]*>([^<]+)<\\/a>&#39;s review'
        username_matches = re.findall(username_pattern, response.text)
        
        # For ratings:
        # Look for ratings in the format like: <span class="...">4.5</span>
        rating_pattern = r'<span class=\\"text-sm sm:text-base pt-0\\\.5 sm:pt-1 -ml-1 font-semibold text-darkerGrey dark:text-darkGrey\\">(\d+(?:\.\d+)?)<\\/span>'
        rating_matches = re.findall(rating_pattern, response.text)
        
        # Look for aria-label patterns too as a backup
        aria_label_pattern = r'aria-label=\\"Book rating: ([\d\.]+) out of 5\\"'
        aria_rating_matches = re.findall(aria_label_pattern, response.text)
        
        # Print results
        if username_matches:
            print(f"\nFound {len(username_matches)} usernames:")
            for i, (profile_id, username) in enumerate(username_matches, 1):
                print(f"{i}. {username} (profile ID: {profile_id})")
        else:
            print("\nNo usernames found with the pattern.")
            
            # If primary pattern failed, try a simpler fallback pattern
            fallback_username_pattern = r'\/profile\/([^\"\\]+)[^>]*>([^<]+)<'
            fallback_matches = re.findall(fallback_username_pattern, response.text)
            if fallback_matches:
                print(f"Found {len(fallback_matches)} usernames with fallback pattern:")
                for i, (profile_id, username) in enumerate(fallback_matches, 1):
                    print(f"{i}. {username} (profile ID: {profile_id})")
                username_matches = fallback_matches
        
        # Combine the rating matches
        all_ratings = rating_matches + [r for r in aria_rating_matches if r not in rating_matches]
        
        if all_ratings:
            print(f"\nFound {len(all_ratings)} ratings:")
            for i, rating in enumerate(all_ratings, 1):
                print(f"Rating {i}: {rating}")
        else:
            print("\nNo ratings found with the patterns.")
            
        # Match usernames with ratings
        reviews = []
        for i in range(min(len(username_matches), len(all_ratings))):
            reviews.append({
                'profile_id': username_matches[i][0],
                'username': username_matches[i][1],
                'rating': all_ratings[i]
            })
        
        if reviews:
            print(f"\nMatched {len(reviews)} reviews:")
            for i, review in enumerate(reviews, 1):
                print(f"{i}. {review['username']} (profile: {review['profile_id']}), Rating: {review['rating']}")
        else:
            print("\nNo reviews could be matched.")
            
        # SAVE ALL DISTINCT PATTERNS FOR DEBUGGING
        if output_file:
            debug_file = output_file.replace('.txt', '_patterns.txt')
            with open(debug_file, 'w', encoding='utf-8') as f:
                # Find all patterns that might be usernames or profiles
                potential_profiles = re.findall(r'profile\/[^\"\\]+', response.text)
                f.write("POTENTIAL PROFILES:\n")
                for p in set(potential_profiles):
                    f.write(f"{p}\n")
                
                # Find all rating-like patterns
                potential_ratings = re.findall(r'>\d+\.\d+<', response.text)
                f.write("\nPOTENTIAL RATINGS:\n")
                for r in set(potential_ratings):
                    f.write(f"{r}\n")
                
                # Save 10 representative chunks for analysis
                f.write("\nREPRESENTATIVE CHUNKS:\n")
                chunks = re.findall(r'<div class=\\"[^"]*?flex[^"]*?\\">.*?<\/div>', response.text, re.DOTALL)
                for i, chunk in enumerate(chunks[:10], 1):
                    f.write(f"\nCHUNK {i}:\n{chunk}\n{'='*40}\n")
            
            print(f"Saved pattern debug information to {debug_file}")
    else:
        print(f"Request failed with status code: {response.status_code}")
    
    # If output file is provided, save the response
    if output_file:
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(f"Status Code: {response.status_code}\n\n")
            f.write("--- Headers ---\n")
            for key, value in response.headers.items():
                f.write(f"{key}: {value}\n")
            f.write("\n--- Content ---\n")
            f.write(response.text)
        print(f"\nResponse saved to {output_file}")
    
    return response

def scrape_multiple_pages(book_id, start_page=1, end_page=3, output_prefix="storygraph_book"):
    """
    Scrape multiple pages of reviews for a given book.
    
    Args:
        book_id (str): The book ID to scrape reviews for
        start_page (int): Page to start scraping from
        end_page (int): Page to end scraping at (inclusive)
        output_prefix (str): Prefix for output files
    """
    print(f"Starting to scrape reviews for book {book_id} from pages {start_page} to {end_page}")
    
    for page in range(start_page, end_page + 1):
        output_file = f"{output_prefix}_{book_id}_page_{page}.txt"
        print(f"\n{'='*50}")
        print(f"Processing page {page} of {end_page}")
        print(f"{'='*50}")
        
        response = get_book_reviews(book_id, page, output_file)
        
        # Add a delay between requests to be respectful to the server
        if page < end_page:
            delay = 2  # 2 seconds delay 
            print(f"Waiting {delay} seconds before next request...")
            time.sleep(delay)
    
    print("\nScraping completed!")

# Example usage
if __name__ == "__main__":
    # The Blade Itself by Joe Abercrombie
    book_id = "682d6d03-1728-4a87-8127-513a9a3a30e5"
    
    # Scrape a single page
    get_book_reviews(book_id, page=2, output_file=f"storygraph_book_{book_id}_page_2.txt")
    
    # Or scrape multiple pages
    # scrape_multiple_pages(book_id, start_page=1, end_page=3)
