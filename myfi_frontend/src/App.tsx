import { useState, useEffect } from 'react';
import { Book } from './types/Book';
import { BookSegment } from './types/BookSegment';
import { BookSegmentRow } from './components/BookSegment';
import { SegmentManager } from './services/segmentManager';

interface ApiResponse {
  books: Book[];
  userData: {
    currentlyReading: string[];
    readingList: string[];
  };
}

function App() {
  const [books, setBooks] = useState<Book[]>([]);
  const [segments, setSegments] = useState<BookSegment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentlyReading, setCurrentlyReading] = useState<string[]>([]);
  const [readingList, setReadingList] = useState<string[]>([]);

  useEffect(() => {
    const fetchBooksAndCreateSegments = async () => {
      try {
        // Fetch books and user data
        const response = await fetch('http://localhost:8000/api/books');
        if (!response.ok) throw new Error('Failed to fetch books');
        
        const data: ApiResponse = await response.json();
        setBooks(data.books);
        setCurrentlyReading(data.userData.currentlyReading);
        setReadingList(data.userData.readingList);

        // Generate segments with the fetched data
        const generatedSegments = await SegmentManager.generateSegments(
          data.books,
          data.userData.readingList,
          data.userData.currentlyReading
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

  // Optional: Add effect to regenerate segments when user data changes
//   useEffect(() => {
//     const updateSegments = async () => {
//       if (books.length > 0) {
//         try {
//           const generatedSegments = await SegmentManager.generateSegments(
//             books,
//             readingList,
//             currentlyReading
//           );
//           setSegments(generatedSegments);
//         } catch (err) {
//           setError(err instanceof Error ? err.message : 'An error occurred');
//         }
//       }
//     };

//     updateSegments();
//   }, [books, readingList, currentlyReading]);

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
