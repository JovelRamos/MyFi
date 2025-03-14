// UserBookContext.tsx
import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import api from '../services/api';
import { useAuth } from './AuthContext';

type UserBookState = {
  readingList: string[];
  currentlyReading: string[];
  finishedBooks: string[];
  ratings: {bookId: string, rating: number}[];
  isInitialLoading: boolean;
  addToReadingList: (bookId: string) => Promise<void>;
  removeFromReadingList: (bookId: string) => Promise<void>;
  markAsCurrentlyReading: (bookId: string) => Promise<void>;
  removeFromCurrentlyReading: (bookId: string) => Promise<void>; // Add this
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
  const [finishedBooks, setFinishedBooks] = useState<string[]>([]);
  const [ratings, setRatings] = useState<{bookId: string, rating: number}[]>([]);
  const [isInitialLoading, setIsInitialLoading] = useState(false); // Rename to clarify purpose

  useEffect(() => {
    const fetchUserData = async () => {
      if (!isAuthenticated) {
        // Reset logic...
        return;
      }
      
      setIsInitialLoading(true);
      try {
        // Instead of making another API call, use the user data directly if available
        if (user && user.finishedBooks) {
          setReadingList(user.readingList || []);
          setCurrentlyReading(user.currentlyReading || []);
          setFinishedBooks(user.finishedBooks || []);
          // Handle ratings separately if needed
          
          console.log("Using data from auth context:", user.finishedBooks);
        } else {
          // Fallback to API call if user data is incomplete
          const token = localStorage.getItem('token');
          if (token) {
            const response = await api.get('/auth/verify');
            console.log("API response in fallback:", response.data);
            
            setReadingList(response.data.readingList || []);
            setCurrentlyReading(response.data.currentlyReading || []);
            setFinishedBooks(response.data.finishedBooks || []);
            setRatings(response.data.ratings || []);
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
      
      // Also add to reading list if not already there
      if (!readingList.includes(bookId)) {
        await addToReadingList(bookId);
      }
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
      setRatings(response.data.ratings);
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
      ratings,
      isInitialLoading, 
      addToReadingList,
      removeFromReadingList,
      markAsCurrentlyReading,
      removeFromCurrentlyReading, // Add this new function
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
