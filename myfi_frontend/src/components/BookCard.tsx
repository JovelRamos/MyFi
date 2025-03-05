// BookCard.tsx
import { Book } from '../types/Book';
import { useState, useRef, useEffect } from 'react';
import { BookPanel } from './BookPanel';

interface BookCardProps {
    book: Book;
    className?: string;
}

export const BookCard = ({ book, className = '' }: BookCardProps) => {
    const [isHovered, setIsHovered] = useState(false);
    const [isPanelHovered, setIsPanelHovered] = useState(false); // Add this state
    const [imageError, setImageError] = useState(false);
    const cardRef = useRef<HTMLDivElement>(null);
    const [cardDimensions, setCardDimensions] = useState({ width: 0, height: 0 });
    
    // Calculate and store card dimensions when mounted and on resize
    useEffect(() => {
        const updateDimensions = () => {
            if (cardRef.current) {
                const rect = cardRef.current.getBoundingClientRect();
                setCardDimensions({
                    width: rect.width,
                    height: rect.height
                });
            }
        };
        
        // Initial calculation
        updateDimensions();
        
        // Re-calculate on window resize
        window.addEventListener('resize', updateDimensions);
        
        return () => {
            window.removeEventListener('resize', updateDimensions);
        };
    }, []);
    
    const coverUrl = book.cover_id && !imageError
    ? `https://covers.openlibrary.org/b/id/${book.cover_id}-M.jpg`
    : '../assets/placeholder-book.png';

    // Handle mouse events
    const handleMouseEnter = () => setIsHovered(true);
    const handleMouseLeave = () => {
        // Only set isHovered to false if the panel isn't currently being hovered
        if (!isPanelHovered) {
            setIsHovered(false);
        }
    };

    // Handle panel hover state
    const handlePanelHover = (hovering: boolean) => {
        setIsPanelHovered(hovering);
        // If panel is no longer hovered and the card isn't either, update main hover state
        if (!hovering) {
            const isCardHovered = cardRef.current?.matches(':hover') || false;
            if (!isCardHovered) {
                setIsHovered(false);
            }
        }
    };

    return (
        <div 
            className={`relative w-full h-full ${className}`}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            {/* BookPanel positioned on hover */}
            <BookPanel 
                book={book} 
                isHovered={isHovered} 
                cardDimensions={cardDimensions}
                scaleFactor={1.5} // The scale factor (150%)
                onPanelHover={handlePanelHover}
            />
            
            {/* Main book card (no scaling) */}
            <div 
                ref={cardRef}
                className="relative w-full h-full transition-all duration-300 z-10"
            >
                {/* Container for book card */}
                <div className="relative flex h-full">
                    {/* Book Cover Card */}
                    <div 
                        className="relative w-full h-full rounded shadow-md transition-all duration-300"
                        style={{ opacity: isHovered ? 0 : 1 }} // Hide this cover when hovered
                    >
                        <img 
                            className="w-full h-full object-cover rounded"
                            src={coverUrl}
                            alt={`Cover of ${book.title}`}
                            loading="lazy"
                            onError={() => {
                                console.error(`Failed to load cover for book: "${book.title}"`);
                                setImageError(true);
                            }}
                            decoding="async"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};
