// src/pages/MyBooksPage.tsx
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useUserBooks } from '../contexts/UserBookContext';
import { Book } from '../types/Book';
import { useNavigate } from 'react-router-dom'; 

// BookCover component remains the same
function BookCover({ book }: { book: Book }) {
    return (
      <div className="w-48 relative group">
        <div className="relative aspect-[2/3]">
          <img 
            src={book.cover_id ? `https://covers.openlibrary.org/b/id/${book.cover_id}-L.jpg` : '/placeholder-cover.jpg'} 
            alt={`Cover for ${book.title}`}
            className="h-full w-full object-cover rounded-lg shadow-lg"
          />
        </div>
        <div className="mt-2">
          <h4 className="text-sm font-semibold text-white truncate">{book.title}</h4>
          <p className="text-xs text-gray-400 truncate">{book.author_names?.[0] || 'Unknown author'}</p>
        </div>
      </div>
    );
}

function BookList({ books, title, emptyMessage }: { 
  books: Book[], 
  title: string,
  emptyMessage: string
}) {
  return (
    <div className="mb-12">
      <h2 className="text-2xl font-bold text-white mb-4">{title}</h2>
      
      {books.length > 0 ? (
        <div className="grid grid-cols-6 gap-6">
          {books.map(book => (
            <BookCover key={book._id} book={book} />
          ))}
        </div>
      ) : (
        <div className="bg-gray-800 p-6 rounded-lg text-gray-400">
          {emptyMessage}
        </div>
      )}
    </div>
  );
}

function MyBooksPage() {
  const { isAuthenticated } = useAuth();
  const { readingList, currentlyReading, finishedBooks, isInitialLoading } = useUserBooks();
  const navigate = useNavigate();
  const [books, setBooks] = useState<Book[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch the book details if not already available
  useEffect(() => {  
    const fetchBooks = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('http://localhost:8000/api/books');
        if (!response.ok) throw new Error('Failed to fetch books');
        
        const data = await response.json();
        setBooks(data.books);
      } catch (error) {
        console.error('Failed to fetch books:', error);
      } finally {
        setIsLoading(false);
      }
    };
    console.log("Current finishedBooks:", finishedBooks);

    fetchBooks();
  }, []);

  // Create book lists with newest-first order
  const readingListBooks: Book[] = [];
  for (let i = readingList.length - 1; i >= 0; i--) {
    const bookId = readingList[i];
    const book = books.find(b => b._id === bookId);
    if (book) readingListBooks.push(book);
  }
  
  const currentlyReadingBooks: Book[] = [];
  for (let i = currentlyReading.length - 1; i >= 0; i--) {
    const bookId = currentlyReading[i];
    const book = books.find(b => b._id === bookId);
    if (book) currentlyReadingBooks.push(book);
  }
  
  const finishedBooksArray: Book[] = [];
  for (let i = finishedBooks.length - 1; i >= 0; i--) {
    const finishedBook = finishedBooks[i];
    // Extract bookId from the finishedBooks object
    const bookId = finishedBook.bookId;
    const book = books.find(b => b._id === bookId);
    if (book) finishedBooksArray.push(book);
  }

  // Redirect non-authenticated users to login
  if (!isAuthenticated && !isInitialLoading) {
    return (
      <div className="p-8 bg-gray-800 rounded-lg text-center">
        <h2 className="text-2xl font-bold text-white mb-4">You need to be logged in</h2>
        <p className="text-gray-400 mb-6">Please log in to view your book collections.</p>
        <button 
          className="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
          onClick={() => navigate('/')}
        >
          Go to Home Page
        </button>
      </div>
    );
  }

  if (isInitialLoading || isLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center z-50 bg-zinc-900 bg-opacity-80">
        <div className="relative w-16 h-16">
          <div className="absolute top-0 left-0 w-full h-full border-4 border-gray-600 rounded-full"></div>
          <div className="absolute top-0 left-0 w-full h-full border-4 border-t-red-600 rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <h1 className="text-3xl font-bold text-white mb-8">My Books</h1>

      <BookList 
        books={currentlyReadingBooks} 
        title="Currently Reading" 
        emptyMessage="You're not currently reading any books. Find a new book to start reading!" 
      />
      
      <BookList 
        books={readingListBooks} 
        title="My Reading List" 
        emptyMessage="Your reading list is empty. Add books that you want to read later!"
      />
      
      <BookList 
        books={finishedBooksArray} 
        title="Finished Books" 
        emptyMessage="You haven't finished any books yet. Keep reading!"
      />
    </div>
  );
}

export default MyBooksPage;
