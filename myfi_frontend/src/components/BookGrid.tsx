// Book layout

import { Book } from '../types/book';
import { BookCard } from './BookCard';

interface BookGridProps {
    books: Book[];
    isLoading: boolean;
}

export const BookGrid = ({ books, isLoading }: BookGridProps) => {
    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-gray-900"></div>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 p-6">
            {books.map((book) => (
                <BookCard key={book._id} book={book} />
            ))}
        </div>
    );
};
