# services/book_similarity.py
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np
import sys
import json
from pymongo import MongoClient
import re
import traceback

class BookSimilarityCalculator:
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
            
        except Exception as e:
            print(f"Error initializing similarity calculator: {str(e)}", file=sys.stderr)
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

    def calculate_similarity(self, reference_id, target_ids):
        """Calculate similarity scores between a reference book and target books"""
        try:
            # Normalize book IDs
            reference_id = self.normalize_book_id(reference_id)
            normalized_target_ids = [self.normalize_book_id(target_id) for target_id in target_ids]
            
            # Fetch books data
            all_ids = [reference_id] + normalized_target_ids
            books_data = list(self.books_collection.find({"_id": {"$in": all_ids}}))
            
            if not books_data:
                print(f"No books found with the provided IDs", file=sys.stderr)
                return {}
            
            # Prepare book content for TF-IDF
            book_contents = {}
            for book in books_data:
                book_id = str(book["_id"])
                
                # Combine title, authors, and description for content
                title = book.get('title', '') or ''
                authors = ' '.join(book.get('author_names', []) or [])
                desc = book.get('description', '') or ''
                
                book_contents[book_id] = f"{title} {authors} {desc}"
            
            # Check if reference book is found
            if reference_id not in book_contents:
                print(f"Reference book {reference_id} not found in database", file=sys.stderr)
                return {}
                
            # Create TF-IDF vectorizer
            vectorizer = TfidfVectorizer(
                stop_words='english',
                max_df=0.85,
                min_df=1,
                ngram_range=(1, 2)
            )
            
            # Create content list maintaining order for matrix indexing
            book_ids = list(book_contents.keys())
            content_list = [book_contents[book_id] for book_id in book_ids]
            
            # Compute TF-IDF matrix
            tfidf_matrix = vectorizer.fit_transform(content_list)
            
            # Find reference book index
            ref_index = book_ids.index(reference_id)
            
            # Compute similarity scores
            similarity_scores = {}
            
            # Get similarity of reference book to all others
            similarities = cosine_similarity(
                tfidf_matrix[ref_index:ref_index+1], 
                tfidf_matrix
            ).flatten()
            
            # Store similarity scores
            for i, book_id in enumerate(book_ids):
                # Skip the reference book (self-similarity is always 1.0)
                if book_id != reference_id:
                    similarity_scores[book_id] = float(similarities[i])
            
            # Return formatted response
            result = {
                "reference_id": reference_id,
                "similarities": similarity_scores
            }
            
            return result
            
        except Exception as e:
            print(f"Error calculating similarity: {str(e)}", file=sys.stderr)
            traceback.print_exc(file=sys.stderr)
            return {}
    
    def calculate_pairwise_similarity(self, book_ids):
        """Calculate similarity scores between all pairs of books"""
        try:
            # Normalize all book IDs
            normalized_ids = [self.normalize_book_id(book_id) for book_id in book_ids]
            
            # Fetch books data
            books_data = list(self.books_collection.find({"_id": {"$in": normalized_ids}}))
            
            if not books_data:
                print(f"No books found with the provided IDs", file=sys.stderr)
                return {}
            
            # Prepare book content for TF-IDF
            book_contents = {}
            for book in books_data:
                book_id = str(book["_id"])
                
                # Combine title, authors, and description for content
                title = book.get('title', '') or ''
                authors = ' '.join(book.get('author_names', []) or [])
                desc = book.get('description', '') or ''
                
                book_contents[book_id] = f"{title} {authors} {desc}"
            
            # Create TF-IDF vectorizer
            vectorizer = TfidfVectorizer(
                stop_words='english',
                max_df=0.85,
                min_df=1,
                ngram_range=(1, 2)
            )
            
            # Create content list maintaining order for matrix indexing
            book_ids = list(book_contents.keys())
            content_list = [book_contents[book_id] for book_id in book_ids]
            
            # Compute TF-IDF matrix
            tfidf_matrix = vectorizer.fit_transform(content_list)
            
            # Compute pairwise similarity
            similarity_matrix = cosine_similarity(tfidf_matrix)
            
            # Create similarity map between all pairs of books
            similarity_map = {}
            for i, book_id_1 in enumerate(book_ids):
                similarity_map[book_id_1] = {}
                for j, book_id_2 in enumerate(book_ids):
                    if i != j:  # Skip self-similarity
                        similarity_map[book_id_1][book_id_2] = float(similarity_matrix[i, j])
            
            return similarity_map
            
        except Exception as e:
            print(f"Error calculating pairwise similarity: {str(e)}", file=sys.stderr)
            traceback.print_exc(file=sys.stderr)
            return {}
            
    def close(self):
        """Close MongoDB connection"""
        if hasattr(self, 'client'):
            self.client.close()

def main():
    try:
        if len(sys.argv) < 2:
            raise ValueError("At least one book ID argument is required")
        
        book_ids = sys.argv[1:]
        print(f"Calculating similarity for books: {book_ids}", file=sys.stderr)
        
        calculator = BookSimilarityCalculator()
        
        # If first argument is followed by multiple IDs, calculate similarity between first book and others
        if len(book_ids) > 1:
            reference_id = book_ids[0]
            target_ids = book_ids[1:]
            result = calculator.calculate_similarity(reference_id, target_ids)
        else:
            raise ValueError("Need at least two book IDs (reference and target)")
        
        # Return the similarity data
        print(json.dumps(result))
        calculator.close()
        
    except Exception as e:
        print(f"Error in main: {str(e)}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        print(json.dumps({}))
        sys.exit(1)

# Command line interface
if __name__ == "__main__":
    main()