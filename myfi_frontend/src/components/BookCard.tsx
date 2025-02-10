// BookCard.tsx

import { Book } from '../types/Book';
import { useState, useEffect } from 'react';

interface BookCardProps {
    book: Book;
    className?: string;
}

export const BookCard = ({ book, className = '' }: BookCardProps) => {
    const [isHovered, setIsHovered] = useState(false);
    const [imageError, setImageError] = useState(false);
    
    const coverUrl = book.cover_id && !imageError
        ? `https://covers.openlibrary.org/b/id/${book.cover_id}-M.jpg`
        : '../assets/placeholder-book.png';

        return (
            <div 
              className={`relative w-full h-full rounded shadow-lg transform transition-all duration-300 ${
                isHovered ? 'scale-105 z-20' : 'z-10'
              } ${className}`}
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
            >
            {/* Cover Image with lazy loading */}
            <img 
                className="w-full h-full rounded object-cover"
                src={coverUrl}
                alt={`Cover of ${book.title}`}
                loading="lazy"
                onError={() => {
                    console.error(`Failed to load cover for book: "${book.title}"`);
                    setImageError(true);
                }}
                decoding="async"
            />
            
            {/* Overlay with Book Information */}
            <div 
                className={`absolute inset-0 bg-black bg-opacity-75 transition-opacity duration-300 ${
                    isHovered ? 'rounded opacity-100' : 'opacity-0'
                }`}
            >
                <div className="flex flex-col justify-center h-full p-4 text-white">
                    <h2 className="font-bold text-lg mb-2 overflow-hidden text-ellipsis">
                        {book.title}
                    </h2>
                    <p className="text-sm mb-1 overflow-hidden text-ellipsis">
                        {book.author_names?.join(', ')}
                    </p>
                    <p className="text-sm text-gray-300">
                        Published: {book.first_publish_year}
                    </p>
                    
                    {book.ratings_average && (
                        <div className="mt-2">
                            <span className="text-yellow-500">★</span>
                            <span className="text-white">
                                {book.ratings_average.toFixed(1)}
                            </span>
                            {book.ratings_count && (
                                <span className="text-gray-300 text-sm ml-1">
                                    ({book.ratings_count} ratings)
                                </span>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
