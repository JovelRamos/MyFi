// BookCard.tsx with updated button logic
import { Book } from '../types/Book';
import { useState, useEffect } from 'react';
import { FaBookOpen, FaPlus, FaThumbsUp, FaThumbsDown, FaHeart, FaCheck, FaTrash, FaTimes } from 'react-icons/fa';
import { useUserBooks } from '../contexts/UserBookContext';
import { toast } from 'react-toastify'; // You may need to install this package

interface BookCardProps {
    book: Book;
    className?: string;
}

export const BookCard = ({ book, className = '' }: BookCardProps) => {
    const [isHovered, setIsHovered] = useState(false);
    const [showRatingPanel, setShowRatingPanel] = useState(false);
    const [imageError, setImageError] = useState(false);
    
    const { 
        readingList, 
        currentlyReading, 
        ratings,
        addToReadingList, 
        markAsCurrentlyReading,
        removeFromReadingList,
        markAsFinished,
        rateBook 
    } = useUserBooks();
    
    const coverUrl = book.cover_id && !imageError
        ? `https://covers.openlibrary.org/b/id/${book.cover_id}-M.jpg`
        : '../assets/placeholder-book.png';
    
    const isInReadingList = readingList.includes(book._id);
    const isCurrentlyReading = currentlyReading.includes(book._id);
    const bookRating = ratings.find(r => r.bookId === book._id)?.rating;
    
    const handleAddToList = async () => {
        try {
            await addToReadingList(book._id);
            toast.success(`"${book.title}" added to your reading list!`);
        } catch (error) {
            toast.error('Failed to add book. Please try again.');
            console.error(error);
        }
    };
    
    const handleRemoveFromList = async () => {
        try {
            await removeFromReadingList(book._id);
            toast.success(`"${book.title}" removed from your reading list!`);
        } catch (error) {
            toast.error('Failed to remove book. Please try again.');
            console.error(error);
        }
    };
    
    const handleMarkAsReading = async () => {
        try {
            await markAsCurrentlyReading(book._id);
            toast.success(`"${book.title}" marked as currently reading!`);
        } catch (error) {
            toast.error('Failed to update reading status. Please try again.');
            console.error(error);
        }
    };
    
    const handleMarkAsFinished = async () => {
        try {
            await markAsFinished(book._id);
            toast.success(`"${book.title}" marked as finished!`);
        } catch (error) {
            toast.error('Failed to update reading status. Please try again.');
            console.error(error);
        }
    };
    
    const handleRateBook = async (rating: number) => {
        try {
            await rateBook(book._id, rating);
            
            let message = '';
            if (rating === 1) message = `You liked "${book.title}"!`;
            else if (rating === 2) message = `You loved "${book.title}"!`;
            else message = `You've rated "${book.title}".`;
            
            toast.success(message);
        } catch (error) {
            toast.error('Failed to rate book. Please try again.');
            console.error(error);
        }
        
        setShowRatingPanel(false);
    };
    
    // Define UI states based on user data
    const addButtonClass = isInReadingList 
        ? "bg-red-600 hover:bg-red-700" 
        : "bg-gray-800 hover:bg-gray-600";
        
    const readButtonClass = isCurrentlyReading
        ? "bg-green-600 hover:bg-green-700"
        : "bg-blue-600 hover:bg-blue-700";
        
    const thumbsDownClass = bookRating === -1
        ? "text-red-500" 
        : "text-white hover:text-red-500";
        
    const thumbsUpClass = bookRating === 1
        ? "text-green-500"
        : "text-white hover:text-green-500";
        
    const heartClass = bookRating === 2
        ? "text-pink-500"
        : "text-white hover:text-pink-500";

        return (
            <div 
                className={`relative w-full h-full rounded shadow-lg transform transition-all duration-300 ${
                    isHovered ? 'scale-150 z-50' : 'z-10'
                } ${className}`}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => {
                    setIsHovered(false);
                    setShowRatingPanel(false);
                }}
                style={{ transformOrigin: 'center center' }}
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
                    {/* Read/Finished Button */}
                    <div className="relative">
                        <div className="group/read">
                            <button 
                                className={`text-white p-3 rounded-full transition flex items-center justify-center ${readButtonClass}`}
                                aria-label={isCurrentlyReading ? "Mark as Finished" : "Read"}
                                onClick={isCurrentlyReading ? handleMarkAsFinished : handleMarkAsReading}
                                onMouseEnter={() => setShowRatingPanel(isCurrentlyReading)}
                            >
                                {isCurrentlyReading ? (
                                    <FaCheck className="w-5 h-5" />
                                ) : (
                                    <FaBookOpen className="w-5 h-5" />
                                )}
                            </button>
                            <span className="absolute bottom-full mb-2 hidden group-hover/read:block bg-black text-white text-xs py-1 px-2 rounded z-40">
                                {isCurrentlyReading ? "Mark as Finished" : "Start Reading"}
                            </span>
                        </div>
                        
                        {/* Rating Panel - Only show for books being read */}
                        {showRatingPanel && isCurrentlyReading && (
                            <div className="absolute top-full mt-2 left-1/2 transform -translate-x-1/2 bg-gray-800 rounded-lg p-3 flex space-x-4 z-30"
                                onMouseLeave={() => setShowRatingPanel(false)}
                            >
                                {/* Thumbs Down */}
                                <div className="group/thumbsdown relative">
                                    <button 
                                        className={thumbsDownClass}
                                        aria-label="Not for me"
                                        onClick={() => handleRateBook(-1)}
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
                                        className={thumbsUpClass}
                                        aria-label="I like this"
                                        onClick={() => handleRateBook(1)}
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
                                        className={heartClass}
                                        aria-label="Love this"
                                        onClick={() => handleRateBook(2)}
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

                    {/* Add/Remove from List Button */}
                    <div className="group relative">
                        <button 
                            className={`text-white p-3 rounded-full transition flex items-center justify-center ${addButtonClass}`}
                            aria-label={isInReadingList ? "Remove from List" : "Add to My List"}
                            onClick={isInReadingList ? handleRemoveFromList : handleAddToList}
                        >
                            {isInReadingList ? (
                                <FaTimes className="w-5 h-5" />
                            ) : (
                                <FaPlus className="w-5 h-5" />
                            )}
                        </button>
                        <span className="absolute bottom-full mb-2 hidden group-hover:block bg-black text-white text-xs py-1 px-2 rounded">
                            {isInReadingList ? "Remove from List" : "Add to My List"}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};
