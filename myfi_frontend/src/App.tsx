import { useState, useEffect, useRef } from 'react';
import { Book } from './types/Book';
import { BookSegment } from './types/BookSegment';
import { BookSegmentRow } from './components/BookSegment';
import { SegmentManager } from './services/segmentManager';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { UserBookProvider, useUserBooks } from './contexts/UserBookContext';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import AuthButtons from './components/AuthButtons';

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
  const [isLoadingBooks, setIsLoadingBooks] = useState(true);
  const [isGeneratingSegments, setIsGeneratingSegments] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { 
    currentlyReading, 
    readingList, 
    isInitialLoading: userBooksInitialLoading 
  } = useUserBooks();
  
  // Track if we've done the initial segment generation
  const initialSegmentsGenerated = useRef(false);

  // Calculate overall loading state - only for initial loading, not updates!
  const isLoading = isLoadingBooks || 
    (isAuthenticated && userBooksInitialLoading) || 
    (!initialSegmentsGenerated.current && isGeneratingSegments) ||
    authLoading;

  // First effect: Load books data
  useEffect(() => {
    const fetchBooks = async () => {
      try {
        setIsLoadingBooks(true);
        
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
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setIsLoadingBooks(false);
      }
    };

    fetchBooks();
  }, []);

  // Second effect: Generate segments when books or user data changes
  useEffect(() => {
    const generateBookSegments = async () => {
      // Only generate segments if books are loaded
      if (books.length === 0) return;
      
      // If authenticated and during initial load, wait until user data is loaded
      if (isAuthenticated && userBooksInitialLoading) return;
      
      // Don't show loading screen for updates to the lists, only initial generation
      const isInitialGeneration = !initialSegmentsGenerated.current;
      
      try {
        setIsGeneratingSegments(true);
        console.log("Generating segments with:", {
          booksCount: books.length,
          readingList: readingList,
          currentlyReading: currentlyReading,
          isInitialGeneration
        });
        
        const generatedSegments = await SegmentManager.generateSegments(
          books,
          readingList,
          currentlyReading
        );
        
        console.log("Segments generated:", generatedSegments.length);
        setSegments(generatedSegments);
        
        // Mark that we've done the initial generation
        initialSegmentsGenerated.current = true;
      } catch (err) {
        console.error("Error generating segments:", err);
        setError(err instanceof Error ? err.message : 'Failed to generate segments');
      } finally {
        setIsGeneratingSegments(false);
      }
    };

    generateBookSegments();
  }, [books, isAuthenticated, userBooksInitialLoading, readingList, currentlyReading]);

  if (isLoading) return (
    <div className="flex flex-col items-center justify-center h-screen w-screen bg-zinc-900">
      <div className="relative w-16 h-16">
        <div className="absolute top-0 left-0 w-full h-full border-4 border-gray-600 rounded-full"></div>
        <div className="absolute top-0 left-0 w-full h-full border-4 border-t-red-600 rounded-full animate-spin"></div>
      </div>
    </div>
  );
  
  if (error) return (
    <div className="flex flex-col items-center justify-center h-screen w-screen bg-zinc-900 text-white">
      <div className="p-6 bg-red-900 rounded-lg">
        <h3 className="text-xl font-bold mb-2">Error</h3>
        <p>{error}</p>
      </div>
    </div>
  );

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
        {segments.length > 0 ? (
          segments.map(segment => (
            <BookSegmentRow key={segment.id} segment={segment} />
          ))
        ) : (
          <div className="flex justify-center py-12 text-gray-400">
            No book segments available
          </div>
        )}
      </main>
      <ToastContainer position="bottom-right" />
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <UserBookProvider>
        <AppContent />
      </UserBookProvider>
    </AuthProvider>
  );
}

export default App;
