# myfi_backend/services/item_collaborative_filtering.py

import sys
import numpy
import scipy
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from pymongo import MongoClient
from bson.objectid import ObjectId
import numpy as np
from scipy.sparse import csr_matrix
import json
from collections import defaultdict
import time
import re


class ItemBasedCF:
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
                # 1. Original format (could be /works/OL123W or just OL123W)
                self.ol_to_sg_mapping[ol_id] = ol_id
                
                # 2. If it has /works/ prefix, also store without it
                if ol_id.startswith('/works/'):
                    ol_short_id = ol_id[7:]  # Remove '/works/' prefix
                    self.ol_to_sg_mapping[ol_short_id] = ol_id
                
                # 3. If it doesn't have /works/ prefix, also store with it
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
            
        except Exception as e:
            print(f"Error initializing ItemBasedCF: {str(e)}", file=sys.stderr)
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
        
        # Set progress reporting milestones instead of reporting every 100 users
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
    
    def get_recommendations_for_user(self, user_id, n_recommendations=6, min_similarity=0.05):
        """Get recommendations for a user based on their rated books"""
        try:
            print(f"Getting recommendations for user: {user_id}", file=sys.stderr)
            
            # Get the books rated by this user
            user_books = self.get_user_rated_books(user_id)
            if not user_books:
                print(f"No rated books found for user {user_id}", file=sys.stderr)
                return []
                
            print(f"User has rated {len(user_books)} books", file=sys.stderr)
            
            # Convert IDs to StoryGraph IDs for lookup
            sg_book_ids = []
            for book_id in user_books:
                # Try to find corresponding StoryGraph ID
                sg_id = self.normalize_book_id(book_id)
                if sg_id in self.book_id_to_index:
                    sg_book_ids.append(sg_id)
                    print(f"Mapped ID {book_id} to StoryGraph ID {sg_id}", file=sys.stderr)
                else:
                    print(f"Could not find StoryGraph ID for book ID {book_id}", file=sys.stderr)
            
            if not sg_book_ids:
                print("No input books could be mapped to StoryGraph IDs", file=sys.stderr)
                return []
                
            # If similarity matrix doesn't exist, compute it
            if self.similarity_matrix is None:
                self.compute_similarity()
            
            print(f"Finding recommendations for {len(sg_book_ids)} mapped books", file=sys.stderr)
            
            # Get indices for input books
            indices = []
            for sg_id in sg_book_ids:
                if sg_id in self.book_id_to_index:
                    indices.append(self.book_id_to_index[sg_id])
            
            if not indices:
                print("No input books found in similarity matrix", file=sys.stderr)
                return []
                
            # Get combined similarity score for all input books
            combined_similarity = np.zeros(self.similarity_matrix.shape[0])
            for idx in indices:
                combined_similarity += self.similarity_matrix[idx]
                
            # Average the similarities
            combined_similarity /= len(indices)
            
            # Add logging for similarity threshold
            thresholds = [0.05, 0.1, 0.2, 0.3, 0.4, 0.5]
            for threshold in thresholds:
                above_threshold_indices = np.where(combined_similarity > threshold)[0]
                books_above_threshold = [self.index_to_book_id[idx] for idx in above_threshold_indices if idx not in indices]
                
                # Map StoryGraph IDs to OpenLibrary IDs when possible
                ol_book_ids = []
                for sg_id in books_above_threshold:
                    if sg_id in self.sg_to_ol_mapping:
                        ol_book_ids.append(self.sg_to_ol_mapping[sg_id])
                    else:
                        # Try to extract OpenLibrary ID from StoryGraph ID
                        match = re.search(r'\/works\/(OL\d+W)', sg_id)
                        if match:
                            ol_book_id = f"/works/{match.group(1)}"
                            ol_book_ids.append(ol_book_id)
                        else:
                            ol_book_ids.append(sg_id)  # Use SG ID if no mapping
                
                print(f"Number of books with similarity > {threshold}: {len(books_above_threshold)}", file=sys.stderr)
                print(f"Books with similarity > {threshold}:", file=sys.stderr)
                for i, book_id in enumerate(ol_book_ids[:10]):  # Limit to first 10 for readability
                    print(f"  Book {i+1}: {book_id}", file=sys.stderr)
                if len(ol_book_ids) > 10:
                    print(f"  ... and {len(ol_book_ids) - 10} more", file=sys.stderr)
                
            # Sort by similarity and get top N+len(indices) (to exclude input books later)
            similar_indices = combined_similarity.argsort()[::-1]
            
            # Prepare recommendations
            recommendations = []
            recommended_ids = []  # To store and print extracted book IDs
            for idx in similar_indices:
                # Skip the input books
                if idx in indices:
                    continue
                    
                # Skip if similarity is below threshold
                if combined_similarity[idx] < min_similarity:
                    continue
                
                # Get StoryGraph book_id
                sg_book_id = self.index_to_book_id[idx]
                
                # Map back to OpenLibrary ID format for the response
                ol_book_id = None
                
                # Try to find in our mapping
                if sg_book_id in self.sg_to_ol_mapping:
                    ol_book_id = self.sg_to_ol_mapping[sg_book_id]
                else:
                    # Try to extract OpenLibrary ID from StoryGraph ID
                    match = re.search(r'\/works\/(OL\d+W)', sg_book_id)
                    if match:
                        ol_key = match.group(1)
                        ol_book_id = f"/works/{ol_key}"
                    else:
                        # No mapping found, use StoryGraph ID as-is
                        ol_book_id = sg_book_id
                
                recommended_ids.append(ol_book_id)  # Add to list of recommended IDs
                
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
                        "similarity_score": float(combined_similarity[idx]),
                        "method": "item_cf"
                    })
                else:
                    # Basic entry if no metadata
                    recommendations.append({
                        "id": ol_book_id,
                        "title": "Unknown",
                        "author_names": [],
                        "similarity_score": float(combined_similarity[idx]),
                        "method": "item_cf"
                    })
                
                # Stop once we have enough recommendations
                if len(recommendations) >= n_recommendations:
                    break
            
            # Print out the extracted book IDs
            print(f"Extracted recommended book IDs:", file=sys.stderr)
            for i, book_id in enumerate(recommended_ids):
                print(f"  Recommendation {i+1}: {book_id}", file=sys.stderr)
            
            if not recommendations:
                print(f"No recommendations found that meet the threshold. Consider lowering min_similarity (currently {min_similarity})", file=sys.stderr)
                
            return recommendations
                
        except Exception as e:
            print(f"Error in get_recommendations_for_user: {str(e)}", file=sys.stderr)
            import traceback
            traceback.print_exc(file=sys.stderr)
            return []
            
    def close(self):
        """Close MongoDB connection"""
        if hasattr(self, 'client'):
            self.client.close()
            print("MongoDB connection closed", file=sys.stderr)

