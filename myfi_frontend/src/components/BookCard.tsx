// Singular book component

import { Book } from '../types/book';

interface BookCardProps {
    book: Book;
}

export const BookCard = ({ book }: BookCardProps) => {
    const coverUrl = book.cover_id 
        ? `https://covers.openlibrary.org/b/id/${book.cover_id}-M.jpg`
        : '../assets/placeholder-book.png'; //placeholder image

    return (
        <div className="max-w-sm rounded overflow-hidden shadow-lg bg-white">
            <img 
                className="w-full h-64 object-cover"
                src={coverUrl}
                alt={`Cover of ${book.title}`}
            />
            <div className="px-6 py-4">
                <h2 className="font-bold text-xl mb-2 text-gray-800">{book.title}</h2>
                <p className="text-gray-600 text-sm">
                    {book.author_names?.join(', ')}
                </p>
                <p className="text-gray-500 text-sm">
                    Published: {book.first_publish_year}
                </p>
                {book.ratings_average && (
                    <div className="mt-2">
                        <span className="text-yellow-500">★</span>
                        <span className="text-gray-700">
                            {book.ratings_average.toFixed(1)}
                        </span>
                        {book.ratings_count && (
                            <span className="text-gray-500 text-sm ml-1">
                                ({book.ratings_count} ratings)
                            </span>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
