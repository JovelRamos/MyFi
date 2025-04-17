import { Book } from '../types/Book';
import { BookSegment, SegmentType } from '../types/BookSegment';

interface Recommendation {
    id: string;
    similarity_score: number;
    title: string;
}
export class SegmentManager {
    private static readonly BOOKS_PER_ROW = 6;
    private static readonly SEGMENT_SIZES = {
      CURRENTLY_READING: 6,
      BECAUSE_YOU_READ: 24,
      RECOMMENDED_FOR_YOU: 24,
      TRENDING_SCIFI: 24,
      TRENDING_FANTASY: 24,
      EPIC_SAGAS: 24,
      PRE_2000: 24,
      POST_2000: 24,
      MY_LIST: 24
    };
  
    private static adjustArrayToMultipleOfSix(books: Book[]): Book[] {
      const remainder = books.length % this.BOOKS_PER_ROW;
      if (remainder === 0) return books;
      
      // Calculate how many books to keep to make it a multiple of 6
      const newLength = books.length - remainder;
      return books.slice(0, newLength);
    }
  
    static async generateSegments(
        books: Book[],
        userReadingList: string[] = [],
        currentlyReading: string[] = [],
        finishedBooks: string[] = []
    ): Promise<BookSegment[]> {
        const segments: BookSegment[] = [];

        // Currently Reading (reverse order - most recent first)
        if (currentlyReading.length > 0) {
            // Get the currently reading books in the order they appear in the currentlyReading array
            const currentlyReadingBooksOrdered = [];
            
            // Process in reverse to get most recent (last items) first
            for (let i = currentlyReading.length - 1; i >= 0; i--) {
                const bookId = currentlyReading[i];
                const book = books.find(b => b._id === bookId);
                if (book) {
                    currentlyReadingBooksOrdered.push(book);
                }
            }
            
            if (currentlyReadingBooksOrdered.length > 0) {
                segments.push({
                    id: 'currently-reading',
                    title: 'Currently Reading',
                    type: 'CURRENTLY_READING',
                    books: currentlyReadingBooksOrdered,
                    priority: 1,
                    isPersonalized: true
                });
            }
        }

        // My List (reverse order - most recent first)
        if (userReadingList.length > 0) {
            // Get the my list books in the order they appear in the userReadingList array
            const myListBooksOrdered = [];
            
            // Process in reverse to get most recent (last items) first
            for (let i = userReadingList.length - 1; i >= 0; i--) {
                const bookId = userReadingList[i];
                const book = books.find(b => b._id === bookId);
                if (book) {
                    myListBooksOrdered.push(book);
                }
            }
            
            if (myListBooksOrdered.length > 0) {
                segments.push({
                    id: 'my-list',
                    title: 'My List',
                    type: 'MY_LIST',
                    books: myListBooksOrdered,
                    priority: 2,
                    isPersonalized: true
                });
            }
        }

        // ML-based recommendations based on finished books
        if (finishedBooks.length > 0) {
            try {
                console.log('Getting ML recommendations for finished books:', finishedBooks);
                const recommendedBooks = await this.getMLRecommendations(
                    finishedBooks,
                    books
                );
                console.log('Number of recommended books:', recommendedBooks.length);
                console.log('Recommended books:', recommendedBooks);
                
                if (recommendedBooks.length > 0) {
                    segments.push({
                        id: 'ml-recommendations',
                        title: 'Because You\'ve Read',
                        type: 'RECOMMENDED_FOR_YOU',
                        books: this.adjustArrayToMultipleOfSix(recommendedBooks),
                        priority: 3,
                        isPersonalized: true
                    });
                } else {
                    console.log('No recommendations were found');
                }
            } catch (error) {
                console.error('Failed to get ML recommendations:', error);
            }
        } else if (currentlyReading.length > 0) {
            // Fallback to currently reading if no finished books
            try {
                console.log('Falling back to currently reading for recommendations:', currentlyReading[0]);
                const recommendedBooks = await this.getMLRecommendations(
                    currentlyReading,
                    books
                );
                
                if (recommendedBooks.length > 0) {
                    segments.push({
                        id: 'ml-recommendations',
                        title: 'Recommended For You',
                        type: 'RECOMMENDED_FOR_YOU',
                        books: this.adjustArrayToMultipleOfSix(recommendedBooks),
                        priority: 3,
                        isPersonalized: true
                    });
                }
            } catch (error) {
                console.error('Failed to get ML recommendations fallback:', error);
            }
        }

        // Because You're Reading (using the most recent currently reading book)
        if (currentlyReading.length > 0) {
            // Get the most recent book (last item in the array)
            const mostRecentBookId = currentlyReading[currentlyReading.length - 1];
            
            console.log('Most recent book ID (before cleanup):', mostRecentBookId);

            // Clean up the ID
            const cleanMostRecentId = mostRecentBookId.replace('/works/', '').trim();
            
            console.log('Looking for book with clean ID:', cleanMostRecentId);

            const sourceBook = books.find(book => {
                const cleanBookId = book._id.replace('/works/', '').trim();
                return cleanBookId === cleanMostRecentId;
            });

            console.log('Found source book:', sourceBook);

            if (sourceBook) {
                try {
                    console.log('Getting recommendations for most recent book:', sourceBook.title);
                    const similarBooks = await this.getMLRecommendations(
                        [mostRecentBookId],
                        books.filter(b => b._id !== sourceBook._id)
                    );
                    
                    if (similarBooks.length > 0) {
                        segments.push({
                            id: `because-${sourceBook._id}`,
                            title: `Because You're Reading ${sourceBook.title}`,
                            type: 'BECAUSE_YOU_READ',
                            books: this.adjustArrayToMultipleOfSix(similarBooks),
                            priority: 4,
                            isPersonalized: true,
                            sourceBook
                        });
                    }
                } catch (error) {
                    console.error('Failed to get Because You Read recommendations:', error);
                    console.error('Source book:', sourceBook);
                }
            } else {
                console.error('Source book not found. Details:', {
                    originalId: mostRecentBookId,
                    cleanId: cleanMostRecentId,
                    currentlyReading,
                    availableBookIds: books.slice(0, 5).map(b => ({
                        id: b._id,
                        cleanId: b._id.replace('/works/', '').trim(),
                        title: b.title
                    }))
                });
            }
        }

        // Create a pool of remaining books for generic segments
        // Track the books we've used to avoid duplicates
        const usedBookIds = new Set<string>();
        
        // Helper function to collect unique books
        const getUniqueBooks = (
            sourceBooks: Book[],
            sortFn: (a: Book, b: Book) => number,
            limit: number
        ): Book[] => {
            const result: Book[] = [];
            for (const book of [...sourceBooks].sort(sortFn)) {
                if (result.length >= limit) break;
                if (!usedBookIds.has(book._id)) {
                    result.push(book);
                    usedBookIds.add(book._id);
                }
            }
            return result;
        };

        // 1. Trending Books - highest ratings average
        const trendingBooks = getUniqueBooks(
            books,
            (a, b) => ((b.ratings_average || 0) - (a.ratings_average || 0)),
            this.SEGMENT_SIZES.TRENDING_SCIFI
        );
        
        if (trendingBooks.length > 0) {
            segments.push({
                id: 'trending-books',
                title: 'Trending Books',
                type: 'TRENDING_SCIFI', // Reusing the existing type
                books: this.adjustArrayToMultipleOfSix(trendingBooks),
                priority: 5
            });
        }
        
        // 2. Popular Reads - highest ratings count
        const popularBooks = getUniqueBooks(
            books,
            (a, b) => ((b.ratings_count || 0) - (a.ratings_count || 0)),
            this.SEGMENT_SIZES.TRENDING_FANTASY
        );
        
        if (popularBooks.length > 0) {
            segments.push({
                id: 'popular-reads',
                title: 'Popular Reads',
                type: 'TRENDING_FANTASY', // Reusing the existing type
                books: this.adjustArrayToMultipleOfSix(popularBooks),
                priority: 6
            });
        }
        
        // 3. Critically Acclaimed - high ratings but lower counts (hidden gems)
        const criticallyAcclaimed = getUniqueBooks(
            books.filter(b => (b.ratings_average || 0) > 4.0 && (b.ratings_count || 0) < 10000),
            (a, b) => ((b.ratings_average || 0) - (a.ratings_average || 0)),
            this.SEGMENT_SIZES.EPIC_SAGAS
        );
        
        if (criticallyAcclaimed.length > 0) {
            segments.push({
                id: 'critically-acclaimed',
                title: 'Critically Acclaimed',
                type: 'EPIC_SAGAS', // Reusing the existing type
                books: this.adjustArrayToMultipleOfSix(criticallyAcclaimed),
                priority: 7
            });
        }
        
        // For author-based segments, get authors with multiple books
        const authorBooks = new Map<string, Book[]>();
        books.forEach(book => {
            if (book.author_names && book.author_names.length > 0) {
                const author = book.author_names[0]; // Use first author
                if (!authorBooks.has(author)) {
                    authorBooks.set(author, []);
                }
                authorBooks.get(author)?.push(book);
            }
        });
        
        // 4. Featured Authors - authors with multiple books
        const featuredAuthors = [...authorBooks.entries()]
            .filter(([_, books]) => books.length >= 3)
            .sort((a, b) => b[1].length - a[1].length)
            .slice(0, 3); // Take top 3 authors with most books
        
        for (const [author, authorBookList] of featuredAuthors) {
            // Only include books that haven't been used yet
            const unusedAuthorBooks = authorBookList.filter(book => !usedBookIds.has(book._id));
            if (unusedAuthorBooks.length >= 6) { // Ensure we have at least one row
                // Mark these books as used
                unusedAuthorBooks.forEach(book => usedBookIds.add(book._id));
                
                segments.push({
                    id: `author-${author.replace(/\s+/g, '-').toLowerCase()}`,
                    title: `Books by ${author}`,
                    type: 'PRE_2000', // Reusing the existing type 
                    books: this.adjustArrayToMultipleOfSix(unusedAuthorBooks),
                    priority: 8
                });
            }
        }
        
        // 5. More to Explore - remaining books
        const remainingBooks = books.filter(book => !usedBookIds.has(book._id));
        
        if (remainingBooks.length > 0) {
            // Sort by rating to put better books first
            remainingBooks.sort((a, b) => (b.ratings_average || 0) - (a.ratings_average || 0));
            
            segments.push({
                id: 'more-to-explore',
                title: 'More to Explore',
                type: 'POST_2000', // Reusing the existing type
                books: this.adjustArrayToMultipleOfSix(remainingBooks.slice(0, this.SEGMENT_SIZES.POST_2000)),
                priority: 9
            });
        }

        console.log('Final segments:', segments);

        // Filter out any segments that ended up with zero books
        return segments
            .filter(segment => segment.books.length > 0)
            .sort((a, b) => a.priority - b.priority);
    }
  
