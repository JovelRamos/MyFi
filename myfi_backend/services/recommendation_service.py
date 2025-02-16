# recommendation_service.py
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np
import sys
import json
from pymongo import MongoClient

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

    def get_recommendations_multiple(self, book_ids, n_recommendations=6):
        try:
            # Ensure consistent ID format for all books
            book_ids = [f'/works/{id}' if not id.startswith('/works/') else id for id in book_ids]
            
            # Find indices for all input books
            book_indices = []
            for book_id in book_ids:
                for i, book in enumerate(self.books):
                    if str(book['_id']) == book_id:
                        book_indices.append(i)
                        break
            
            if not book_indices:
                print("No matching books found", file=sys.stderr)
                return []
            
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
                recommendations.append({
                    'id': str(book['_id']),
                    'title': book['title'],
                    'author_names': book.get('author_names', []),
                    'description': book.get('description', ''),
                    'cover_id': book.get('cover_id'),
                    'similarity_score': float(combined_similarity[idx])
                })
            
            return recommendations

        except Exception as e:
            print(f"Error in get_recommendations_multiple: {str(e)}", file=sys.stderr)
            return []

    # Keep the original single book recommendation method
    def get_recommendations(self, book_id, n_recommendations=6):
        return self.get_recommendations_multiple([book_id], n_recommendations)

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

