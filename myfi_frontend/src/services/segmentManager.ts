import { Book } from '../types/Book';
import { BookSegment} from '../types/BookSegment';

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
        currentlyReading: string[] = []
    ): Promise<BookSegment[]> {
        const segments: BookSegment[] = [];

        // Currently Reading
        if (currentlyReading.length > 0) {
            const currentlyReadingBooks = this.adjustArrayToMultipleOfSix(
                books.filter(book => currentlyReading.includes(book._id))
            );
            
            if (currentlyReadingBooks.length > 0) {
                segments.push({
                    id: 'currently-reading',
                    title: 'Currently Reading',
                    type: 'CURRENTLY_READING',
                    books: currentlyReadingBooks,
                    priority: 1,
                    isPersonalized: true
                });
            }
        }

        // My List
        const myListBooks = this.adjustArrayToMultipleOfSix(
            books.filter(book => userReadingList.includes(book._id))
        );
        if (myListBooks.length > 0) {
            segments.push({
                id: 'my-list',
                title: 'My List',
                type: 'MY_LIST',
                books: myListBooks,
                priority: 2,
                isPersonalized: true
            });
        }

        // ML-based recommendations
        if (currentlyReading.length > 0) {
            try {
                console.log('Getting ML recommendations for:', currentlyReading[0]);
                const recommendedBooks = await this.getMLRecommendations(
                    currentlyReading,
                    books
                );
                console.log('Number of recommended books:', recommendedBooks.length);
                console.log('Recommended books:', recommendedBooks);
                
                if (recommendedBooks.length > 0) {
                    segments.push({
                        id: 'ml-recommendations',
                        title: 'Recommended For You',
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
        }

    // Because You Read
    if (currentlyReading.length > 0) {
        // Split the string if it contains multiple IDs
        const bookIds = currentlyReading[0].split(',').map(id => id.trim());
        const mostRecentBook = bookIds[bookIds.length - 1]; // Get the last ID
        
        console.log('Most recent book ID (before cleanup):', mostRecentBook);

        // Clean up the ID
        const cleanMostRecentId = mostRecentBook.replace('/works/', '').trim();
        
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
                    [mostRecentBook],
                    books.filter(b => b._id !== sourceBook._id)
                );
                
                if (similarBooks.length > 0) {
                    segments.push({
                        id: `because-${sourceBook._id}`,
                        title: `Because You Read ${sourceBook.title}`,
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
                originalId: mostRecentBook,
                cleanId: cleanMostRecentId,
                bookIds,
                availableBookIds: books.slice(0, 5).map(b => ({
                    id: b._id,
                    cleanId: b._id.replace('/works/', '').trim(),
                    title: b.title
                })),
                currentlyReading
            });
        }
    }




        // Other segments
        segments.push(
            {
                id: 'trending-scifi',
                title: 'Trending in Science Fiction',
                type: 'TRENDING_SCIFI',
                books: this.adjustArrayToMultipleOfSix(
                    this.filterAndSortByRating(books, 'Science Fiction')
                ),
                priority: 5
            },
            {
                id: 'pre-2000',
                title: 'Classic Sci-Fi (Pre 2000s)',
                type: 'PRE_2000',
                books: this.adjustArrayToMultipleOfSix(
                    books.filter(book => book.first_publish_year < 2000)
                ),
                priority: 6
            },
            {
                id: 'post-2000',
                title: 'Modern Sci-Fi (Post 2000s)',
                type: 'POST_2000',
                books: this.adjustArrayToMultipleOfSix(
                    books.filter(book => book.first_publish_year >= 2000)
                ),
                priority: 7
            }
        );
        console.log('Final segments:', segments);

        // Filter out any segments that ended up with zero books
        return segments
            .filter(segment => segment.books.length > 0)
            .sort((a, b) => a.priority - b.priority);
    }
  
  
    private static filterAndSortByRating(books: Book[], genre?: string): Book[] {
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
            const cleanBookIds = bookIds.map(id => {
                const cleaned = id.replace('/works/', '').trim();
                console.log('Cleaned book ID:', cleaned);
                return cleaned;
            });
    
            console.log('Requesting recommendations for:', cleanBookIds);
    
            // Construct the query string
            const queryString = cleanBookIds.join(',');
            const url = `http://localhost:8000/api/recommendations_multiple?books=${queryString}`;
            console.log('Making request to:', url);
    
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
                    const recId = rec.id.replace('/works/', '');
                    const book = allBooks.find(b => 
                        b._id.replace('/works/', '') === recId
                    );
    
                    if (book) {
                        console.log('Found matching book:', book.title);
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
  