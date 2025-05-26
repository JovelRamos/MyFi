// src/pages/MyBooksPage.tsx
import { useState, useEffect, useMemo } from 'react';
import { useUserBooks } from '../contexts/UserBookContext';
import { useAuth } from '../contexts/AuthContext';
import BookClusterMap from '../components/MapPanel';
import api from '../services/api';
import { Book } from '../types/Book';

export default function MyBooksPage() {
  const { user, isAuthenticated } = useAuth();
  const { readingList, currentlyReading, finishedBooks, isInitialLoading } = useUserBooks();
  
  const [books, setBooks] = useState<Book[]>([]);
  const [recommendations, setRecommendations] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch books and recommendations
  useEffect(() => {
    const fetchData = async () => {
      if (!isAuthenticated || isInitialLoading) return;
      
      try {
        setLoading(true);
        setError(null);

        // Get all unique book IDs from user's lists
        const allBookIds = [...new Set([
          ...readingList,
          ...currentlyReading,
          ...finishedBooks.map(book => book.bookId)
        ])];

        if (allBookIds.length === 0) {
          setBooks([]);
          setRecommendations([]);
          setLoading(false);
          return;
        }

        // Fetch book details
        const response = await api.get('/books');
        const allBooks = response.data.books;
        
        // Filter books to only include user's books
        const userBooks = allBooks.filter((book: Book) => 
          allBookIds.includes(book._id)
        );
        setBooks(userBooks);

        // Get recommendations based on highly rated books
        const highlyRatedBooks = finishedBooks
          .filter(book => book.rating && book.rating >= 4)
          .map(book => book.bookId);

        if (highlyRatedBooks.length > 0) {
          try {
            const recResponse = await api.get(`/recommendations_multiple?books=${highlyRatedBooks.join(',')}&userId=${user?.id}`);
            const recBooks = recResponse.data.map((rec: any) => ({
              _id: rec.id,
              title: rec.title,
              author_names: rec.author_names,
              description: rec.description,
              cover_id: rec.cover_id,
              ratings_average: 0,
              similarity_score: rec.similarity_score
            }));
            setRecommendations(recBooks);
          } catch (recError) {
            console.warn('Failed to fetch recommendations:', recError);
            setRecommendations([]);
          }
        }

      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load your books');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isAuthenticated, isInitialLoading, readingList, currentlyReading, finishedBooks, user?.id]);

  // Create reading status mapping
  const readingStatus = useMemo(() => {
    const status: Record<string, 'reading' | 'to-read' | 'finished'> = {};
    
    readingList.forEach(id => {
      status[id] = 'to-read';
    });
    
    currentlyReading.forEach(id => {
      status[id] = 'reading';
    });
    
    finishedBooks.forEach(book => {
      status[book.bookId] = 'finished';
    });
    
    return status;
  }, [readingList, currentlyReading, finishedBooks]);

  // Create ratings mapping
  const ratings = useMemo(() => {
    const ratingsMap: Record<string, number> = {};
    finishedBooks.forEach(book => {
      if (book.rating) {
        ratingsMap[book.bookId] = book.rating;
      }
    });
    return ratingsMap;
  }, [finishedBooks]);

  // Create similarity data for positioning
  const similarityData = useMemo(() => {
    const data: Record<string, Record<string, number>> = {};
    
    // Create similarity connections between books
    books.forEach(book => {
      data[book._id] = {};
      
      // Add connections to recommendations
      recommendations.forEach(rec => {
        if (rec.similarity_score && rec.similarity_score > 0.3) {
          data[book._id][rec._id] = rec.similarity_score;
        }
      });
    });
    
    return data;
  }, [books, recommendations]);

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Sign in to view your books</h2>
          <p className="text-gray-400">Please log in to see your reading collection and recommendations.</p>
        </div>
      </div>
    );
  }

  if (loading || isInitialLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading your books...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Error loading books</h2>
          <p className="text-gray-400">{error}</p>
        </div>
      </div>
    );
  }

  if (books.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-4">No books in your collection</h2>
          <p className="text-gray-400">Start adding books to your reading list to see them here!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-white mb-4">My Books</h1>
        <p className="text-gray-400">
          Explore your reading collection with {books.length} books 
          {recommendations.length > 0 && ` and ${recommendations.length} recommendations`}
        </p>
      </div>

      <div className="bg-gray-800 rounded-xl p-6">
        <BookClusterMap
          books={books}
          readingStatus={readingStatus}
          recommendations={recommendations}
          similarityData={similarityData}
          ratings={ratings}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
        <div className="bg-gray-800 rounded-lg p-6">
          <div className="text-3xl font-bold text-blue-400 mb-2">{currentlyReading.length}</div>
          <div className="text-gray-400">Currently Reading</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-6">
          <div className="text-3xl font-bold text-green-400 mb-2">{readingList.length}</div>
          <div className="text-gray-400">Want to Read</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-6">
          <div className="text-3xl font-bold text-red-400 mb-2">{finishedBooks.length}</div>
          <div className="text-gray-400">Books Finished</div>
        </div>
      </div>
    </div>
  );
}
