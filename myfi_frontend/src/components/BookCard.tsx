import { Book } from '../types/Book';
import { useState, useEffect } from 'react';
import { FaBookOpen, FaPlus, FaThumbsUp, FaThumbsDown, FaHeart } from 'react-icons/fa';

interface BookCardProps {
    book: Book;
    className?: string;
}

export const BookCard = ({ book, className = '' }: BookCardProps) => {
    const [isHovered, setIsHovered] = useState(false);
    const [showRatingPanel, setShowRatingPanel] = useState(false);
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
            onMouseLeave={() => {
                setIsHovered(false);
                setShowRatingPanel(false);
            }}
        >
            {/* Cover Image */}
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
                className={`absolute inset-0 bg-black bg-opacity-75 transition-opacity duration-300 flex flex-col justify-between ${
                    isHovered ? 'rounded opacity-100' : 'opacity-0'
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

            {/* Circular Buttons */}
            <div className="flex justify-center space-x-4 pb-4">
 {/* Read Button */}
<div className="relative">
    <div className="group/read">
        <button 
            className="bg-gray-800 text-white p-3 rounded-full transition hover:bg-gray-600 flex items-center justify-center"
            aria-label="Read"
            onMouseEnter={() => setShowRatingPanel(true)}
        >
            <FaBookOpen className="w-5 h-5" />
        </button>
        <span className="absolute bottom-full mb-2 hidden group-hover/read:block bg-black text-white text-xs py-1 px-2 rounded z-40">
            Read
        </span>
    </div>
    
    {/* Rating Panel */}
    {showRatingPanel && (
        <div className="absolute top-full mt-2 left-1/2 transform -translate-x-1/2 bg-gray-800 rounded-lg p-3 flex space-x-4 z-30"
            onMouseLeave={() => setShowRatingPanel(false)}
        >
            {/* Thumbs Down */}
            <div className="group/thumbsdown relative">
                <button 
                    className="text-white hover:text-red-500 transition"
                    aria-label="Not for me"
                >
                    <FaThumbsDown className="w-5 h-5" />
                </button>
                <span className="absolute -top-8 left-1/2 transform -translate-x-1/2 hidden group-hover/thumbsdown:block bg-black text-white text-xs py-1 px-2 rounded whitespace-nowrap z-40">
                    Not for me
                </span>
            </div>
            
            {/* Thumbs Up */}
            <div className="group/thumbsup relative">
                <button 
                    className="text-white hover:text-green-500 transition"
                    aria-label="I like this"
                >
                    <FaThumbsUp className="w-5 h-5" />
                </button>
                <span className="absolute -top-8 left-1/2 transform -translate-x-1/2 hidden group-hover/thumbsup:block bg-black text-white text-xs py-1 px-2 rounded whitespace-nowrap z-40">
                    I like this
                </span>
            </div>
            
            {/* Heart */}
            <div className="group/heart relative">
                <button 
                    className="text-white hover:text-pink-500 transition"
                    aria-label="Love this"
                >
                    <FaHeart className="w-5 h-5" />
                </button>
                <span className="absolute -top-8 left-1/2 transform -translate-x-1/2 hidden group-hover/heart:block bg-black text-white text-xs py-1 px-2 rounded whitespace-nowrap z-40">
                    Love this!
                </span>
            </div>
        </div>
    )}
</div>



                {/* Add to My List Button */}
                <div className="group relative">
                    <button 
                        className="bg-gray-800 text-white p-3 rounded-full transition hover:bg-gray-600 flex items-center justify-center"
                        aria-label="Add to My List"
                    >
                        <FaPlus className="w-5 h-5" />
                    </button>
                    <span className="absolute bottom-full mb-2 hidden group-hover:block bg-black text-white text-xs py-1 px-2 rounded">
                        Add to My List
                    </span>
                </div>
                </div>
            </div>
        </div>
    );
};
