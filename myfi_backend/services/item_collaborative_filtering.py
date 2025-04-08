#myfi_backend/services/item_collaborative_filtering.py
from pymongo import MongoClient
import numpy as np
from scipy.sparse import csr_matrix
from sklearn.metrics.pairwise import cosine_similarity
import sys
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
            self.db = self.client.storygraph_data
            self.users_collection = self.db.users
            self.books_collection = self.db.books
            self.test_books_collection = self.client.test.books  # For book metadata
            
            # Create ID mapping between OpenLibrary IDs and StoryGraph IDs
            print("Building ID mapping between OpenLibrary and StoryGraph...", file=sys.stderr)
            self.ol_to_sg_mapping = {}
            self.sg_to_ol_mapping = {}
            
            # Get all books from test database (OpenLibrary format)
            ol_books = list(self.test_books_collection.find({}, {"_id": 1, "book_id": 1}))
            for book in ol_books:
                ol_id = book["_id"]
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
                        self.ol_to_sg_mapping[ol_full_id] = sg_id
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
                book_id = book["_id"]
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
    
    def get_item_recommendations(self, book_ids, n_recommendations=6, min_similarity=0.05):  # Lower threshold to 0.05
        """Get recommendations based on one or more book IDs"""
        try:
            # Ensure book_ids is a list
            if isinstance(book_ids, str):
                book_ids = [book_ids]
            
            print(f"Input book IDs: {book_ids}", file=sys.stderr)
            
            # Convert OpenLibrary IDs to StoryGraph IDs for lookup
            sg_book_ids = []
            for book_id in book_ids:
                # Normalize input book_id format (ensure it has /works/ prefix)
                book_id
                
                # Try to find corresponding StoryGraph ID
                if book_id in self.ol_to_sg_mapping:
                    sg_id = self.ol_to_sg_mapping[book_id]
                    sg_book_ids.append(sg_id)
                    print(f"Mapped OpenLibrary ID {book_id} to StoryGraph ID {sg_id}", file=sys.stderr)
                else:
                    # Try direct matching or pattern matching
                    found = False
                    ol_key = None
                    
                    # Extract the OL part if it's in /works/OL format
                    match = re.search(r'\/works\/(OL\d+W)', book_id)
                    if match:
                        ol_key = match.group(1)
                    
                    for sg_id in self.book_id_to_index.keys():
                        if book_id in sg_id or (ol_key and ol_key in sg_id):
                            sg_book_ids.append(sg_id)
                            print(f"Found match for {book_id} in StoryGraph ID {sg_id}", file=sys.stderr)
                            found = True
                            break
                    
                    if not found:
                        print(f"Could not find StoryGraph ID for OpenLibrary ID {book_id}", file=sys.stderr)
            
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
                    print(f"Found index {self.book_id_to_index[sg_id]} for StoryGraph ID {sg_id}", file=sys.stderr)
            
            if not indices:
                print("No input books found in similarity matrix", file=sys.stderr)
                return []
                
            # Get combined similarity score for all input books
            combined_similarity = np.zeros(self.similarity_matrix.shape[0])
            for idx in indices:
                combined_similarity += self.similarity_matrix[idx]
                
                # Add detailed logging for the top similar items
                print(f"Top 10 similarity scores for input book index {idx}:", file=sys.stderr)
                top_scores = sorted([(i, self.similarity_matrix[idx][i]) 
                                for i in range(len(self.similarity_matrix[idx]))
                                if i != idx], key=lambda x: x[1], reverse=True)[:10]
                for book_idx, score in top_scores:
                    book_id = self.index_to_book_id[book_idx]
                    print(f"  Book {book_idx} (ID: {book_id}): {score:.4f}", file=sys.stderr)
                
            # Average the similarities
            combined_similarity /= len(indices)
            
            # Add logging for similarity threshold
            above_threshold = sum(combined_similarity > min_similarity)
            print(f"Number of books with similarity > {min_similarity}: {above_threshold}", file=sys.stderr)
                
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
                
                # Get StoryGraph book_id
                sg_book_id = self.index_to_book_id[idx]
                
                # Map back to OpenLibrary ID format for the response
                ol_book_id = None
                
                # Try to find in our mapping
                if sg_book_id in self.sg_to_ol_mapping:
                    ol_book_id = self.sg_to_ol_mapping[sg_book_id]
                    print(f"Mapped StoryGraph ID {sg_book_id} to OpenLibrary ID {ol_book_id}", file=sys.stderr)
                else:
                    # Try to extract OpenLibrary ID from StoryGraph ID
                    match = re.search(r'\/works\/(OL\d+W)', sg_book_id)
                    if match:
                        ol_key = match.group(1)
                        ol_book_id = f"/works/{ol_key}"
                        print(f"Extracted OpenLibrary ID {ol_book_id} from StoryGraph ID {sg_book_id}", file=sys.stderr)
                    else:
                        # No mapping found, use StoryGraph ID as-is
                        ol_book_id = sg_book_id
                        print(f"No OpenLibrary ID found for {sg_book_id}, using as-is", file=sys.stderr)
                
                # Look up metadata for this book
                if ol_book_id and ol_book_id in self.metadata:
                    # Use existing metadata
                    meta = self.metadata[ol_book_id]
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
                        "id": ol_book_id or sg_book_id,
                        "title": "Unknown",
                        "author_names": [],
                        "similarity_score": float(combined_similarity[idx]),
                        "method": "item_cf"
                    })
                
                # Stop once we have enough recommendations
                if len(recommendations) >= n_recommendations:
                    break
            
            if not recommendations:
                print(f"No recommendations found that meet the threshold. Consider lowering min_similarity (currently {min_similarity})", file=sys.stderr)
                
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
