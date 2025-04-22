// src/pages/HomePage.tsx
import { useEffect, useState, useRef, useCallback } from 'react';
import { Book } from '../types/Book';
import { BookSegment } from '../types/BookSegment';
import { BookSegmentRow } from '../components/BookSegment';
import { SegmentManager } from '../services/segmentManager';
import { useAuth } from '../contexts/AuthContext';
import { useUserBooks } from '../contexts/UserBookContext';

interface ApiResponse {
  books: Book[];
  userData?: {
    currentlyReading: string[];
    readingList: string[];
    finishedBooks: string[];
  };
}

function HomePage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [segments, setSegments] = useState<BookSegment[]>([]);
  const [isLoadingBooks, setIsLoadingBooks] = useState(true);
  const [isGeneratingSegments, setIsGeneratingSegments] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { 
    currentlyReading, 
    readingList,
    finishedBooks, 
    isInitialLoading: userBooksInitialLoading 
  } = useUserBooks();
  
  // Track if we've done the initial segment generation
  const initialSegmentsGenerated = useRef(false);

  // Calculate overall loading state - only for initial loading, not updates!
  const isLoading = isLoadingBooks || 
    (isAuthenticated && userBooksInitialLoading) || 
    (!initialSegmentsGenerated.current && isGeneratingSegments) ||
    authLoading;

  const [recommendationsNeedUpdate, setRecommendationsNeedUpdate] = useState(false);

  useEffect(() => {
    const checkRecommendationStatus = () => {
      const needsUpdate = localStorage.getItem('recommendationsNeedUpdate') === 'true';
      setRecommendationsNeedUpdate(needsUpdate);
    };
    
    // Check immediately
    checkRecommendationStatus();
    
    // Listen for storage events (in case another tab changes it)
    window.addEventListener('storage', checkRecommendationStatus);
    
    // Listen for custom event from SegmentManager
    window.addEventListener('recommendationsUpdated', () => {
      setRecommendationsNeedUpdate(false);
    });
    
    return () => {
      window.removeEventListener('storage', checkRecommendationStatus);
      window.removeEventListener('recommendationsUpdated', () => {
        setRecommendationsNeedUpdate(false);
      });
    };
  }, []);

  // First effect: Load books data
  useEffect(() => {
    const fetchBooks = async () => {
      try {
        setIsLoadingBooks(true);
        
        const headers: HeadersInit = {};
        // Only add token if the user is authenticated
        if (isAuthenticated) {
          const token = localStorage.getItem('token');
          if (token) {
            headers['Authorization'] = `Bearer ${token}`;
          }
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

    // If user logs out, reset the segments
    if (!isAuthenticated && !authLoading) {
      initialSegmentsGenerated.current = false;
      // Clear any user-specific data
      setSegments([]);
    }

    fetchBooks();
  }, [isAuthenticated, authLoading]);

  // Second effect: Generate segments when books or user data changes
  useEffect(() => {
    const generateBookSegments = async () => {
      // Only generate segments if books are loaded
      if (books.length === 0) return;
      
      // If authenticated and during initial load, wait until user data is loaded
      if (isAuthenticated && userBooksInitialLoading) return;
      
      // Don't show loading screen for updates to the lists, only initial generation
      const isInitialGeneration = !initialSegmentsGenerated.current;
      
      // Skip re-generation if we already have segments unless a re-generation is needed
      if (segments.length > 0 && !recommendationsNeedUpdate && !isInitialGeneration) {
        console.log('Skipping segment regeneration - no update needed');
        return;
      }
      
      try {
        setIsGeneratingSegments(true);
        console.log("Generating segments with:", {
          booksCount: books.length,
          readingList: isAuthenticated ? readingList : [],
          currentlyReading: isAuthenticated ? currentlyReading : [],
          finishedBooks: isAuthenticated ? finishedBooks : [],
          isAuthenticated,
          isInitialGeneration,
          recommendationsNeedUpdate
        });
        
        // Only pass user data if authenticated
        const generatedSegments = await SegmentManager.generateSegments(
          books,
          isAuthenticated ? readingList : [],
          isAuthenticated ? currentlyReading : [],
          isAuthenticated ? finishedBooks.map(fb => fb.bookId) : []
        );
        
        console.log("Segments generated:", generatedSegments.length);
        setSegments(generatedSegments);
        
        // Mark that we've done the initial generation
        initialSegmentsGenerated.current = true;
        
        // Clear the update flag if it was set
        if (recommendationsNeedUpdate) {
          setRecommendationsNeedUpdate(false);
          localStorage.removeItem('recommendationsNeedUpdate');
        }
      } catch (err) {
        console.error("Error generating segments:", err);
        setError(err instanceof Error ? err.message : 'Failed to generate segments');
      } finally {
        setIsGeneratingSegments(false);
      }
    };

    generateBookSegments();
  }, [
    books, 
    isAuthenticated, 
    userBooksInitialLoading, 
    readingList, 
    currentlyReading, 
    finishedBooks, 
    recommendationsNeedUpdate
  ]);
  
  if (isLoading) return (
    <div className="fixed inset-0 flex items-center justify-center z-50 bg-zinc-900 bg-opacity-80">
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
    <>
      {segments.length > 0 ? (
        segments.map(segment => (
          <BookSegmentRow key={segment.id} segment={segment} />
        ))
      ) : (
        <div className="flex justify-center py-12 text-gray-400">
          No book segments available
        </div>
      )}
    </>
  );
}

export default HomePage;
