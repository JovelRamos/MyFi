// ReadOptionsPanel.tsx
import { useRef, useEffect, useState } from 'react';
import { FaStar } from 'react-icons/fa';

interface ReadOptionsPanelProps {
    handleRateBook: (rating: number) => Promise<void>;
    bookRating: number | null | undefined;
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
    const [hoveredRating, setHoveredRating] = useState<number | null>(null);
    
    useEffect(() => {
        // Handle outside clicks
        const handleMouseLeave = () => {
            setIsOpen(false);
            setHoveredRating(null);
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

    // Total number of stars
    const totalStars = 5;

    return (
        <div 
            ref={panelRef}
            className={`absolute left-full top-1/2 transform -translate-y-1/2 ml-2 bg-gray-800 rounded-lg p-3 z-40 shadow-xl transition-opacity duration-200 ease-in-out ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
            onMouseEnter={() => setIsOpen(true)}
        >
            <div className="flex items-center">
                {[...Array(totalStars)].map((_, index) => {
                    const ratingValue = index + 1;
                    
                    return (
                        <div
                            key={ratingValue}
                            className="cursor-pointer px-1"
                            onMouseEnter={() => setHoveredRating(ratingValue)}
                            onClick={() => handleRateBook(ratingValue)}
                        >
                            <FaStar
                                className={`w-6 h-6 transition-colors duration-200 ${
                                    (hoveredRating !== null && ratingValue <= hoveredRating) || 
                                    (hoveredRating === null && bookRating && ratingValue <= bookRating)
                                        ? 'text-yellow-500' 
                                        : 'text-gray-400'
                                }`}
                            />
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
