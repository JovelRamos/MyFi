// BookPanel.tsx
import { Book } from '../types/Book';
import { useState } from 'react';
import { FaBookOpen, FaPlus, FaThumbsUp, FaThumbsDown, FaHeart, FaCheck, FaTimes } from 'react-icons/fa';
import { useUserBooks } from '../contexts/UserBookContext';
import { toast } from 'react-toastify';

interface BookPanelProps {
    book: Book;
    isHovered: boolean;
}

export const BookPanel = ({ book, isHovered }: BookPanelProps) => {
    const [showRatingPanel, setShowRatingPanel] = useState(false);
    
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
            className={`absolute right-full h-full transform transition-all duration-300 flex flex-col justify-center items-center gap-4 bg-gray-800 overflow-hidden ${
                isHovered ? 'w-14 opacity-100' : 'w-0 opacity-0'
            }`}
            style={{ 
                top: 0, 
                zIndex: 30,
                borderTopLeftRadius: '0.375rem',
                borderBottomLeftRadius: '0.375rem',
                boxShadow: isHovered ? '-2px 0 8px rgba(0, 0, 0, 0.2)' : 'none'
            }}
            onMouseLeave={() => setShowRatingPanel(false)}
        >
            {/* Read/Finished Button */}
            <div className="relative">
                <div className="group/read">
                    <button 
                        className={`text-white p-3 rounded-full transition flex items-center justify-center shadow-md ${readButtonClass}`}
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
                    <span className="absolute right-full mr-2 top-1/2 transform -translate-y-1/2 hidden group-hover/read:block bg-black text-white text-xs py-1 px-2 rounded whitespace-nowrap z-40">
                        {isCurrentlyReading ? "Mark as Finished" : "Start Reading"}
                    </span>
                </div>
                
                {/* Rating Panel - Only show for books being read */}
                {showRatingPanel && isCurrentlyReading && (
                    <div className="absolute right-full top-1/2 transform -translate-y-1/2 mr-2 bg-gray-800 rounded-lg p-3 flex flex-col gap-3 z-40 shadow-xl"
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
                            <span className="absolute right-full mr-2 top-1/2 transform -translate-y-1/2 hidden group-hover/thumbsdown:block bg-black text-white text-xs py-1 px-2 rounded whitespace-nowrap z-40">
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
                            <span className="absolute right-full mr-2 top-1/2 transform -translate-y-1/2 hidden group-hover/thumbsup:block bg-black text-white text-xs py-1 px-2 rounded whitespace-nowrap z-40">
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
                            <span className="absolute right-full mr-2 top-1/2 transform -translate-y-1/2 hidden group-hover/heart:block bg-black text-white text-xs py-1 px-2 rounded whitespace-nowrap z-40">
                                Love this!
                            </span>
                        </div>
                    </div>
                )}
            </div>

            {/* Add/Remove from List Button */}
            <div className="group relative">
                <button 
                    className={`text-white p-3 rounded-full transition flex items-center justify-center shadow-md ${addButtonClass}`}
                    aria-label={isInReadingList ? "Remove from List" : "Add to My List"}
                    onClick={isInReadingList ? handleRemoveFromList : handleAddToList}
                >
                    {isInReadingList ? (
                        <FaTimes className="w-5 h-5" />
                    ) : (
                        <FaPlus className="w-5 h-5" />
                    )}
                </button>
                <span className="absolute right-full mr-2 top-1/2 transform -translate-y-1/2 hidden group-hover:block bg-black text-white text-xs py-1 px-2 rounded whitespace-nowrap z-40">
                    {isInReadingList ? "Remove from List" : "Add to My List"}
                </span>
            </div>
        </div>
    );
};
