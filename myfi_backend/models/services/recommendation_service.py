# recommendation_service.py
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np
import sys
import json
from pymongo import MongoClient

class BookRecommender:
    def __init__(self):
        # Connect to MongoDB
        self.client = MongoClient("mongodb+srv://jovel:423275077127@myfi.ezmdt.mongodb.net/?retryWrites=true&w=majority&appName=myfi")
        self.db = self.client.test  # Replace 'test' with your database name
        self.books_collection = self.db.books

        # Initialize TF-IDF vectorizer
        self.vectorizer = TfidfVectorizer(
            stop_words='english',
            max_df=0.85,
            min_df=2,
            ngram_range=(1, 2)
        )
        
        # Load books and create TF-IDF matrix
        self.books = list(self.books_collection.find({}))
        self.fit()

    def fit(self):
        # Create matrix of TF-IDF features from descriptions
        descriptions = [book.get('description', '') or '' for book in self.books]
        self.tfidf_matrix = self.vectorizer.fit_transform(descriptions)

    def get_recommendations(self, book_id, n_recommendations=5):
        try:
            # Find book index
            book_idx = next(i for i, book in enumerate(self.books) 
                          if str(book['_id']) == book_id)
            
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
                    'author_names': book['author_names'],
                    'description': book['description'],
                    'cover_id': book['cover_id'],
                    'similarity_score': float(similarity[idx])
                })
            
            return recommendations

        except Exception as e:
            print(f"Error in get_recommendations: {str(e)}", file=sys.stderr)
            return []

# Command line interface for the recommender
if __name__ == "__main__":
    try:
        # Get book ID from command line argument
        book_id = sys.argv[1]
        
        # Initialize recommender
        recommender = BookRecommender()
        
        # Get recommendations
        recommendations = recommender.get_recommendations(book_id)
        
        # Print results as JSON
        print(json.dumps(recommendations))
        
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)
