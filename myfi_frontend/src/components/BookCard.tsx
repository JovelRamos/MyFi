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
    const [isPanelHovered, setIsPanelHovered] = useState(false);
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

    // Handle mouse events with point-in-element precision
    const handleMouseMove = (e: React.MouseEvent) => {
        if (cardRef.current) {
            const rect = cardRef.current.getBoundingClientRect();
            
            // Check if mouse is inside the card's boundaries
            const isInside = 
                e.clientX >= rect.left &&
                e.clientX <= rect.right &&
                e.clientY >= rect.top &&
                e.clientY <= rect.bottom;
                
            setIsHovered(isInside);
        }
    };

    const handleMouseLeave = () => {
        if (!isPanelHovered) {
            setIsHovered(false);
        }
    };

    // Handle panel hover state
    const handlePanelHover = (hovering: boolean) => {
        setIsPanelHovered(hovering);
        if (!hovering) {
            // Use mouseIsOver to check hover state of the card
            const isCardHovered = cardRef.current?.matches(':hover') || false;
            if (!isCardHovered) {
                setIsHovered(false);
            }
        }
    };

    return (
        <div 
            className={`relative w-full h-full ${className}`}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            ref={cardRef}
        >
            {/* BookPanel positioned on hover */}
            <BookPanel 
                book={book} 
                isHovered={isHovered} 
                cardDimensions={cardDimensions}
                scaleFactor={1.5}
                onPanelHover={handlePanelHover}
            />
            
            {/* Main book card (no scaling) */}
            <div className="relative w-full h-full transition-all duration-300 z-10">
                {/* Container for book card */}
                <div className="relative flex h-full">
                    {/* Book Cover Card */}
                    <div 
                        className="relative w-full h-full rounded shadow-md transition-all duration-300"
                        style={{ opacity: isHovered ? 0 : 1 }}
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
