// BookPanel.tsx with seamless cover transition
import { Book } from '../types/Book';
import { BookButtons } from './BookButtons';
import { useRef, useEffect } from 'react';

interface BookPanelProps {
    book: Book;
    isHovered: boolean;
    cardDimensions: { width: number; height: number };
    scaleFactor: number;
    onPanelHover?: (isHovered: boolean) => void;
}

export const BookPanel = ({ 
    book, 
    isHovered, 
    cardDimensions, 
    scaleFactor,
    onPanelHover 
}: BookPanelProps) => {
    // Calculate dimensions for the larger panel
    const panelWidth = cardDimensions.width * scaleFactor;
    const panelHeight = cardDimensions.height * scaleFactor;
    const panelRef = useRef<HTMLDivElement>(null);
    
    // Cover URL for the right panel
    const coverUrl = book.cover_id
        ? `https://covers.openlibrary.org/b/id/${book.cover_id}-M.jpg`
        : '../assets/placeholder-book.png';

    // Use mouseout event listener to ensure all exits are captured
    useEffect(() => {
        const panel = panelRef.current;
        if (!panel) return;

        const handleMouseOut = (e: MouseEvent) => {
            // Only trigger if the mouse is leaving the panel, not entering a child element
            if (!panel.contains(e.relatedTarget as Node)) {
                onPanelHover && onPanelHover(false);
            }
        };

        panel.addEventListener('mouseout', handleMouseOut);
        
        return () => {
            panel.removeEventListener('mouseout', handleMouseOut);
        };
    }, [onPanelHover]);

    // Handle mouse enter to inform parent component
    const handleMouseEnter = () => {
        onPanelHover && onPanelHover(true);
    };

    return (
        <div 
            className="absolute top-0 left-0 w-full h-full pointer-events-none"
            style={{
                zIndex: isHovered ? 50 : -1,
            }}
        >
            <div 
                ref={panelRef}
                className={`absolute transform-gpu transition-all duration-300 ease-out pointer-events-auto
                           overflow-hidden shadow-lg ${
                    isHovered ? 'opacity-100' : 'opacity-0'
                }`}
                style={{ 
                    width: `${panelWidth}px`,
                    height: `${panelHeight}px`,
                    top: `${(cardDimensions.height - panelHeight) / 2}px`,
                    left: `${(cardDimensions.width - panelWidth) / 2}px`,
                    borderRadius: '0.375rem',
                    backfaceVisibility: 'hidden',
                }}
                onMouseEnter={handleMouseEnter}
            >
                {/* Top horizontal section - Title and Author */}
                <div className="bg-black bg-opacity-90 p-3 w-full"
                     style={{
                         transform: isHovered ? 'translateY(0)' : 'translateY(-100%)',
                         transition: 'transform 300ms ease-out',
                     }}
                >
                    <h2 className="font-bold text-lg text-white truncate">
                        {book.title}
                    </h2>
                    <p className="text-sm text-gray-300 truncate">
                        by {book.author_names?.join(', ') || 'Unknown Author'}
                    </p>
                </div>

                {/* Bottom section with two vertical panels */}
                <div className="flex flex-1">
                    {/* Left side: Action buttons - slides in from left */}
                    <BookButtons 
                        book={book} 
                        isHovered={isHovered} 
                    />
                    
                    {/* Right side: Book cover - No padding */}
                    <div 
                        className="flex-1 bg-transparent overflow-hidden"
                        style={{ width: `${panelWidth * 0.7}px` }}
                    >
                        {/* Book cover image - covers entire right panel */}
                        <img 
                            src={coverUrl}
                            alt={`Cover of ${book.title}`}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                                (e.target as HTMLImageElement).src = '../assets/placeholder-book.png';
                            }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};
