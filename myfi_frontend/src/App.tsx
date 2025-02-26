import { useState, useEffect } from 'react';
import { Book } from './types/Book';
import { BookSegment } from './types/BookSegment';
import { BookSegmentRow } from './components/BookSegment';
import { SegmentManager } from './services/segmentManager';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { UserBookProvider } from './contexts/UserBookContext';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import AuthButtons from './components/AuthButtons'; // Import AuthButtons

interface ApiResponse {
  books: Book[];
  userData?: {
    currentlyReading: string[];
    readingList: string[];
  };
}

function AppContent() {
  const [books, setBooks] = useState<Book[]>([]);
  const [segments, setSegments] = useState<BookSegment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentlyReading, setCurrentlyReading] = useState<string[]>([]);
  const [readingList, setReadingList] = useState<string[]>([]);
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    const fetchBooksAndCreateSegments = async () => {
      try {
        const headers: HeadersInit = {};
        const token = localStorage.getItem('token');
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch('http://localhost:8000/api/books', {
          headers
        });
        
        if (!response.ok) throw new Error('Failed to fetch books');
        
        const data: ApiResponse = await response.json();
        setBooks(data.books);
        
        if (isAuthenticated) {
          setCurrentlyReading(data.userData?.currentlyReading || []);
          setReadingList(data.userData?.readingList || []);
        } else {
          setCurrentlyReading([]);
          setReadingList([]);
        }

        const generatedSegments = await SegmentManager.generateSegments(
          data.books,
          data.userData?.readingList || [],
          data.userData?.currentlyReading || []
        );
        setSegments(generatedSegments);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setIsLoading(false);
      }
    };

    fetchBooksAndCreateSegments();
  }, [isAuthenticated]); // Add isAuthenticated as dependency

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className="min-w-screen bg-zinc-900">
<header className="bg-gray-800 border-b border-gray-700">
  <div className="max-w-[3840px] min-w-[1920px] mx-auto py-4 px-24 flex justify-between items-center">
    <div className="flex items-center space-x-4">
      <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">
        MyFi Books
      </h1>
      <span className="px-2 py-1 text-xs font-medium bg-gray-700 rounded-full text-gray-300">
        Beta
      </span>
    </div>
    
    <AuthButtons />
  </div>
</header>


      <main className="max-w-[3840px] min-w-[1920px] mx-auto py-12 px-120">
        {segments.map(segment => (
          <BookSegmentRow key={segment.id} segment={segment} />
        ))}
      </main>
      <ToastContainer position="bottom-right" />

    </div>
  );
}

function App() {
  return (
    <UserBookProvider>
    <AuthProvider>
      <AppContent />
    </AuthProvider>
    </UserBookProvider>
  );
}

export default App;