#myfi_backend/services/item_collaborative_filtering.py
from pymongo import MongoClient
import numpy as np
from scipy.sparse import csr_matrix
from sklearn.metrics.pairwise import cosine_similarity
import sys
import json
from collections import defaultdict
import time

class ItemBasedCF:
    def __init__(self, mongo_uri=None):
        try:
            # Connect to MongoDB
            if mongo_uri is None:
                mongo_uri = "mongodb+srv://jovel:423275077127@myfi.ezmdt.mongodb.net/?retryWrites=true&w=majority&appName=myfi"
            
            self.client = MongoClient(mongo_uri)
            self.db = self.client.storygraph_data
            self.users_collection = self.db.users
            self.books_collection = self.db.books
            self.test_books_collection = self.client.test.books  # For book metadata
            
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
                self.metadata[book_id] = {
                    "title": book.get("title", "Unknown"),
                    "author_names": book.get("author_names", []),
                    "description": book.get("description", ""),
                    "cover_id": book.get("cover_id")
                }
                
            print(f"Loaded {len(self.book_id_to_index)} books with {len(self.metadata)} metadata entries", file=sys.stderr)
            
            # Initialize similarity matrix as None - will be computed when needed
            self.similarity_matrix = None
            
        except Exception as e:
            print(f"Error initializing ItemBasedCF: {str(e)}", file=sys.stderr)
            raise
    
    def build_rating_matrix(self):
        """Build a sparse user-item matrix from MongoDB data"""
        print("Building rating matrix...", file=sys.stderr)
        start_time = time.time()
        
        # Store rating data for matrix construction
        ratings_data = []
        row_indices = []
        col_indices = []
        
        # Process user ratings
        user_cursor = self.users_collection.find(
            {"book_ratings": {"$exists": True, "$ne": []}},
            {"book_ratings": 1}
        )
        
        user_count = 0
        rating_count = 0
        
        # Create temporary user index
        user_index = 0
        
        for user in user_cursor:
            book_ratings = user.get("book_ratings", [])
            if not book_ratings:
                continue
                
            for rating_obj in book_ratings:
                book_id = rating_obj.get("book_id")
                rating = rating_obj.get("rating")
                
                # Skip if book_id is not in our mapping or rating is missing
                if book_id not in self.book_id_to_index or rating is None:
                    continue
                    
                # Normalize rating to account for different user scales
                # (not dividing by user's average here, but could be added)
                
                # Add to data
                book_index = self.book_id_to_index[book_id]
                ratings_data.append(float(rating))
                row_indices.append(user_index)
                col_indices.append(book_index)
                rating_count += 1
            
            user_index += 1
            user_count += 1
            
            # Print progress
            if user_count % 10000 == 0:
                print(f"Processed {user_count} users, {rating_count} ratings", file=sys.stderr)
        
        # Create sparse matrix
        n_users = user_index
        n_items = len(self.book_id_to_index)
        
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
        
        # Center ratings by subtracting user means (adjust for user rating bias)
        user_means = rating_matrix.mean(axis=1).A.flatten()
        # For each user, subtract their mean from all their ratings
        centered_matrix = rating_matrix.copy()
        for i in range(rating_matrix.shape[0]):
            user_ratings = rating_matrix[i].nonzero()[1]
            centered_matrix[i, user_ratings] = rating_matrix[i, user_ratings].toarray()[0] - user_means[i]
        
        # Convert to CSR format for efficient calculations
        centered_matrix = centered_matrix.tocsr()
        
        # Compute item-item similarity using cosine_similarity
        # Transpose to get item features as rows
        item_matrix = centered_matrix.T.tocsr()
        
        # Compute similarity in batches to avoid memory issues
        batch_size = 1000
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
    
    def get_item_recommendations(self, book_ids, n_recommendations=6, min_similarity=0.2):
        """Get recommendations based on one or more book IDs"""
        try:
            # Ensure book_ids is a list
            if isinstance(book_ids, str):
                book_ids = [book_ids]
                
            # Format book IDs
            book_ids = [f'/works/{id}' if not id.startswith('/works/') else id for id in book_ids]
            
            # If similarity matrix doesn't exist, compute it
            if self.similarity_matrix is None:
                self.compute_similarity()
                
            print(f"Finding recommendations for {len(book_ids)} books", file=sys.stderr)
            
            # Get indices for input books
            indices = []
            for book_id in book_ids:
                # First try in our metadata
                found = False
                for sg_id, idx in self.book_id_to_index.items():
                    if book_id in sg_id:  # Partial match since formats might differ
                        indices.append(idx)
                        found = True
                        print(f"Found match for {book_id}: {sg_id}", file=sys.stderr)
                        break
                
                if not found:
                    print(f"Book ID {book_id} not found in similarity matrix", file=sys.stderr)
            
            if not indices:
                print("No input books found in database", file=sys.stderr)
                return []
                
            # Get combined similarity score for all input books
            combined_similarity = np.zeros(self.similarity_matrix.shape[0])
            for idx in indices:
                combined_similarity += self.similarity_matrix[idx]
                
            # Average the similarities
            combined_similarity /= len(indices)
                
            # Sort by similarity and get top N+len(indices) (to exclude input books later)
            similar_indices = combined_similarity.argsort()[::-1]
            
            # Prepare recommendations
            recommendations = []
            for idx in similar_indices:
                # Skip the input books
                if idx in indices:
                    continue
                    
                # Skip if similarity is below threshold
                if combined_similarity[idx] < min_similarity:
                    continue
                
                # Get book_id and retrieve metadata
                book_id = self.index_to_book_id[idx]
                
                # Format the book_id to match test database format
                formatted_book_id = None
                
                # Try to extract the works ID if it exists in the StoryGraph book_id
                match = None
                if '/work' in book_id:
                    # Use simple string extraction 
                    parts = book_id.split('/')
                    for part in parts:
                        if part.startswith('OL') and part.endswith('W'):
                            formatted_book_id = f"/works/{part}"
                            break
                
                if formatted_book_id is None:
                    # No direct match, try looking it up in metadata
                    for meta_id in self.metadata:
                        if book_id in meta_id:
                            formatted_book_id = meta_id
                            break
                
                if formatted_book_id and formatted_book_id in self.metadata:
                    # Use existing metadata
                    meta = self.metadata[formatted_book_id]
                    recommendations.append({
                        "id": formatted_book_id,
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
                        "id": book_id,
                        "title": "Unknown",
                        "author_names": [],
                        "similarity_score": float(combined_similarity[idx]),
                        "method": "item_cf"
                    })
                
                # Stop once we have enough recommendations
                if len(recommendations) >= n_recommendations:
                    break
            
            return recommendations
                
        except Exception as e:
            print(f"Error in get_item_recommendations: {str(e)}", file=sys.stderr)
            import traceback
            traceback.print_exc(file=sys.stderr)
            return []
            
    def close(self):
        """Close MongoDB connection"""
        if hasattr(self, 'client'):
            self.client.close()

def main():
    """Command-line interface for the recommender"""
    try:
        if len(sys.argv) < 2:
            raise ValueError("Book ID argument is required")
        
        book_ids = sys.argv[1:]
        print(f"Starting item-based CF for book IDs: {book_ids}", file=sys.stderr)
        
        recommender = ItemBasedCF()
        recommendations = recommender.get_item_recommendations(book_ids)
        
        if not recommendations:
            print(f"No recommendations found for book IDs: {book_ids}", file=sys.stderr)
        
        print(json.dumps(recommendations))
        recommender.close()
        
    except Exception as e:
        print(f"Error in main: {str(e)}", file=sys.stderr)
        print(json.dumps([]))  # Return empty array on error
        sys.exit(1)

if __name__ == "__main__":
    main()
