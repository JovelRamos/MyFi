// BookGrid.tsx
import { Book } from '../types/Book';
import { BookCard } from './BookCard';
import { v4 as uuidv4 } from 'uuid'; // If available, or use another method to generate unique IDs
import { useMemo } from 'react';

interface BookGridProps {
    books: Book[];
    isLoading: boolean;
}

export const BookGrid = ({ books, isLoading }: BookGridProps) => {
    // Generate a unique ID for this grid on component mount
    const gridId = useMemo(() => `grid-${uuidv4()}`, []);

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-gray-900"></div>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 p-12">
            {books.map((book) => (
                <div key={book._id} className="aspect-[2/3] relative group"> 
                    <BookCard book={book} containerId={gridId} />
                </div>
            ))}
        </div>
    );
};
