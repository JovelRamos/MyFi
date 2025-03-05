// ReadOptionsPanel.tsx
import { FaCheck, FaThumbsUp, FaThumbsDown, FaHeart } from 'react-icons/fa';

interface ReadOptionsPanelProps {
    handleMarkAsFinished: () => Promise<void>;
    handleRateBook: (rating: number) => Promise<void>;
    bookRating?: number;
}

export const ReadOptionsPanel = ({ 
    handleMarkAsFinished, 
    handleRateBook,
    bookRating 
}: ReadOptionsPanelProps) => {
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
        <div className="absolute left-full top-1/2 transform -translate-y-1/2 ml-2 bg-gray-800 rounded-lg p-3 flex flex-col gap-3 z-40 shadow-xl">
            <button 
                className="text-white p-2 bg-blue-700 hover:bg-blue-600 rounded flex items-center justify-center gap-2 w-40"
                onClick={handleMarkAsFinished}
            >
                <FaCheck className="w-4 h-4" />
                <span>Read</span>
            </button>
            
            {/* Thumbs Down */}
            <button 
                className={`p-2 rounded flex items-center gap-2 w-40 ${thumbsDownClass} hover:bg-gray-700`}
                onClick={() => handleRateBook(-1)}
            >
                <FaThumbsDown className="w-4 h-4" />
                <span>Disliked it</span>
            </button>
            
            {/* Thumbs Up */}
            <button 
                className={`p-2 rounded flex items-center gap-2 w-40 ${thumbsUpClass} hover:bg-gray-700`}
                onClick={() => handleRateBook(1)}
            >
                <FaThumbsUp className="w-4 h-4" />
                <span>Liked it</span>
            </button>
            
            {/* Heart */}
            <button 
                className={`p-2 rounded flex items-center gap-2 w-40 ${heartClass} hover:bg-gray-700`}
                onClick={() => handleRateBook(2)}
            >
                <FaHeart className="w-4 h-4" />
                <span>Loved it!</span>
            </button>
        </div>
    );
};
