// src/pages/MyBooksPage.tsx
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useUserBooks } from '../contexts/UserBookContext';
import { Book } from '../types/Book';
import { useNavigate } from 'react-router-dom';
import BookClusterMap from '../components/MapPanel.tsx';

function MyBooksPage() {
  const { isAuthenticated } = useAuth();
  const { readingList, currentlyReading, finishedBooks, isInitialLoading } = useUserBooks();
  const navigate = useNavigate();
  const [books, setBooks] = useState<Book[]>([]);
  const [recommendations, setRecommendations] = useState<Book[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [readingStatus, setReadingStatus] = useState<Record<string, 'reading' | 'to-read' | 'finished'>>({});
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [similarityData, setSimilarityData] = useState<Record<string, Record<string, number>>>({});
  
  // Fetch books and user data
  useEffect(() => {  
    const fetchBooks = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('http://localhost:8000/api/books');
        if (!response.ok) throw new Error('Failed to fetch books');
        
        const data = await response.json();
        setBooks(data.books);
      } catch (error) {
        console.error('Failed to fetch books:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchBooks();
  }, []);
  
  // Fetch book ratings
  useEffect(() => {
    const fetchRatings = async () => {
      try {
        // Extract ratings from the user's finishedBooks data
        // We already have this data from the auth context
        const ratingsMap: Record<string, number> = {};
        
        finishedBooks.forEach(item => {
          if (item.rating !== null && item.rating !== undefined) {
            ratingsMap[item.bookId] = item.rating;
          }
        });
        
        setRatings(ratingsMap);
      } catch (error) {
        console.error('Failed to process ratings:', error);
        setRatings({});
      }
    };
    

    if (finishedBooks.length > 0) {
      fetchRatings();
    }
  }, [finishedBooks]);
  
  // Fetch similarity data and recommendations
  useEffect(() => {
    const fetchSimilarityData = async () => {
      try {
        // Extract user book IDs that have ratings
        const userBookIds = Object.keys(ratings).filter(id => ratings[id] >= 4);
        
        console.log('Highly rated book IDs:', userBookIds);
        
        // Initialize empty similarity data
        let similarityData = {};
        
        // Only fetch similarities if we have rated books
        if (userBookIds.length >= 2) {
          // Fetch pairwise similarity between all user books
          const response = await fetch(`http://localhost:8000/api/books/pairwise-similarity?bookIds=${userBookIds.join(',')}`);
          
          if (!response.ok) {
            console.error('Similarity API error:', await response.text());
            throw new Error(`Failed to fetch book similarities: ${response.status} ${response.statusText}`);
          }
          
          similarityData = await response.json();
          console.log('Received similarity data:', similarityData);
        } else {
          console.log('Not enough rated books for similarity calculation');
        }
        
        setSimilarityData(similarityData);
        
        // Fetch user's saved recommendations
        const token = localStorage.getItem('token');
        const recommendationsResponse = await fetch('http://localhost:8000/api/user/recommendations', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!recommendationsResponse.ok) {
          console.error('Recommendations API error:', await recommendationsResponse.text());
          throw new Error('Failed to fetch recommendations');
        }
        
        const recommendationsData = await recommendationsResponse.json();
        console.log('Received recommendations:', recommendationsData);
        
        // Map the recommendations data to the Book format
        const mappedRecommendations: Book[] = recommendationsData.recommendations?.map((rec: any) => {
          // Extract the numeric ID from the OL work ID (OLxxxxxxW format)
          const olId = rec.id.replace(/^OL/, '').replace(/W$/, '');
          
          return {
            _id: rec.id,
            title: rec.title,
            author_names: [rec.author],
            // Use the Work ID for cover if cover_url is empty
            cover_id: rec.cover_url ? rec.cover_url.split('/').pop()?.split('-')[0] : olId,
            olid: rec.id, // Store original Open Library ID
            similarityScore: rec.similarity_score
          };
        }) || [];
        
        
        setRecommendations(mappedRecommendations);
        
      } catch (error) {
        console.error('Failed to fetch similarity data or recommendations:', error);
        setSimilarityData({});
        setRecommendations([]);
      }
    };
    
    

    if (!isLoading && books.length > 0 && Object.keys(ratings).length > 0) {
      fetchSimilarityData();
    }
  }, [books, isLoading, ratings]);
  
  // Create a map of book status for all user books
  useEffect(() => {
    const statusMap: Record<string, 'reading' | 'to-read' | 'finished'> = {};
    
    // Mark reading list books
    readingList.forEach(bookId => {
      statusMap[bookId] = 'to-read';
    });
    
    // Mark currently reading books
    currentlyReading.forEach(bookId => {
      statusMap[bookId] = 'reading';
    });
    
    // Mark finished books
    finishedBooks.forEach(item => {
      statusMap[item.bookId] = 'finished';
    });
    
    setReadingStatus(statusMap);
  }, [readingList, currentlyReading, finishedBooks]);

  // Get all user books
  const userBooks = books.filter(book => 
    readingList.includes(book._id) || 
    currentlyReading.includes(book._id) || 
    finishedBooks.some(fb => fb.bookId === book._id)
  );

  // Redirect non-authenticated users to login
  if (!isAuthenticated && !isInitialLoading) {
    return (
      <div className="p-8 bg-gray-800 rounded-lg text-center">
        <h2 className="text-2xl font-bold text-white mb-4">You need to be logged in</h2>
        <p className="text-gray-400 mb-6">Please log in to view your book collections.</p>
        <button 
          className="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
          onClick={() => navigate('/')}
        >
          Go to Home Page
        </button>
      </div>
    );
  }

  if (isInitialLoading || isLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center z-50 bg-zinc-900 bg-opacity-80">
        <div className="relative w-16 h-16">
          <div className="absolute top-0 left-0 w-full h-full border-4 border-gray-600 rounded-full"></div>
          <div className="absolute top-0 left-0 w-full h-full border-4 border-t-red-600 rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  const hasAnyBooks = userBooks.length > 0 || recommendations.length > 0;

  return (
    <div className="space-y-5">
      <h1 className="text-3xl font-bold text-white mb-8">My Books - Cluster Map</h1>
      
      {hasAnyBooks ? (
        <BookClusterMap 
          books={userBooks} 
          readingStatus={readingStatus} 
          recommendations={recommendations}
          similarityData={similarityData}
          ratings={ratings}
        />
      ) : (
        <div className="bg-gray-800 p-8 rounded-lg text-center">
          <h3 className="text-xl font-bold text-white mb-4">You don't have any books yet</h3>
          <p className="text-gray-400 mb-6">Start by exploring the library and adding books to your collections.</p>
          <button 
            className="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
            onClick={() => navigate('/explore')}
          >
            Explore Books
          </button>
        </div>
      )}
      
      <div className="bg-gray-800 p-4 rounded-lg mt-4">
        <h3 className="text-md font-semibold text-white mb-2">How to use:</h3>
        <ul className="text-gray-400 text-sm list-disc pl-5">
          <li>Books are colored by their status (blue = reading, green = to read, red = finished, purple = recommended)</li>
          <li>Books with gold borders are rated 5 stars</li>
          <li>Connected books by purple dotted lines are similar to each other</li>
          <li>Recommendations appear based on your highly-rated books</li>
          <li>Click a book to see details and rating</li>
          <li>Switch between clustering methods using the buttons above</li>
        </ul>
      </div>
    </div>
  );
}

export default MyBooksPage;
