import { Book } from '../types/Book';
import { BookSegment, SegmentType } from '../types/BookSegment';

export class SegmentManager {
  private static readonly SEGMENT_SIZES = {
    CURRENTLY_READING: 5,
    BECAUSE_YOU_READ: 24,
    TRENDING_SCIFI: 24,
    TRENDING_FANTASY: 24,
    EPIC_SAGAS: 24,
    PRE_2000: 24,
    POST_2000: 24,
    MY_LIST: 24
  };

  static generateSegments(
    books: Book[],
    userReadingList: string[] = [],
    currentlyReading: string[] = []
  ): BookSegment[] {
    const segments: BookSegment[] = [];

    // Currently Reading
    if (currentlyReading.length > 0) {
      segments.push({
        id: 'currently-reading',
        title: 'Currently Reading',
        type: 'CURRENTLY_READING',
        books: books.filter(book => currentlyReading.includes(book._id)),
        priority: 1,
        isPersonalized: true
      });
    }

    // My List
    const myListBooks = books.filter(book => userReadingList.includes(book._id));
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
        segments.push({
          id: `because-${sourceBook._id}`,
          title: `Because You Read ${sourceBook.title}`,
          type: 'BECAUSE_YOU_READ',
          books: this.getSimilarBooks(sourceBook, books),
          priority: 3,
          isPersonalized: true,
          sourceBook
        });
      }
    }

    // Other segments
    segments.push(
      {
        id: 'trending-scifi',
        title: 'Trending in Science Fiction',
        type: 'TRENDING_SCIFI',
        books: this.filterAndSortByRating(books, 'Science Fiction'),
        priority: 4
      },
      {
        id: 'pre-2000',
        title: 'Classic Sci-Fi (Pre 2000s)',
        type: 'PRE_2000',
        books: books.filter(book => book.first_publish_year < 2000),
        priority: 5
      },
      {
        id: 'post-2000',
        title: 'Modern Sci-Fi (Post 2000s)',
        type: 'POST_2000',
        books: books.filter(book => book.first_publish_year >= 2000),
        priority: 6
      }
    );

    return segments.sort((a, b) => a.priority - b.priority);
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
