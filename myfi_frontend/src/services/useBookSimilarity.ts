// src/services/useBookSimilarity.ts
import { useState, useEffect } from 'react';
import axios from 'axios';
import { Book } from '../types/Book';

interface PairwiseSimilarityResponse {
  [bookId: string]: {
    [otherBookId: string]: number;
  };
}

/**
 * Hook for managing book similarity data
 */
const useBookSimilarity = (books: Book[], shouldFetch: boolean = true) => {
  const [similarityData, setSimilarityData] = useState<Record<string, Record<string, number>>>({});
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);

  useEffect(() => {
    const fetchSimilarityData = async () => {
      if (!books.length || books.length < 2 || !shouldFetch) return;

      setIsLoading(true);
      setError(null);
      setProgress(0);

      try {
        // Extract book IDs
        const bookIds = books.map(book => book._id);
        
        // For large collections, fetch in batches to avoid timeout issues
        const batchSize = 20;
        const formattedData: Record<string, Record<string, number>> = {};
        
        // Initialize empty similarity maps for all books
        books.forEach(book => {
          formattedData[book._id] = {};
        });
        
        // If small enough collection, fetch all at once
        if (books.length <= batchSize * 1.5) {
          setProgress(10); // Show some initial progress
          
          const response = await axios.get(`http://localhost:8000/api/books/pairwise-similarity`, {
            params: {
              bookIds: bookIds.join(',')
            }
          });
          
          const similarityResponse = response.data as PairwiseSimilarityResponse;
          
          // Merge response data into our formatted structure
          Object.entries(similarityResponse).forEach(([bookId, similarities]) => {
            formattedData[bookId] = { ...formattedData[bookId], ...similarities };
          });
          
          setProgress(100);
        } 
        // For larger collections, fetch in batches
        else {
          const batches: string[][] = [];
          
          // Create batches of book IDs
          for (let i = 0; i < bookIds.length; i += batchSize) {
            batches.push(bookIds.slice(i, i + batchSize));
          }
          
          let completedBatches = 0;
          
          // Process batches sequentially to avoid overwhelming the server
          for (const batch of batches) {
            const response = await axios.get(`http://localhost:8000/api/books/pairwise-similarity`, {
              params: {
                bookIds: batch.join(',')
              }
            });
            
            const batchResponse = response.data as PairwiseSimilarityResponse;
            
            // Merge batch data into our formatted structure
            Object.entries(batchResponse).forEach(([bookId, similarities]) => {
              formattedData[bookId] = { ...formattedData[bookId], ...similarities };
            });
            
            completedBatches++;
            setProgress(Math.round((completedBatches / batches.length) * 100));
          }
        }
        
        // Fill in missing values with a default low similarity
        books.forEach(book1 => {
          books.forEach(book2 => {
            if (book1._id !== book2._id) {
              if (!formattedData[book1._id][book2._id]) {
                formattedData[book1._id][book2._id] = 0.01;
              }
            }
          });
        });
        
        setSimilarityData(formattedData);
      } catch (err) {
        console.error('Error fetching similarity data:', err);
        setError('Failed to load book similarity data');
        
        // Create fallback similarity data with random values
        const fallbackData: Record<string, Record<string, number>> = {};
        books.forEach(book => {
          fallbackData[book._id] = {};
          books.forEach(otherBook => {
            if (book._id !== otherBook._id) {
              // Generate random similarity between 0.1 and 0.9
              fallbackData[book._id][otherBook._id] = 0.1 + Math.random() * 0.8;
            }
          });
        });
        
        setSimilarityData(fallbackData);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSimilarityData();
  }, [books, shouldFetch]);

  return {
    similarityData,
    isLoading,
    error,
    progress,
    refreshSimilarityData: () => {
      setSimilarityData({});
      setIsLoading(true);
      setError(null);
      setProgress(0);
    }
  };
};

export default useBookSimilarity;