def main():
    """Command-line interface for the recommender"""
    try:
        if len(sys.argv) < 2:
            raise ValueError("User ID argument is required")
        
        user_id = sys.argv[1]
        
        print(f"Starting item-based collaborative filtering for user ID: {user_id}", file=sys.stderr)
        
        recommender = ItemBasedCF()
        
        # Check if the input is a MongoDB ObjectId format (user ID)
        if re.match(r'^[0-9a-f]{24}$', user_id):
            # This is a MongoDB ObjectId - treat as user ID
            user_id_obj = ObjectId(user_id)
            print(f"Converting string {user_id} to ObjectId for lookup", file=sys.stderr)
            recommendations = recommender.get_recommendations_for_user(user_id_obj)
        else:
            # Not a valid ObjectId
            print(f"Input is not a valid MongoDB ObjectId: {user_id}", file=sys.stderr)
            recommendations = []
        
        if not recommendations:
            print(f"No recommendations found for user ID: {user_id}", file=sys.stderr)
        else:
            print(f"Found {len(recommendations)} recommendations for user", file=sys.stderr)
        
        # Ensure we json dump the final recommendations as the output
        print(json.dumps(recommendations))
        recommender.close()
        
    except Exception as e:
        print(f"Error in main: {str(e)}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)
        print(json.dumps([]))  # Return empty array on error
        sys.exit(1)

if __name__ == "__main__":
    main()
