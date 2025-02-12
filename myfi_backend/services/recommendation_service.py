# recommendation_service.py
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np
import sys
import json
from pymongo import MongoClient

# Make sure the class definition is before any usage
class BookRecommender:
    def __init__(self):
        try:
            # Connect to MongoDB
            self.client = MongoClient("mongodb+srv://jovel:423275077127@myfi.ezmdt.mongodb.net/?retryWrites=true&w=majority&appName=myfi")
            self.db = self.client.test
            self.books_collection = self.db.books
            
            # Load books and verify data
            self.books = list(self.books_collection.find({}))
            print(f"Loaded {len(self.books)} books from database", file=sys.stderr)
            
            if not self.books:
                raise ValueError("No books loaded from database")
                
            # Initialize TF-IDF vectorizer
            self.vectorizer = TfidfVectorizer(
                stop_words='english',
                max_df=0.85,
                min_df=2,
                ngram_range=(1, 2)
            )
            
            self.fit()
            
        except Exception as e:
            print(f"Error initializing recommender: {str(e)}", file=sys.stderr)
            raise

    def fit(self):
        # Create matrix of TF-IDF features from descriptions
        descriptions = [book.get('description', '') or '' for book in self.books]
        self.tfidf_matrix = self.vectorizer.fit_transform(descriptions)

    def get_recommendations(self, book_id, n_recommendations=5):
        try:
            # Ensure consistent ID format
            if not book_id.startswith('/works/'):
                book_id = f'/works/{book_id}'
            
            print(f"Looking for book with ID: {book_id}", file=sys.stderr)
            
            # Find book index
            book_idx = None
            for i, book in enumerate(self.books):
                if str(book['_id']) == book_id:
                    book_idx = i
                    break
            
            if book_idx is None:
                print(f"Book not found. Available IDs sample: {[book['_id'] for book in self.books[:5]]}", file=sys.stderr)
                return []
            
            # Calculate similarity scores
            similarity = cosine_similarity(
                self.tfidf_matrix[book_idx:book_idx+1], 
                self.tfidf_matrix
            ).flatten()
            
            # Get indices of top similar books (excluding the input book)
            similar_indices = similarity.argsort()[::-1][1:n_recommendations+1]
            
            # Format recommendations
            recommendations = []
            for idx in similar_indices:
                book = self.books[idx]
                recommendations.append({
                    'id': str(book['_id']),
                    'title': book['title'],
                    'author_names': book.get('author_names', []),
                    'description': book.get('description', ''),
                    'cover_id': book.get('cover_id'),
                    'similarity_score': float(similarity[idx])
                })
            
            return recommendations

        except Exception as e:
            print(f"Error in get_recommendations: {str(e)}", file=sys.stderr)
            return []

def main():
    try:
        if len(sys.argv) < 2:
            raise ValueError("Book ID argument is required")
            
        book_id = sys.argv[1]
        print(f"Starting recommendation process for book ID: {book_id}", file=sys.stderr)
        
        recommender = BookRecommender()
        recommendations = recommender.get_recommendations(book_id)
        
        if not recommendations:
            print(f"No recommendations found for book ID: {book_id}", file=sys.stderr)
            
        print(json.dumps(recommendations))
        
    except Exception as e:
        print(f"Error in main: {str(e)}", file=sys.stderr)
        print(json.dumps([]))
        sys.exit(1)


# Command line interface for the recommender
if __name__ == "__main__":
    try:
        if len(sys.argv) < 2:
            raise ValueError("Book ID argument is required")
            
        book_id = sys.argv[1]
        print(f"Starting recommendation process for book ID: {book_id}", file=sys.stderr)
        
        recommender = BookRecommender()
        recommendations = recommender.get_recommendations(book_id)
        
        if not recommendations:
            print(f"No recommendations found for book ID: {book_id}", file=sys.stderr)
            
        print(json.dumps(recommendations))
        
    except Exception as e:
        print(f"Error in main: {str(e)}", file=sys.stderr)
        print(json.dumps([]))  # Return empty array on error
        sys.exit(1)

