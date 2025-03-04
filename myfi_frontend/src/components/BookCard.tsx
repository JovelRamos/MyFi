// BookCard.tsx with separate panel component
import { Book } from '../types/Book';
import { useState, useRef, useEffect } from 'react';
import { BookPanel } from './BookPanel';

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
            className={`relative w-full h-full ${className}`}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            style={{ transformOrigin: 'center center' }}
        >
            {/* Main container that will scale */}
            <div className={`relative w-full h-full transform transition-all duration-300 ${
                isHovered ? 'scale-150 z-50' : 'z-10'
            }`}>
                {/* Container for book card and side panel */}
                <div className="relative flex h-full">
                    {/* The side panel component - positioned absolutely relative to the book cover */}
                    <BookPanel book={book} isHovered={isHovered} />

                    {/* Book Cover Card */}
                    <div 
                        className={`relative w-full h-full ${
                            isHovered ? 'rounded-r shadow-lg' : 'rounded shadow-md'
                        } transition-all duration-300`}
                        style={{
                            boxShadow: isHovered ? '0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -4px rgba(0, 0, 0, 0.2)' : '',
                            borderTopLeftRadius: isHovered ? '0' : '0.375rem',
                            borderBottomLeftRadius: isHovered ? '0' : '0.375rem'
                        }}
                    >
                        <img 
                            className={`w-full h-full object-cover ${
                                isHovered ? 'rounded-r' : 'rounded'
                            }`}
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
                            className={`absolute inset-0 bg-black bg-opacity-75 transition-opacity duration-300 flex flex-col justify-between ${
                                isHovered ? 'opacity-100 rounded-r' : 'opacity-0 rounded'
                            }`}
                        >
                            {/* Book Info */}
                            <div className="p-4 text-white">
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
                </div>
                
                {/* Combined shadow for the entire card when hovered */}
                {isHovered && (
                    <div 
                        className="absolute inset-0 -z-10 rounded-md"
                        style={{
                            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                            transform: 'scale(1.02)',
                            pointerEvents: 'none'
                        }}
                    ></div>
                )}
            </div>
        </div>
    );
};
