// UserBookContext.tsx
import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import api from '../services/api';
import { useAuth } from './AuthContext';  // Import useAuth

type UserBookState = {
  readingList: string[];
  currentlyReading: string[];
  finishedBooks: string[];
  ratings: {bookId: string, rating: number}[];
  isLoading: boolean;
  addToReadingList: (bookId: string) => Promise<void>;
  removeFromReadingList: (bookId: string) => Promise<void>;
  markAsCurrentlyReading: (bookId: string) => Promise<void>;
  markAsFinished: (bookId: string) => Promise<void>;
  rateBook: (bookId: string, rating: number) => Promise<void>;
};

const UserBookContext = createContext<UserBookState | undefined>(undefined);

// Create a wrapper component that doesn't use useAuth
export const UserBookProvider = ({ children }: { children: ReactNode }) => {
  return <UserBookProviderContent>{children}</UserBookProviderContent>;
};

// The actual provider component that uses useAuth
const UserBookProviderContent = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated, user } = useAuth();
  const [readingList, setReadingList] = useState<string[]>([]);
  const [currentlyReading, setCurrentlyReading] = useState<string[]>([]);
  const [finishedBooks, setFinishedBooks] = useState<string[]>([]);
  const [ratings, setRatings] = useState<{bookId: string, rating: number}[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // When auth state changes, update loading state and fetch user data if authenticated
    const fetchUserData = async () => {
      if (!isAuthenticated) {
        // Reset all user data when not authenticated
        setReadingList([]);
        setCurrentlyReading([]);
        setFinishedBooks([]);
        setRatings([]);
        setIsLoading(false);
        return;
      }
      
      setIsLoading(true);
      try {
        const token = localStorage.getItem('token');
        if (token) {
          const response = await api.get('/auth/verify');
          setReadingList(response.data.readingList || []);
          setCurrentlyReading(response.data.currentlyReading || []);
          setFinishedBooks(response.data.finishedBooks || []);
          setRatings(response.data.ratings || []);
        }
      } catch (error) {
        console.error('Failed to load user data', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserData();
  }, [isAuthenticated, user]); // Depend on both auth state and user

  // Rest of the functions remain the same...
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
      isLoading,
      addToReadingList,
      removeFromReadingList,
      markAsCurrentlyReading,
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
