import { Book } from '../types/Book';
import { BookSegment} from '../types/BookSegment';
export class SegmentManager {
    private static readonly BOOKS_PER_ROW = 6;
    private static readonly SEGMENT_SIZES = {
      CURRENTLY_READING: 6,  // Changed from 5 to 6
      BECAUSE_YOU_READ: 24,
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
  
    static generateSegments(
      books: Book[],
      userReadingList: string[] = [],
      currentlyReading: string[] = []
    ): BookSegment[] {
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
  
      // Because You Read
      if (currentlyReading.length > 0) {
        const sourceBook = books.find(book => currentlyReading[0] === book._id);
        if (sourceBook) {
          const similarBooks = this.adjustArrayToMultipleOfSix(
            this.getSimilarBooks(sourceBook, books)
          );
          
          if (similarBooks.length > 0) {
            segments.push({
              id: `because-${sourceBook._id}`,
              title: `Because You Read ${sourceBook.title}`,
              type: 'BECAUSE_YOU_READ',
              books: similarBooks,
              priority: 3,
              isPersonalized: true,
              sourceBook
            });
          }
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
          priority: 4
        },
        {
          id: 'pre-2000',
          title: 'Classic Sci-Fi (Pre 2000s)',
          type: 'PRE_2000',
          books: this.adjustArrayToMultipleOfSix(
            books.filter(book => book.first_publish_year < 2000)
          ),
          priority: 5
        },
        {
          id: 'post-2000',
          title: 'Modern Sci-Fi (Post 2000s)',
          type: 'POST_2000',
          books: this.adjustArrayToMultipleOfSix(
            books.filter(book => book.first_publish_year >= 2000)
          ),
          priority: 6
        }
      );
  
      // Filter out any segments that ended up with zero books
      return segments
        .filter(segment => segment.books.length > 0)
        .sort((a, b) => a.priority - b.priority);
    }
  
    private static getSimilarBooks(sourceBook: Book, allBooks: Book[]): Book[] {
      // Implement similarity logic here (based on genres, authors, etc.)
      return allBooks
        .filter(book => book._id !== sourceBook._id)
        .slice(0, this.SEGMENT_SIZES.BECAUSE_YOU_READ);
    }
  
    private static filterAndSortByRating(books: Book[], genre?: string): Book[] {
      return [...books]
        .sort((a, b) => (b.ratings_average || 0) - (a.ratings_average || 0))
        .slice(0, this.SEGMENT_SIZES.TRENDING_SCIFI);
    }
  }
  