    private static filterAndSortByRating(books: Book[]): Book[] {
      return [...books]
        .sort((a, b) => (b.ratings_average || 0) - (a.ratings_average || 0))
        .slice(0, this.SEGMENT_SIZES.TRENDING_SCIFI);
    }

private static async getMLRecommendations(
    bookIds: string[],
    allBooks: Book[]
): Promise<Book[]> {
    try {
        // Ensure we have valid book IDs
        if (!bookIds.length) {
            console.error('No book IDs provided');
            return [];
        }

        // Clean and format book IDs
        const cleanBookIds = bookIds
            .filter(id => id !== undefined && id !== null)
            .map(id => {
                const cleaned = id ? id.replace('/works/', '').trim() : '';
                if (!cleaned) {
                    console.warn('Found empty book ID after cleaning:', id);
                }
                return cleaned;
            })
            .filter(id => id);

        if (!cleanBookIds.length) {
            console.error('No valid book IDs to process after cleaning');
            return [];
        }

        console.log('Requesting recommendations for:', cleanBookIds);

        // Get the current user ID from localStorage if available
        let userId = null;
        try {
            const userData = localStorage.getItem('userData');
            if (userData) {
                const user = JSON.parse(userData);
                userId = user.id;
                console.log('Found user ID for recommendations:', userId);
            }
        } catch (error) {
            console.error('Error accessing user data:', error);
        }

        // Construct the query string
        const queryString = cleanBookIds.join(',');
        
        // Build URL with query parameters
        let url = `http://localhost:8000/api/recommendations_multiple?books=${queryString}`;
        if (userId) {
            url += `&userId=${userId}`;
            console.log('Including user ID in recommendation request');
        }
        
        console.log('Making request to:', url);

        // Make the request with a separate userId parameter that won't be confused with book IDs
        const response = await fetch(url);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Error response:', errorText);
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const recommendations = await response.json();
        console.log('Received recommendations:', recommendations);

        // Map recommendations to books
        const mappedBooks = recommendations
            .map((rec: Recommendation) => {
                if (!rec || !rec.id) {
                    console.warn('Received recommendation without valid ID:', rec);
                    return null;
                }

                const recId = rec.id.replace('/works/', '');
                const book = allBooks.find(b => 
                    b._id.replace('/works/', '') === recId
                );

                if (book) {
                    return book;
                } else {
                    console.log('No matching book found for ID:', recId);
                    return null;
                }
            })
            .filter((book: Book | null): book is Book => book !== null);

        console.log(`Mapped ${mappedBooks.length} books successfully`);
        return mappedBooks;

    } catch (error) {
        console.error('Error in getMLRecommendations:', error);
        return [];
    }
}

}
