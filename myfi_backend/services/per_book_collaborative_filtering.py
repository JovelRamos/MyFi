# myfi_backend/services/per_book_collaborative_filtering.py

import sys
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
from pymongo import MongoClient
from bson.objectid import ObjectId
from scipy.sparse import csr_matrix
import json
import time
import re

class PerBookItemCF:
    def __init__(self, mongo_uri=None):
        try:
            # Connect to MongoDB
            if mongo_uri is None:
                mongo_uri = "mongodb+srv://jovel:423275077127@myfi.ezmdt.mongodb.net/?retryWrites=true&w=majority&appName=myfi"
            
            self.client = MongoClient(mongo_uri)
            
            # Initialize database connections
            self.db = self.client.storygraph_data
            self.storygraph_users = self.db.users  # StoryGraph users for collaborative filtering
            self.books_collection = self.db.books
            self.test_books_collection = self.client.test.books  # For book metadata
            self.app_users_collection = self.client.test.users   # For your application users
            
            # Create ID mapping between OpenLibrary IDs and StoryGraph IDs
            print("Building ID mapping between OpenLibrary and StoryGraph...", file=sys.stderr)
            self.ol_to_sg_mapping = {}
            self.sg_to_ol_mapping = {}
            
            # Get all books from test database (OpenLibrary format)
            ol_books = list(self.test_books_collection.find({}, {"_id": 1, "book_id": 1}))
            for book in ol_books:
                ol_id = str(book["_id"])
                
                # Store multiple formats of OpenLibrary IDs
                self.ol_to_sg_mapping[ol_id] = ol_id
                
                if ol_id.startswith('/works/'):
                    ol_short_id = ol_id[7:]  # Remove '/works/' prefix
                    self.ol_to_sg_mapping[ol_short_id] = ol_id
                
                elif re.match(r'^OL\d+W$', ol_id):
                    ol_long_id = f"/works/{ol_id}"
                    self.ol_to_sg_mapping[ol_long_id] = ol_id
                
                if "book_id" in book:
                    sg_id = book["book_id"]
                    self.ol_to_sg_mapping[ol_id] = sg_id
                    self.sg_to_ol_mapping[sg_id] = ol_id
            
            # If we didn't get enough mapping, try to extract from StoryGraph collection
            sg_books = list(self.books_collection.find({}, {"book_id": 1}))
            for book in sg_books:
                sg_id = book["book_id"]
                # Try to extract OpenLibrary ID from StoryGraph ID if it contains '/works/OL'
                if '/works/' in sg_id:
                    match = re.search(r'\/works\/(OL\d+W)', sg_id)
                    if match:
                        ol_id = match.group(1)
                        ol_full_id = f"/works/{ol_id}"
                        self.ol_to_sg_mapping[ol_id] = sg_id  # Store without /works/ prefix
                        self.ol_to_sg_mapping[ol_full_id] = sg_id  # Store with /works/ prefix
                        self.sg_to_ol_mapping[sg_id] = ol_full_id
                
                # Also add direct OL format mappings
                match = re.search(r'(OL\d+W)', sg_id)
                if match:
                    ol_id = match.group(1)
                    ol_full_id = f"/works/{ol_id}"
                    self.ol_to_sg_mapping[ol_id] = sg_id  # Store without /works/ prefix
                    self.ol_to_sg_mapping[ol_full_id] = sg_id  # Store with /works/ prefix
                    self.sg_to_ol_mapping[sg_id] = ol_full_id
            
            print(f"Built mapping between {len(self.ol_to_sg_mapping)} OpenLibrary and StoryGraph IDs", file=sys.stderr)
            
            # Load book IDs and create mappings
            print("Loading book data...", file=sys.stderr)
            self.book_id_to_index = {}
            self.index_to_book_id = {}
            self.metadata = {}
            
            # Create mapping of book_id to index
            books = list(self.books_collection.find({}, {"book_id": 1, "avg_rating": 1, "total_ratings": 1}))
            for i, book in enumerate(books):
                book_id = book["book_id"]
                self.book_id_to_index[book_id] = i
                self.index_to_book_id[i] = book_id
                
            # Load book metadata from test database
            test_books = list(self.test_books_collection.find({}, {
                "_id": 1, "title": 1, "author_names": 1, "description": 1, "cover_id": 1
            }))
            
            for book in test_books:
                book_id = str(book["_id"])
                
                # Store metadata under multiple ID formats
                self.metadata[book_id] = {
                    "title": book.get("title", "Unknown"),
                    "author_names": book.get("author_names", []),
                    "description": book.get("description", ""),
                    "cover_id": book.get("cover_id")
                }
                
                # Also store without /works/ prefix if needed
                if book_id.startswith('/works/'):
                    short_id = book_id[7:]  # Remove /works/ prefix
                    self.metadata[short_id] = self.metadata[book_id]
                # Also store with /works/ prefix if needed
                elif re.match(r'^OL\d+W$', book_id):
                    long_id = f"/works/{book_id}"
                    self.metadata[long_id] = self.metadata[book_id]
                
            print(f"Loaded {len(self.book_id_to_index)} books with {len(self.metadata)} metadata entries", file=sys.stderr)
            
            # Initialize similarity matrix as None - will be computed when needed
            self.similarity_matrix = None
            self.rating_matrix = None
            
        except Exception as e:
            print(f"Error initializing PerBookItemCF: {str(e)}", file=sys.stderr)
            raise
    
    def normalize_book_id(self, book_id):
        """Try different formats of book_id to ensure compatibility"""
        # Try original format
        if book_id in self.ol_to_sg_mapping:
            return self.ol_to_sg_mapping[book_id]
            
        # Try with /works/ prefix if it doesn't have it
        if not book_id.startswith('/works/') and re.match(r'^OL\d+W$', book_id):
            book_id_with_prefix = f"/works/{book_id}"
            if book_id_with_prefix in self.ol_to_sg_mapping:
                return self.ol_to_sg_mapping[book_id_with_prefix]
                
        # Try without /works/ prefix if it has it
        if book_id.startswith('/works/'):
            book_id_without_prefix = book_id[7:]  # Remove '/works/' prefix
            if book_id_without_prefix in self.ol_to_sg_mapping:
                return self.ol_to_sg_mapping[book_id_without_prefix]
                
        # If all else fails, return the original ID
        return book_id
        
    def get_user_rated_books(self, user_id):
        """Get the books rated by a specific user from application database"""
        try:
            print(f"Looking up rated books for user: {user_id}", file=sys.stderr)
            
            # Find the user document from your application database
            user = self.app_users_collection.find_one({"_id": user_id})
            if not user:
                print(f"User not found with ID: {user_id}", file=sys.stderr)
                return []
            
            print(f"Found user with email: {user.get('email', 'unknown')}", file=sys.stderr)
            
            # Extract book IDs and ratings from finishedBooks array
            rated_books = []
            
            if 'finishedBooks' in user and isinstance(user['finishedBooks'], list):
                print(f"User has {len(user['finishedBooks'])} finished books", file=sys.stderr)
                for book_entry in user['finishedBooks']:
                    if isinstance(book_entry, dict) and 'bookId' in book_entry and 'rating' in book_entry:
                        if book_entry['rating'] is not None:  # Only include books with actual ratings
                            book_id = book_entry['bookId']
                            rating = book_entry['rating']
                            print(f"  Found rated book: {book_id} with rating {rating}", file=sys.stderr)
                            rated_books.append(book_id)
            
            print(f"Found {len(rated_books)} rated books for user {user_id}", file=sys.stderr)
            for i, book_id in enumerate(rated_books[:10]):  # Log first 10 for debugging
                print(f"  Rated book {i+1}: {book_id}", file=sys.stderr)
            
            return rated_books
            
        except Exception as e:
            print(f"Error retrieving user rated books: {str(e)}", file=sys.stderr)
            import traceback
            traceback.print_exc(file=sys.stderr)
            return []

    def build_rating_matrix(self):
        """Build a sparse user-item matrix from StoryGraph MongoDB data"""
        if self.rating_matrix is not None:
            print("Using existing rating matrix", file=sys.stderr)
            return self.rating_matrix
            
        print("Building rating matrix from StoryGraph data...", file=sys.stderr)
        start_time = time.time()
        
        # Store rating data for matrix construction
        ratings_data = []
        row_indices = []
        col_indices = []
        
        # Process user ratings from StoryGraph users
        user_count = 0
        rating_count = 0
        
        # Create temporary user index mapping
        user_id_to_index = {}
        
        # Query settings for large dataset
        batch_size = 1000
        
        print("Querying StoryGraph users with ratings...", file=sys.stderr)
        
        # Use a cursor to process users in batches to avoid memory issues
        user_cursor = self.storygraph_users.find(
            {"book_ratings": {"$exists": True, "$ne": []}},
            {"username": 1, "book_ratings": 1}
        ).batch_size(batch_size)
        
        # Set progress reporting milestones
        milestones = [1000, 5000, 10000, 50000, 100000]
        next_milestone_idx = 0
        
        for user in user_cursor:
            user_idx = user_count  # Assign current count as index
            user_id_to_index[user.get("username", f"user_{user_count}")] = user_idx
            
            book_ratings = user.get("book_ratings", [])
            if not book_ratings:
                continue
            
            has_ratings = False
            for rating_item in book_ratings:
                if not isinstance(rating_item, dict):
                    continue
                
                book_id = rating_item.get("book_id")
                rating = rating_item.get("rating")
                
                if book_id is None or rating is None:
                    continue
                
                # Check if book_id is in our mapping
                if book_id in self.book_id_to_index:
                    book_index = self.book_id_to_index[book_id]
                    ratings_data.append(float(rating))
                    row_indices.append(user_idx)
                    col_indices.append(book_index)
                    rating_count += 1
                    has_ratings = True
            
            if has_ratings:
                user_count += 1
            
            # Print progress at specific milestones only
            if next_milestone_idx < len(milestones) and user_count >= milestones[next_milestone_idx]:
                print(f"Processing milestone: {milestones[next_milestone_idx]} users, {rating_count} ratings", file=sys.stderr)
                next_milestone_idx += 1
        
        print(f"Completed processing StoryGraph users and ratings", file=sys.stderr)
        
        # Create sparse matrix
        n_users = max(user_count, 1)  # At least one user
        n_items = len(self.book_id_to_index)
        
        if rating_count == 0:
            print("No ratings found, creating empty matrix", file=sys.stderr)
            matrix = csr_matrix((n_users, n_items))
        else:
            matrix = csr_matrix((ratings_data, (row_indices, col_indices)), shape=(n_users, n_items))
        
        elapsed = time.time() - start_time
        print(f"Built matrix with {n_users} users, {n_items} items, and {rating_count} ratings in {elapsed:.2f} seconds", file=sys.stderr)
        
        self.rating_matrix = matrix
        return matrix
    
    def compute_similarity(self, force_recompute=False):
        """Compute item-item similarity matrix using adjusted cosine similarity"""
        if self.similarity_matrix is not None and not force_recompute:
            print("Using existing similarity matrix", file=sys.stderr)
            return self.similarity_matrix
        
        print("Computing item-item similarity matrix...", file=sys.stderr)
        start_time = time.time()
        
        # Build rating matrix
        rating_matrix = self.build_rating_matrix()
        
        # Check if rating matrix has data
        if rating_matrix.nnz == 0:
            print("Rating matrix is empty, cannot compute similarity", file=sys.stderr)
            return np.zeros((len(self.book_id_to_index), len(self.book_id_to_index)))
        
        # Center ratings by subtracting user means (adjust for user rating bias)
        user_means = rating_matrix.mean(axis=1).A.flatten()
        
        # For each user, subtract their mean from all their ratings
        centered_matrix = rating_matrix.copy()
        for i in range(rating_matrix.shape[0]):
            user_ratings = rating_matrix[i].nonzero()[1]
            if len(user_ratings) > 0:  # Only process if user has ratings
                centered_matrix[i, user_ratings] = rating_matrix[i, user_ratings].toarray()[0] - user_means[i]
        
        # Convert to CSR format for efficient calculations
        centered_matrix = centered_matrix.tocsr()
        
        # Compute item-item similarity using cosine_similarity
        # Transpose to get item features as rows
        item_matrix = centered_matrix.T.tocsr()
        
        # Compute similarity in batches to avoid memory issues
        batch_size = 500
        n_items = item_matrix.shape[0]
        similarity_matrix = np.zeros((n_items, n_items))
        
        for i in range(0, n_items, batch_size):
            end_idx = min(i + batch_size, n_items)
            batch = item_matrix[i:end_idx]
            
            # Compute similarity between this batch and all items
            batch_similarity = cosine_similarity(batch, item_matrix)
            similarity_matrix[i:end_idx] = batch_similarity
            
            print(f"Computed similarities for items {i}-{end_idx-1} of {n_items}", file=sys.stderr)
        
        elapsed = time.time() - start_time
        print(f"Similarity matrix computed in {elapsed:.2f} seconds", file=sys.stderr)
        
        self.similarity_matrix = similarity_matrix
        return similarity_matrix
    
    def get_recommendations_for_book(self, book_id, n_recommendations=6, min_similarity=0.05):
        """Get recommendations for a single book"""
        try:
            print(f"Getting recommendations for book: {book_id}", file=sys.stderr)
            
            # Normalize book ID
            sg_book_id = self.normalize_book_id(book_id)
            if sg_book_id not in self.book_id_to_index:
                print(f"Could not find book ID {book_id} in similarity matrix", file=sys.stderr)
                return []
                
            # If similarity matrix doesn't exist, compute it
            if self.similarity_matrix is None:
                self.compute_similarity()
            
            # Get index for input book
            book_idx = self.book_id_to_index[sg_book_id]
            
            # Get similarity scores for this book
            similarity_scores = self.similarity_matrix[book_idx]
            
            # Get top similar book indices (excluding the input book)
            similar_indices = similarity_scores.argsort()[::-1]
            
            # Prepare recommendations
            recommendations = []
            
            for idx in similar_indices:
                # Skip the input book
                if idx == book_idx:
                    continue
                    
                # Skip if similarity is below threshold
                if similarity_scores[idx] < min_similarity:
                    continue
                
                # Get StoryGraph book_id
                sg_similar_book_id = self.index_to_book_id[idx]
                
                # Map to OpenLibrary ID for the response
                ol_book_id = None
                
                # Try to find in our mapping
                if sg_similar_book_id in self.sg_to_ol_mapping:
                    ol_book_id = self.sg_to_ol_mapping[sg_similar_book_id]
                else:
                    # Try to extract OpenLibrary ID from StoryGraph ID
                    match = re.search(r'\/works\/(OL\d+W)', sg_similar_book_id)
                    if match:
                        ol_key = match.group(1)
                        ol_book_id = f"/works/{ol_key}"
                    else:
                        # No mapping found, use StoryGraph ID as-is
                        ol_book_id = sg_similar_book_id
                
                # Try both with and without /works/ prefix for metadata lookup
                meta = None
                if ol_book_id in self.metadata:
                    meta = self.metadata[ol_book_id]
                # If not found, try without /works/ prefix
                elif ol_book_id.startswith('/works/') and ol_book_id[7:] in self.metadata:
                    meta = self.metadata[ol_book_id[7:]]
                # If still not found, try with /works/ prefix
                elif not ol_book_id.startswith('/works/') and f"/works/{ol_book_id}" in self.metadata:
                    meta = self.metadata[f"/works/{ol_book_id}"]
                
                if meta:
                    # Use existing metadata
                    recommendations.append({
                        "id": ol_book_id,
                        "title": meta.get("title", "Unknown"),
                        "author_names": meta.get("author_names", []),
                        "description": meta.get("description", ""),
                        "cover_id": meta.get("cover_id"),
                        "similarity_score": float(similarity_scores[idx]),
                        "method": "item_cf",
                        "source_book": book_id
                    })
                else:
                    # Basic entry if no metadata
                    recommendations.append({
                        "id": ol_book_id,
                        "title": "Unknown",
                        "author_names": [],
                        "similarity_score": float(similarity_scores[idx]),
                        "method": "item_cf",
                        "source_book": book_id
                    })
                
                # Stop once we have enough recommendations
                if len(recommendations) >= n_recommendations:
                    break
            
            print(f"Found {len(recommendations)} recommendations for book {book_id}", file=sys.stderr)
            return recommendations
                
        except Exception as e:
            print(f"Error in get_recommendations_for_book: {str(e)}", file=sys.stderr)
            import traceback
            traceback.print_exc(file=sys.stderr)
            return []
    
    def get_recommendations_by_book(self, user_id, n_recommendations_per_book=6):
        """Get recommendations for each book a user has rated"""
        try:
            print(f"Getting per-book recommendations for user: {user_id}", file=sys.stderr)
            
            # Get the books rated by this user
            user_books = self.get_user_rated_books(user_id)
            if not user_books:
                print(f"No rated books found for user {user_id}", file=sys.stderr)
                return {}
                
            print(f"User has rated {len(user_books)} books", file=sys.stderr)
            
            # Get recommendations for each book
            recommendations_by_book = {}
            
            for book_id in user_books:
                book_recs = self.get_recommendations_for_book(
                    book_id, 
                    n_recommendations=n_recommendations_per_book
                )
                
                if book_recs:
                    recommendations_by_book[book_id] = book_recs
            
            return recommendations_by_book
                
        except Exception as e:
            print(f"Error in get_recommendations_by_book: {str(e)}", file=sys.stderr)
            import traceback
            traceback.print_exc(file=sys.stderr)
            return {}
            
    def close(self):
        """Close MongoDB connection"""
        if hasattr(self, 'client'):
            self.client.close()
            print("MongoDB connection closed", file=sys.stderr)

