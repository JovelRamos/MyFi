import { useState, useEffect } from 'react';
import { Book } from './types/Book';
import { BookSegment } from './types/BookSegment';
import { BookSegmentRow } from './components/BookSegment';
import { SegmentManager } from './services/segmentManager';

function App() {
  const [books, setBooks] = useState<Book[]>([]);
  const [segments, setSegments] = useState<BookSegment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Simulated user data 
  const userReadingList = ['67a2863786be561bd64bb805', '67a2863786be561bd64bb808'];
  const currentlyReading = ['67a2863886be561bd64bb80e'];

  useEffect(() => {
    const fetchBooksAndCreateSegments = async () => {
      try {
        const response = await fetch('http://localhost:8000/api/books');
        if (!response.ok) throw new Error('Failed to fetch books');
        
        const booksData = await response.json();
        setBooks(booksData);
        
        const generatedSegments = SegmentManager.generateSegments(
          booksData,
          userReadingList,
          currentlyReading
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
        <div className="max-w-[3840px] min-w-[1920px] mx-auto py-6 px-24">
          <h1 className="text-3xl font-bold text-white">
            MyFi Books
          </h1>
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

export default App;
