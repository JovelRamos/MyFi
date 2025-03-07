// ReadOptionsPanel.tsx
import { useRef, useEffect } from 'react';
import { FaStar } from 'react-icons/fa';

interface ReadOptionsPanelProps {
    handleRateBook: (rating: number) => Promise<void>;
    bookRating?: number;
    isOpen: boolean;
    setIsOpen: (isOpen: boolean) => void;
}

export const ReadOptionsPanel = ({ 
    handleRateBook,
    bookRating,
    isOpen,
    setIsOpen
}: ReadOptionsPanelProps) => {
    const panelRef = useRef<HTMLDivElement>(null);
    
    useEffect(() => {
        // Handle outside clicks
        const handleMouseLeave = () => {
            setIsOpen(false);
        };
        
        if (panelRef.current && isOpen) {
            panelRef.current.addEventListener('mouseleave', handleMouseLeave);
        }
        
        return () => {
            if (panelRef.current) {
                panelRef.current.removeEventListener('mouseleave', handleMouseLeave);
            }
        };
    }, [isOpen, setIsOpen]);

    // Only ratings 1-5
    const starRatings = [1, 2, 3, 4, 5];

    return (
        <div 
            ref={panelRef}
            className={`absolute left-full top-1/2 transform -translate-y-1/2 ml-2 bg-gray-800 rounded-lg py-1 flex flex-col z-40 shadow-xl transition-opacity duration-200 ease-in-out ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
            onMouseEnter={() => setIsOpen(true)}
        >
            {/* Star Ratings - 1 to 5 stars only */}
            {starRatings.map((rating) => (
                <button 
                    key={rating}
                    className={`px-2 py-1 rounded flex items-center justify-center
                        ${bookRating === rating ? 'text-yellow-500 bg-gray-700' : 'text-white hover:bg-gray-700'}`}
                    onClick={() => handleRateBook(rating)}
                >
                    {Array(rating).fill(0).map((_, i) => (
                        <FaStar key={i} className="w-4 h-4 text-yellow-500" />
                    ))}
                </button>
            ))}
        </div>
    );
}