def main():
    """Command-line interface for the recommender"""
    try:
        # Two ways to use this script:
        # 1. With user ID and optional book ID: python per_book_collaborative_filtering.py <user_id> [book_id]
        # 2. With just a book ID: python per_book_collaborative_filtering.py <book_id>
        
        if len(sys.argv) < 2:
            raise ValueError("Need at least user ID or book ID argument")
        
        input_id = sys.argv[1]
        recommender = PerBookItemCF()
        
        # Process second argument if provided
        specific_book_id = None
        if len(sys.argv) >= 3:
            specific_book_id = sys.argv[2]
            
        # Check if the input is a MongoDB ObjectId format (user ID)
        if re.match(r'^[0-9a-f]{24}$', input_id):
            # This is a MongoDB ObjectId - treat as user ID
            user_id_obj = ObjectId(input_id)
            print(f"Processing as user ID: {input_id}", file=sys.stderr)
            
            if specific_book_id:
                # Get recommendations for a specific book from the user's collection
                print(f"Getting recommendations for specific book: {specific_book_id}", file=sys.stderr)
                recommendations = recommender.get_recommendations_for_book(specific_book_id)
                print(json.dumps(recommendations))
            else:
                # Get recommendations for all of the user's books
                recommendations_by_book = recommender.get_recommendations_by_book(user_id_obj)
                print(json.dumps(recommendations_by_book))
        else:
            # Not a valid ObjectId - treat as book ID
            print(f"Processing as book ID: {input_id}", file=sys.stderr)
            recommendations = recommender.get_recommendations_for_book(input_id)
            print(json.dumps(recommendations))
        
        recommender.close()
        
    except Exception as e:
        print(f"Error in main: {str(e)}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)
        
        if re.match(r'^[0-9a-f]{24}$', sys.argv[1]) and len(sys.argv) < 3:
            # Expected to return recommendations by book
            print(json.dumps({}))  # Return empty object for recommendations by book
        else:
            # Expected to return single book recommendations
            print(json.dumps([]))  # Return empty array for a single book
        sys.exit(1)

if __name__ == "__main__":
    main()
