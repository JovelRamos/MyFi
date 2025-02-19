import { useState, useEffect } from 'react';
import { Book } from './types/Book';
import { BookSegment } from './types/BookSegment';
import { BookSegmentRow } from './components/BookSegment';
import { SegmentManager } from './services/segmentManager';
import { AuthProvider } from './contexts/AuthContext';
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

  useEffect(() => {
    const fetchBooksAndCreateSegments = async () => {
      try {
        const response = await fetch('http://localhost:8000/api/books');
        if (!response.ok) throw new Error('Failed to fetch books');
        
        const data: ApiResponse = await response.json();
        setBooks(data.books);
        
        setCurrentlyReading(data.userData?.currentlyReading || []);
        setReadingList(data.userData?.readingList || []);

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
  }, []);

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className="min-w-screen bg-zinc-900">
      <header className="bg-gray-800 shadow">
        <div className="max-w-[3840px] min-w-[1920px] mx-auto py-6 px-24 flex justify-between items-center">
          <h1 className="text-3xl font-bold text-white">
            MyFi Books
          </h1>
          <AuthButtons /> {/* Add AuthButtons here */}
        </div>
      </header>

      <main className="max-w-[3840px] min-w-[1920px] mx-auto py-12 px-120">
        {segments.map(segment => (
          <BookSegmentRow key={segment.id} segment={segment} />
        ))}
      </main>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
