import csv
import time
import os
import json
import argparse
from bs4 import BeautifulSoup
import requests
from tqdm import tqdm
import pymongo
import re
from datetime import datetime, timedelta
import random

class StoryGraphScraper:
    def __init__(self, csv_path, mongo_uri):
        """
        Initialize the scraper with configuration parameters.
        
        Args:
            csv_path: Path to the CSV file containing book IDs
            mongo_uri: MongoDB connection URI
        """
        self.csv_path = csv_path
        self.base_url = "https://app.thestorygraph.com/book_reviews/{}"
        self.request_delay = 2  # Fixed 2-second delay between requests
        
        # Headers to mimic a browser request
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Cache-Control': 'max-age=0'
        }
        
        # Connect to MongoDB
        try:
            self.client = pymongo.MongoClient(mongo_uri)
            # Test connection
            self.client.admin.command('ping')
            print("MongoDB connection successful")
            
            self.db = self.client["storygraph_data"]
            self.users_collection = self.db["users"]
            self.books_collection = self.db["books"]
            
            # Create indexes for better performance
            self.users_collection.create_index("username", unique=True)
            self.books_collection.create_index("book_id", unique=True)
            
        except Exception as e:
            print(f"MongoDB connection failed: {e}")
            raise
        
        # Load book IDs from CSV
        self.book_ids = self._load_book_ids()
        
        # Migrate data from scraping_progress to books if it exists
        self._migrate_progress_data()
        
    def _migrate_progress_data(self):
        """Migrate data from scraping_progress to books if the collection exists."""
        if "scraping_progress" in self.db.list_collection_names():
            print("Migrating scraping progress data to books collection...")
            progress_collection = self.db["scraping_progress"]
            
            # For each progress document, update the corresponding book document
            for progress in progress_collection.find():
                book_id = progress.get("book_id")
                if book_id:
                    self.books_collection.update_one(
                        {"book_id": book_id},
                        {"$set": {
                            "last_page": progress.get("last_page", 0),
                            "completed": progress.get("completed", False)
                        }},
                        upsert=True
                    )
            
            print("Migration completed")
        
    def _load_book_ids(self):
        """Load book IDs from the CSV file."""
        book_ids = []
        try:
            with open(self.csv_path, 'r', encoding='utf-8') as csvfile:
                reader = csv.DictReader(csvfile)
                for row in reader:
                    book_ids.append(row['OL_ID'])
            print(f"Loaded {len(book_ids)} book IDs from {self.csv_path}")
            return book_ids
        except Exception as e:
            print(f"Error loading book IDs from CSV: {e}")
            return []
    
    def get_scraped_books(self):
        """Get list of books that have been fully scraped."""
        completed_books = self.books_collection.distinct("book_id", {"completed": True})
        return completed_books
        
    def get_book_progress(self, book_id):
        """Get progress for a specific book."""
        book = self.books_collection.find_one({"book_id": book_id})
        if not book:
            return {"book_id": book_id, "last_page": 0, "completed": False}
        
        return {
            "book_id": book_id,
            "last_page": book.get("last_page", 0),
            "completed": book.get("completed", False)
        }
    
    def update_book_progress(self, book_id, last_page, completed=False):
        """Update progress for a specific book."""
        self.books_collection.update_one(
            {"book_id": book_id},
            {"$set": {"last_page": last_page, "completed": completed}},
            upsert=True
        )
    
    def scrape_ratings_page(self, book_id, page=1):
        """
        Scrape a single page of ratings for a book by parsing the network response.
        
        Returns:
            tuple: (ratings_list, has_next_page)
        """
        url = f"{self.base_url.format(book_id)}?page={page}"
        
        try:
            # Make the request with our headers
            response = requests.get(url, headers=self.headers, timeout=30)
            response.raise_for_status()  # Raise exception for bad status codes
            
            # Get the HTML content
            html_content = response.text
            
            # Parse the HTML
            soup = BeautifulSoup(html_content, 'html.parser')
            
            # Extract ratings
            ratings = []
            
            # Find the review panes
            review_panes = soup.select('.standard-pane')
            print(f"Found {len(review_panes)} review panes on page {page}")
            
            for pane in review_panes:
                try:
                    # Extract username - look for the profile link in the heading
                    username_elem = pane.select_one('a.standard-link[href^="/profile/"]')
                    
                    if username_elem:
                        # Extract username from href attribute
                        href = username_elem.get('href', '')
                        username = href.replace('/profile/', '') if '/profile/' in href else None
                        
                        # Extract rating from the paragraph with the star icon
                        rating_elem = pane.select_one('p.mb-2:has(svg.icon-star)')
                        
                        if rating_elem:
                            # Get text content and clean it
                            rating_text = rating_elem.get_text(strip=True)
                            try:
                                # Extract the rating value (first part of text)
                                rating_value = float(rating_text.strip().split()[0])
                                
                                # Add to ratings list
                                ratings.append({
                                    "username": username,
                                    "rating": rating_value,
                                    "book_id": book_id,
                                    "page": page
                                })
                            except (ValueError, IndexError):
                                pass
                except Exception as e:
                    print(f"Error processing a review: {e}")
            
            # Check for pagination - look for a "next" link
            next_page_link = soup.select_one('.pagination a[rel="next"]')
            has_next_page = next_page_link is not None
            
            # Set completed status based on number of reviews (0 means we've reached the end)
            completed = len(ratings) == 0
            
            return ratings, has_next_page, completed
            
        except requests.RequestException as e:
            print(f"Error accessing {url}: {e}")
            return [], False, True  # Mark as completed on error to prevent endless retries
        
    def batch_scrape(self, max_books_per_day=20, max_pages_per_book=None, 
                    delay_between_books=120, start_from_book=None):
        """
        Scrape multiple books with rate limiting.
        
        Args:
            max_books_per_day: Maximum number of books to scrape per day
            max_pages_per_book: Maximum pages to scrape per book (None for all)
            delay_between_books: Delay in seconds between books (minimum 60 seconds)
            start_from_book: Book ID to start from (useful for resuming)
        """
        # Ensure minimum delay between books
        if delay_between_books < 60:
            delay_between_books = 60
            print("Setting minimum delay between books to 60 seconds")
            
        # Get all books that need to be scraped or continued
        books_to_scrape = []
        start_processing = False if start_from_book else True
        
        print("Analyzing books to scrape...")
        for book_id in self.book_ids:
            # If start_from_book is specified, skip books until we find it
            if start_from_book and not start_processing:
                if book_id == start_from_book:
                    start_processing = True
                else:
                    continue
            
            # Get the book's progress
            progress = self.get_book_progress(book_id)
            
            # If the book is not completed, add it to our list
            if not progress["completed"]:
                books_to_scrape.append(book_id)
        
        print(f"Found {len(books_to_scrape)} books to process")
        
        # If no books to scrape, exit
        if not books_to_scrape:
            print("No books to scrape. All books may be completed.")
            return
        
        # Calculate how many days this will take
        estimated_days = len(books_to_scrape) / max_books_per_day
        print(f"Estimated time to complete: {estimated_days:.1f} days")
        print(f"Processing {max_books_per_day} books per day with {delay_between_books} seconds between books")
        
        # Create a progress bar for the entire process
        with tqdm(total=len(books_to_scrape), desc="Overall Progress", unit="book") as overall_pbar:
            books_today = 0
            day_start = datetime.now()
            
            for book_id in books_to_scrape:
                # Check if we've hit our daily limit
                now = datetime.now()
                day_elapsed = (now - day_start).total_seconds() / 3600  # in hours
                
                if books_today >= max_books_per_day and day_elapsed < 24:
                    # Calculate time to wait until next day
                    hours_to_wait = 24 - day_elapsed
                    wait_seconds = hours_to_wait * 3600
                    
                    print(f"\nReached limit of {max_books_per_day} books for today.")
                    print(f"Waiting {hours_to_wait:.1f} hours before continuing...")
                    
                    # Sleep until tomorrow
                    time.sleep(wait_seconds)
                    
                    # Reset counters for the new day
                    books_today = 0
                    day_start = datetime.now()
                
                # Scrape the book
                print(f"\nProcessing book {book_id} ({books_today+1}/{max_books_per_day} for today)")
                try:
                    self.scrape_book(book_id, max_pages_per_book)
                    books_today += 1
                    overall_pbar.update(1)
                except Exception as e:
                    print(f"Error scraping book {book_id}: {e}")
                    # Continue with next book despite errors
                
                # Add jitter to delay between books (±30%)
                jitter = random.uniform(0.7, 1.3)
                actual_delay = delay_between_books * jitter
                
                if books_today < max_books_per_day and book_id != books_to_scrape[-1]:
                    print(f"Waiting {actual_delay:.1f} seconds before the next book...")
                    time.sleep(actual_delay)

    
    def save_ratings_to_mongodb(self, ratings):
        """Save ratings to MongoDB using the new structure."""
        if not ratings:
            return 0
        
        saved_count = 0
        for rating_data in ratings:
            try:
                # Extract data from rating
                username = rating_data["username"]
                book_id = rating_data["book_id"]
                rating = rating_data["rating"]
                
                # Create rating object
                rating_obj = {
                    "book_id": book_id,
                    "rating": rating
                }
                
                # Check if user already has this book rated
                existing_user = self.users_collection.find_one(
                    {
                        "username": username, 
                        "book_ratings.book_id": book_id
                    }
                )
                
                current_time = datetime.now().isoformat()
                
                if existing_user:
                    # Update existing rating
                    result = self.users_collection.update_one(
                        {
                            "username": username, 
                            "book_ratings.book_id": book_id
                        },
                        {
                            "$set": {
                                "last_active": current_time,
                                "book_ratings.$": rating_obj
                            }
                        }
                    )
                else:
                    # Add new rating to user's array
                    result = self.users_collection.update_one(
                        {"username": username},
                        {
                            "$set": {"last_active": current_time},
                            "$push": {"book_ratings": rating_obj}
                        },
                        upsert=True
                    )
                
                # Update book statistics
                self.update_book_stats(book_id, rating)
                
                if result.upserted_id or result.modified_count:
                    saved_count += 1
                    
            except pymongo.errors.PyMongoError as e:
                print(f"Database error when saving rating: {e}")
        
        return saved_count

    def update_book_stats(self, book_id, new_rating):
        """Update book statistics with new rating."""
        try:
            # Find the book document
            book = self.books_collection.find_one({"book_id": book_id})
            
            if book:
                # Calculate new average rating
                current_avg = book.get("avg_rating", 0)
                current_total = book.get("total_ratings", 0)
                new_total = current_total + 1
                new_avg = ((current_avg * current_total) + new_rating) / new_total
                
                # Update book document
                self.books_collection.update_one(
                    {"book_id": book_id},
                    {
                        "$set": {
                            "avg_rating": new_avg,
                            "total_ratings": new_total
                        }
                    }
                )
            else:
                # Create new book document
                self.books_collection.insert_one({
                    "book_id": book_id,
                    "avg_rating": new_rating,
                    "total_ratings": 1,
                    "last_page": 0,
                    "completed": False
                })
        except Exception as e:
            print(f"Error updating book stats: {e}")
    
    def scrape_book(self, book_id, max_pages=None):
        """
        Scrape ratings for a specific book.
        
        Args:
            book_id: The book ID to scrape
            max_pages: Maximum number of pages to scrape (None for all pages)
        """
        if book_id not in self.book_ids:
            print(f"Error: Book ID {book_id} not found in CSV file.")
            return
            
        # Get current progress for this book
        progress = self.get_book_progress(book_id)
        
        # Check if book is already marked as completed
        if progress["completed"]:
            print(f"Book {book_id} is already marked as completed. Skipping scraping.")
            print("To scrape this book again, first update its status in the database to not completed.")
            return
        
        # Start from the page AFTER the last_page we processed
        current_page = progress["last_page"] + 1
        
        # If this is a new book (last_page = 0), start from page 1
        if current_page <= 1:
            current_page = 1
            print(f"Starting scraping for book {book_id} from page {current_page}")
        else:
            print(f"Continuing scraping for book {book_id} from page {current_page}")
        
        # Calculate ending page if max_pages is specified
        end_page = None
        if max_pages:
            end_page = current_page + max_pages - 1
            print(f"Will scrape up to page {end_page}")
        
        total_ratings = 0
        consecutive_empty_pages = 0
        
        with tqdm(desc=f"Book {book_id}", unit="page") as pbar:
            while True:  # Continue until we explicitly break
                # Check if we've reached the specified max pages
                if end_page and current_page > end_page:
                    print(f"Reached max pages limit ({max_pages})")
                    
                    # If we reached max pages and the last page was empty, consider it completed
                    if consecutive_empty_pages > 0:
                        print(f"Last page was empty. Marking as completed.")
                        self.update_book_progress(book_id, current_page - 1, True)
                    else:
                        # Otherwise, just update progress without marking as completed
                        self.update_book_progress(book_id, current_page - 1, False)
                    break
                
                # Scrape current page
                ratings, _, _ = self.scrape_ratings_page(book_id, current_page)
                
                # Save ratings to MongoDB
                saved_count = self.save_ratings_to_mongodb(ratings)
                total_ratings += saved_count
                
                pbar.update(1)
                pbar.set_postfix({"ratings": len(ratings), "saved": saved_count})
                
                # Update the progress after each page is processed
                self.update_book_progress(book_id, current_page, False)
                
                # Check if page has no ratings
                if len(ratings) == 0:
                    consecutive_empty_pages += 1
                    print(f"No reviews found for book {book_id} on page {current_page}. ({consecutive_empty_pages} consecutive empty pages)")
                    
                    # Only mark as completed if we've found 2 consecutive empty pages
                    if consecutive_empty_pages >= 2:
                        print(f"Found 2 consecutive empty pages. Marking as completed.")
                        self.update_book_progress(book_id, current_page, True)
                        break
                else:
                    # Reset counter if we found ratings
                    consecutive_empty_pages = 0
                
                # Go to next page
                current_page += 1
                # Add delay between requests
                time.sleep(self.request_delay)
        
        print(f"Finished scraping book {book_id}. Total ratings saved: {total_ratings}")



    
    def get_user_ratings_count(self):
        """Get statistics about users and their ratings."""
        pipeline = [
            {
                "$project": {
                    "username": 1,
                    "ratings_count": {"$size": {"$ifNull": ["$book_ratings", []]}}
                }
            },
            {
                "$group": {
                    "_id": None,
                    "total_users": {"$sum": 1},
                    "total_ratings": {"$sum": "$ratings_count"},
                    "avg_ratings_per_user": {"$avg": "$ratings_count"},
                    "max_ratings": {"$max": "$ratings_count"},
                    "min_ratings": {"$min": "$ratings_count"}
                }
            }
        ]
        
        result = list(self.users_collection.aggregate(pipeline))
        if result:
            return result[0]
        return {"total_users": 0, "total_ratings": 0}
    
    def list_available_books(self):
        """List all available books from CSV and their scraping status."""
        completed_books = self.get_scraped_books()
        user_stats = self.get_user_ratings_count()
        
        print("\nUser Statistics:")
        print(f"Total Users: {user_stats.get('total_users', 0)}")
        print(f"Total Ratings: {user_stats.get('total_ratings', 0)}")
        if user_stats.get('avg_ratings_per_user'):
            print(f"Avg Ratings Per User: {user_stats.get('avg_ratings_per_user', 0):.2f}")
        
        print("\nAvailable Books:")
        print("---------------")
        print(f"{'Book ID':<30}{'Status':<20}{'Total Ratings':<15}{'Avg Rating':<15}{'Last Page':<10}")
        print("-" * 90)
        
        for book_id in self.book_ids:
            book = self.books_collection.find_one({"book_id": book_id})
            
            if book:
                is_completed = book.get("completed", False)
                last_page = book.get("last_page", 0)
                total_ratings = book.get("total_ratings", 0)
                avg_rating = f"{book.get('avg_rating', 0):.2f}"
                
                if is_completed:
                    status = "Completed"
                elif last_page > 0:
                    status = f"In Progress"
                else:
                    status = "Not Started"
            else:
                status = "Not Started"
                last_page = 0
                total_ratings = 0
                avg_rating = "0.00"
                
            print(f"{book_id:<30}{status:<20}{total_ratings:<15}{avg_rating:<15}{last_page:<10}")
    
    def get_recommendation_stats(self):
        """Get statistics relevant for recommendation system."""
        # Count users with minimum ratings
        min_ratings = 5  # Typical threshold for collaborative filtering
        users_with_min_ratings = self.users_collection.count_documents({
            "$expr": {"$gte": [{"$size": "$book_ratings"}, min_ratings]}
        })
        
        # Count books with minimum ratings
        books_with_min_ratings = self.books_collection.count_documents({
            "total_ratings": {"$gte": min_ratings}
        })
        
        # Get sparsity of the user-item matrix
        all_users = self.users_collection.count_documents({})
        all_books = self.books_collection.count_documents({})
        total_ratings = sum(len(user.get("book_ratings", [])) for user in self.users_collection.find({}, {"book_ratings": 1}))
        
        possible_ratings = all_users * all_books
        sparsity = 1.0 - (total_ratings / possible_ratings) if possible_ratings > 0 else 1.0
        
        print("\nRecommendation System Statistics:")
        print(f"Users with {min_ratings}+ ratings: {users_with_min_ratings}")
        print(f"Books with {min_ratings}+ ratings: {books_with_min_ratings}")
        print(f"Matrix Sparsity: {sparsity:.4f} ({sparsity*100:.2f}%)")
    
    def close(self):
        """Close MongoDB connection."""
        if hasattr(self, 'client'):
            self.client.close()
            print("MongoDB connection closed")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Scrape book ratings from TheStoryGraph')
    parser.add_argument('--csv', type=str, default='scifi_list_OL_final.csv',
                        help='Path to CSV file with book IDs')
    parser.add_argument('--book', type=str, default=None,
                        help='Book ID to scrape')
    parser.add_argument('--pages', type=int, default=None,
                        help='Max pages to scrape (default: all)')
    parser.add_argument('--list', action='store_true',
                        help='List all available books and their scraping status')
    parser.add_argument('--stats', action='store_true',
                        help='Show recommendation system statistics')
    parser.add_argument('--batch', action='store_true',
                        help='Run batch scraping of all books with rate limiting')
    parser.add_argument('--books-per-day', type=int, default=20,
                        help='Maximum number of books to scrape per day (default: 20)')
    parser.add_argument('--delay', type=int, default=120,
                        help='Delay in seconds between books (default: 120)')
    parser.add_argument('--start-from', type=str, default=None,
                        help='Book ID to start from (useful for resuming)')
    
    args = parser.parse_args()
    
    # MongoDB connection URI
    mongo_uri = "mongodb+srv://jovel:423275077127@myfi.ezmdt.mongodb.net/?retryWrites=true&w=majority&appName=myfi"
    
    try:
        scraper = StoryGraphScraper(args.csv, mongo_uri)
        
        if args.list:
            scraper.list_available_books()
        elif args.stats:
            scraper.get_recommendation_stats()
        elif args.book:
            scraper.scrape_book(args.book, args.pages)
        elif args.batch:
            scraper.batch_scrape(
                max_books_per_day=args.books_per_day,
                max_pages_per_book=args.pages,
                delay_between_books=args.delay,
                start_from_book=args.start_from
            )
        else:
            parser.print_help()
            
    except Exception as e:
        print(f"An error occurred: {e}")
    finally:
        if 'scraper' in locals():
            scraper.close()

