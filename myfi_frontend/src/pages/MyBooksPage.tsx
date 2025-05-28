// myfi_frontend/src/pages/MyBooksPage.tsx
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
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load user books first
  useEffect(() => {
    const fetchBooks = async () => {
      if (!isAuthenticated || isInitialLoading) return;
      
      try {
        setLoading(true);
        setError(null);

        const allBookIds = [...new Set([
          ...readingList,
          ...currentlyReading,
          ...finishedBooks.map(book => book.bookId)
        ])];

        if (allBookIds.length === 0) {
          setBooks([]);
          setLoading(false);
          return;
        }

        const response = await api.get('/books');
        const allBooks = response.data.books;
        
        const userBooks = allBooks.filter((book: Book) => 
          allBookIds.includes(book._id)
        );
        setBooks(userBooks);

      } catch (err) {
        console.error('Error fetching books:', err);
        setError('Failed to load your books');
      } finally {
        setLoading(false);
      }
    };

    fetchBooks();
  }, [isAuthenticated, isInitialLoading, readingList, currentlyReading, finishedBooks]);


// Load recommendations separately
useEffect(() => {
  let isActiveCall = true;
  const fetchRecommendations = async () => {
  if (!isAuthenticated || loading) return;

  try {
    setLoadingRecommendations(true);
    
    const recResponse = await api.get('/user/recommendations');
    
    if (!isActiveCall) return;
    
    const recBooks = recResponse.data.recommendations || [];
    
    // Fetch complete book data from database to get cover_id
    const bookIds = recBooks.map((rec: any) => rec.id || rec._id);
    let booksWithCoverData = [];
    
    if (bookIds.length > 0) {
      const booksResponse = await api.get('/books');
      const allBooks = booksResponse.data.books;
      booksWithCoverData = allBooks.filter((book: Book) => 
        bookIds.includes(book._id)
      );
    }
    
    const formattedRecs = recBooks.map((rec: any) => {
      // Find the corresponding book data with cover_id
      const bookData = booksWithCoverData.find(book => book._id === (rec.id || rec._id));
      
      return {
        _id: rec.id || rec._id,
        title: rec.title,
        author_names: rec.author_names || rec.author,
        description: rec.description,
        cover_id: bookData?.cover_id || rec.cover_id || rec.coverId || rec.cover_edition_key,
        ratings_average: rec.ratings_average || 0,
        similarity_score: rec.similarity_score || 1.0
      };
    });
    
    setRecommendations(formattedRecs);
  } catch (recError) {
    console.warn('Failed to fetch recommendations:', recError);
    if (isActiveCall) setRecommendations([]);
  } finally {
    if (isActiveCall) setLoadingRecommendations(false);
  }
};

  fetchRecommendations();
  
  return () => {
    isActiveCall = false;
  };
}, [isAuthenticated, loading, user?.id]);



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
        if (rec.similarityScore && rec.similarityScore > 0.3) {
          data[book._id][rec._id] = rec.similarityScore;
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
          {loadingRecommendations && " (loading recommendations...)"}
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
