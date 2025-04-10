# myfi_backend/services/recommendation_service.py
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np
import sys
import json
from pymongo import MongoClient
import re
import traceback

class BookRecommender:
    def __init__(self, mongo_uri=None):
        try:
            # Connect to MongoDB
            if mongo_uri is None:
                mongo_uri = "mongodb+srv://jovel:423275077127@myfi.ezmdt.mongodb.net/?retryWrites=true&w=majority&appName=myfi"
                
            self.client = MongoClient(mongo_uri)
            self.db = self.client.test
            self.books_collection = self.db.books
            
            # Create ID mapping for flexible ID handling
            self.id_mapping = {}
            self.build_id_mapping()
            
            # Load books and verify data
            self.books = list(self.books_collection.find({}))
            print(f"Loaded {len(self.books)} books from database", file=sys.stderr)
            
            if not self.books:
                raise ValueError("No books loaded from database")
            
            # Check description availability
            descriptions = [book.get('description', '') or '' for book in self.books]
            non_empty_descriptions = sum(1 for desc in descriptions if desc.strip())
            print(f"Books with non-empty descriptions: {non_empty_descriptions} out of {len(self.books)}", file=sys.stderr)
            
            if non_empty_descriptions < 0.5 * len(self.books):
                print("WARNING: Less than 50% of books have descriptions. This may affect recommendation quality.", file=sys.stderr)
                
            # Initialize TF-IDF vectorizer
            self.vectorizer = TfidfVectorizer(
                stop_words='english',
                max_df=0.85,
                min_df=2,
                ngram_range=(1, 2)
            )
            
            self.fit()
            print("TF-IDF model successfully built", file=sys.stderr)
            
        except Exception as e:
            print(f"Error initializing recommender: {str(e)}", file=sys.stderr)
            traceback.print_exc(file=sys.stderr)
            raise

    def build_id_mapping(self):
        """Build a mapping to handle different ID formats"""
        print("Building ID mapping...", file=sys.stderr)
        books = list(self.books_collection.find({}, {"_id": 1}))
        
        for book in books:
            book_id = str(book["_id"])
            
            # Store the original ID
            self.id_mapping[book_id] = book_id
            
            # Handle various ID formats
            # 1. If ID is in /works/OL123W format, also map the OL123W part
            match = re.search(r'\/works\/(OL\d+W)', book_id)
            if match:
                ol_key = match.group(1)
                self.id_mapping[ol_key] = book_id
                
            # 2. If ID is OL123W format, also map the /works/OL123W format
            if re.match(r'^OL\d+W$', book_id):
                self.id_mapping[f"/works/{book_id}"] = book_id
                
        print(f"Built ID mapping with {len(self.id_mapping)} entries", file=sys.stderr)

    def normalize_book_id(self, book_id):
        """Normalize a book ID to the format stored in the database"""
        if book_id in self.id_mapping:
            return self.id_mapping[book_id]
        
        # Check if adding /works/ prefix would match
        if not book_id.startswith('/works/'):
            prefixed_id = f'/works/{book_id}'
            if prefixed_id in self.id_mapping:
                return self.id_mapping[prefixed_id]
                
        # Check if removing /works/ prefix would match
        if book_id.startswith('/works/'):
            unprefixed_id = book_id[7:]  # Remove '/works/' prefix
            if unprefixed_id in self.id_mapping:
                return self.id_mapping[unprefixed_id]
                
        # Return original ID if no mapping found
        return book_id

    def fit(self):
        """Build the TF-IDF matrix for content-based recommendations"""
        try:
            # Create matrix of TF-IDF features from descriptions
            descriptions = []
            for book in self.books:
                # Extract description, handle None values, and add title for better matching
                desc = book.get('description', '') or ''
                title = book.get('title', '') or ''
                authors = ' '.join(book.get('author_names', []))
                
                # Combine title, authors, and description for better content matching
                content = f"{title} {authors} {desc}"
                descriptions.append(content)
                
            print(f"Building TF-IDF matrix from {len(descriptions)} book contents", file=sys.stderr)
            self.tfidf_matrix = self.vectorizer.fit_transform(descriptions)
            print(f"TF-IDF matrix shape: {self.tfidf_matrix.shape}", file=sys.stderr)
            
        except Exception as e:
            print(f"Error in fit method: {str(e)}", file=sys.stderr)
            traceback.print_exc(file=sys.stderr)
            raise

    def get_recommendations_multiple(self, book_ids, n_recommendations=6):
        try:
            # Normalize book IDs - handle both string IDs and objects with bookId property
            normalized_book_ids = []
            for item in book_ids:
                if isinstance(item, dict) and 'bookId' in item:
                    # New format - object with bookId
                    normalized_book_ids.append(self.normalize_book_id(item['bookId']))
                elif isinstance(item, str):
                    # Old format - just a string ID
                    normalized_book_ids.append(self.normalize_book_id(item))
                else:
                    print(f"Skipping invalid book ID format: {item}", file=sys.stderr)
                    
            if not normalized_book_ids:
                print("No valid book IDs provided", file=sys.stderr)
                return []
            
            print(f"Normalized book IDs: {normalized_book_ids}", file=sys.stderr)
            
            # Find indices for all input books
            book_indices = []
            for book_id in normalized_book_ids:
                found = False
                for i, book in enumerate(self.books):
                    if str(book['_id']) == book_id:
                        book_indices.append(i)
                        found = True
                        print(f"Found book '{book['title']}' for ID {book_id}", file=sys.stderr)
                        break
                
                if not found:
                    print(f"No book found for ID {book_id}", file=sys.stderr)
            
            if not book_indices:
                print("No matching books found in the database", file=sys.stderr)
                return []
            
            print(f"Found {len(book_indices)} matching books in the database", file=sys.stderr)
            
            # Calculate average similarity scores across all input books
            combined_similarity = np.zeros(self.tfidf_matrix.shape[0])
            for idx in book_indices:
                similarity = cosine_similarity(
                    self.tfidf_matrix[idx:idx+1], 
                    self.tfidf_matrix
                ).flatten()
                combined_similarity += similarity
            
            # Average the similarities
            combined_similarity /= len(book_indices)
            
            # Get indices of top similar books (excluding the input books)
            similar_indices = []
            for idx in combined_similarity.argsort()[::-1]:
                if idx not in book_indices:
                    similar_indices.append(idx)
                    if len(similar_indices) == n_recommendations:
                        break
            
            # Format recommendations
            recommendations = []
            for idx in similar_indices:
                book = self.books[idx]
                similarity_score = float(combined_similarity[idx])
                
                # Skip recommendations with very low similarity
                if similarity_score < 0.05:
                    continue
                    
                recommendations.append({
                    'id': str(book['_id']),
                    'title': book.get('title', 'Unknown'),
                    'author_names': book.get('author_names', []),
                    'description': book.get('description', ''),
                    'cover_id': book.get('cover_id'),
                    'similarity_score': similarity_score,
                    'method': 'content_based'
                })
            
            print(f"Generated {len(recommendations)} recommendations", file=sys.stderr)
            return recommendations

        except Exception as e:
            print(f"Error in get_recommendations_multiple: {str(e)}", file=sys.stderr)
            traceback.print_exc(file=sys.stderr)
            return []

    # Keep the original single book recommendation method
    def get_recommendations(self, book_id, n_recommendations=6):
        """Get recommendations for a single book ID"""
        return self.get_recommendations_multiple([book_id], n_recommendations)
        
    def close(self):
        """Close MongoDB connection"""
        if hasattr(self, 'client'):
            self.client.close()

def main():
    try:
        # Accept multiple book IDs as command line arguments
        if len(sys.argv) < 2:
            raise ValueError("At least one book ID argument is required")
            
        book_ids = sys.argv[1:]
        print(f"Starting recommendation process for book IDs: {book_ids}", file=sys.stderr)
        
        recommender = BookRecommender()
        recommendations = recommender.get_recommendations_multiple(book_ids)
        
        if not recommendations:
            print(f"No recommendations found for book IDs: {book_ids}", file=sys.stderr)
            
        print(json.dumps(recommendations))
        recommender.close()
        
    except Exception as e:
        print(f"Error in main: {str(e)}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        print(json.dumps([]))
        sys.exit(1)

# Command line interface for the recommender
if __name__ == "__main__":
    main()
