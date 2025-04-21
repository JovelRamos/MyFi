// UserBookContext.tsx
import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import api from '../services/api';
import { useAuth } from './AuthContext';


type UserBookState = {
  readingList: string[];
  currentlyReading: string[];
  finishedBooks: {bookId: string, rating: number | null}[];
  isInitialLoading: boolean;
  addToReadingList: (bookId: string) => Promise<void>;
  removeFromReadingList: (bookId: string) => Promise<void>;
  markAsCurrentlyReading: (bookId: string) => Promise<void>;
  removeFromCurrentlyReading: (bookId: string) => Promise<void>;
  markAsFinished: (bookId: string) => Promise<void>;
  rateBook: (bookId: string, rating: number) => Promise<void>;
};
const UserBookContext = createContext<UserBookState | undefined>(undefined);

export const UserBookProvider = ({ children }: { children: ReactNode }) => {
  return <UserBookProviderContent>{children}</UserBookProviderContent>;
};

const UserBookProviderContent = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated, user } = useAuth();
  const [readingList, setReadingList] = useState<string[]>([]);
  const [currentlyReading, setCurrentlyReading] = useState<string[]>([]);
  const [finishedBooks, setFinishedBooks] = useState<{bookId: string, rating: number | null}[]>([]);
  const [isInitialLoading, setIsInitialLoading] = useState(false);

  useEffect(() => {
    const fetchUserData = async () => {
      if (!isAuthenticated) {
        // Reset states when not authenticated
        setReadingList([]);
        setCurrentlyReading([]);
        setFinishedBooks([]);
        return;
      }
      
      setIsInitialLoading(true);
      try {
        // Instead of making another API call, use the user data directly if available
        if (user && user.finishedBooks) {
          setReadingList(user.readingList || []);
          setCurrentlyReading(user.currentlyReading || []);
          
          // Handle legacy data structure or new structure
          if (Array.isArray(user.finishedBooks) && 
              user.finishedBooks.length > 0 && 
              typeof user.finishedBooks[0] === 'string') {
            // Convert old format to new format
            const oldFinishedBooks = user.finishedBooks as unknown as string[];
            const ratings = user.ratings || [];
            
            // Map old format to new format
            const newFinishedBooks = oldFinishedBooks.map(bookId => {
              const rating = ratings.find(r => r.bookId === bookId)?.rating || null;
              return { bookId, rating };
            });
            
            setFinishedBooks(newFinishedBooks);
          } else {
            // New format
            setFinishedBooks(user.finishedBooks as unknown as {bookId: string, rating: number | null}[] || []);
          }
          
          console.log("Using data from auth context:", user.finishedBooks);
        } else {
          // Fallback to API call if user data is incomplete
          const token = localStorage.getItem('token');
          if (token) {
            const response = await api.get('/auth/verify');
            console.log("API response in fallback:", response.data);
            
            setReadingList(response.data.readingList || []);
            setCurrentlyReading(response.data.currentlyReading || []);
            
            // Handle potential legacy data structure
            if (Array.isArray(response.data.finishedBooks) && 
                response.data.finishedBooks.length > 0 && 
                typeof response.data.finishedBooks[0] === 'string') {
              // Convert old format to new format
              const oldFinishedBooks = response.data.finishedBooks as string[];
              const ratings = response.data.ratings || [];
              
              const newFinishedBooks = oldFinishedBooks.map(bookId => {
                const rating = ratings.find((r: {bookId: string, rating: number}) => r.bookId === bookId)?.rating || null;
                return { bookId, rating };
              });
              
              setFinishedBooks(newFinishedBooks);
            } else {
              // Already in new format
              setFinishedBooks(response.data.finishedBooks as {bookId: string, rating: number | null}[] || []);
            }
          }
        }
      } catch (error) {
        console.error('Failed to load user data', error);
      } finally {
        setIsInitialLoading(false);
      }
    };
  
    fetchUserData();
  }, [isAuthenticated, user]);

  // Book list management functions - these won't trigger the loading state
  const addToReadingList = async (bookId: string) => {
    try {
      const response = await api.post('/user/reading-list', { 
        bookId, 
        action: 'add' 
      });
      setReadingList(response.data.readingList);
    } catch (error) {
      console.error('Failed to add book to reading list', error);
      throw error;
    }
  };

  const removeFromCurrentlyReading = async (bookId: string) => {
    try {
      const response = await api.post('/user/currently-reading', { 
        bookId,
        action: 'remove'
      });
      setCurrentlyReading(response.data.currentlyReading);
    } catch (error) {
      console.error('Failed to remove book from currently reading', error);
      throw error;
    }
  };

  const removeFromReadingList = async (bookId: string) => {
    try {
      const response = await api.post('/user/reading-list', { 
        bookId, 
        action: 'remove' 
      });
      setReadingList(response.data.readingList);
    } catch (error) {
      console.error('Failed to remove book from reading list', error);
      throw error;
    }
  };

  const markAsCurrentlyReading = async (bookId: string) => {
    try {
      const response = await api.post('/user/currently-reading', { 
        bookId,
        action: 'add'
      });
      setCurrentlyReading(response.data.currentlyReading);
    
    } catch (error) {
      console.error('Failed to mark book as currently reading', error);
      throw error;
    }
  };

  const markAsFinished = async (bookId: string) => {
    try {
      const response = await api.post('/user/currently-reading', { 
        bookId,
        action: 'finish'
      });
      setCurrentlyReading(response.data.currentlyReading);
      setFinishedBooks(response.data.finishedBooks || []);
    } catch (error) {
      console.error('Failed to mark book as finished', error);
      throw error;
    }
  };

  const rateBook = async (bookId: string, rating: number) => {
    try {
      const response = await api.post('/user/rate-book', { bookId, rating });
      
      // Store the timestamp of when rating was changed
      localStorage.setItem('lastRatingChange', Date.now().toString());
      
      // Update finishedBooks with the new rating
      if (response.data.finishedBooks) {
        setFinishedBooks(response.data.finishedBooks);
      } else if (response.data.ratings) {
        // Handle legacy response format
        const updatedFinishedBooks = [...finishedBooks];
        const bookIndex = updatedFinishedBooks.findIndex(book => book.bookId === bookId);
        
        if (bookIndex !== -1) {
          // Update existing book
          updatedFinishedBooks[bookIndex] = { 
            ...updatedFinishedBooks[bookIndex],
            rating 
          };
        } else {
          // Add new book to finished books
          updatedFinishedBooks.push({ bookId, rating });
        }
        
        setFinishedBooks(updatedFinishedBooks);
      }
    } catch (error) {
      console.error('Failed to rate book', error);
      throw error;
    }
};

  return (
    <UserBookContext.Provider value={{ 
      readingList, 
      currentlyReading,
      finishedBooks,
      isInitialLoading, 
      addToReadingList,
      removeFromReadingList,
      markAsCurrentlyReading,
      removeFromCurrentlyReading,
      markAsFinished,
      rateBook
    }}>
      {children}
    </UserBookContext.Provider>
  );
};

export const useUserBooks = () => {
  const context = useContext(UserBookContext);
  if (context === undefined) {
    throw new Error('useUserBooks must be used within a UserBookProvider');
  }
  return context;
};
