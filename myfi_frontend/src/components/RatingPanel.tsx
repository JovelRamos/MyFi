// RatingPanel.tsx with improved Portal implementation
import { FaThumbsUp, FaThumbsDown, FaHeart } from 'react-icons/fa';
import { Book } from '../types/Book';
import { useEffect, useState, useRef } from 'react';
import ReactDOM from 'react-dom';

interface RatingPanelProps {
    book: Book;
    bookRating?: number;
    handleRateBook: (rating: number) => Promise<void>;
    buttonSize: { width: string; height: string };
    thumbsDownRef: React.RefObject<HTMLButtonElement>;
    thumbsUpRef: React.RefObject<HTMLButtonElement>;
    heartRef: React.RefObject<HTMLButtonElement>;
    readButtonRef?: React.RefObject<HTMLButtonElement>;
    onMouseLeave?: () => void; // Add this prop
}

export const RatingPanel = ({ 
    book, 
    bookRating, 
    handleRateBook, 
    buttonSize,
    thumbsDownRef,
    thumbsUpRef,
    heartRef,
    readButtonRef,
    onMouseLeave // Destructure the prop here
}: RatingPanelProps) => {
    const [position, setPosition] = useState({ top: 0, left: 0 });
    const panelRef = useRef<HTMLDivElement>(null);

    // Function to update position - call this when needed
    const updatePosition = () => {
        // Use the read button's position if provided, otherwise fallback to thumbsUp
        const referenceButton = readButtonRef?.current || thumbsUpRef.current;
        if (!referenceButton) return;

        const rect = referenceButton.getBoundingClientRect();
        
        // If we have the panel, use its width for better centering
        let panelWidth = 240; // Default estimate
        if (panelRef.current) {
            panelWidth = panelRef.current.offsetWidth;
        }
        
        setPosition({
            top: rect.top - 16, // Position right above the button with some margin
            left: rect.left - (panelWidth / 2) + (rect.width / 2), // Center horizontally
        });
    };

    // Update position on mount and whenever dependencies change
    useEffect(() => {
        // Initial position
        updatePosition();
        
        // Also update on resize
        window.addEventListener('resize', updatePosition);
        
        // Cleanup
        return () => window.removeEventListener('resize', updatePosition);
    }, [readButtonRef, thumbsUpRef]);

    // Optional: Add another effect to ensure position is updated after the panel renders
    useEffect(() => {
        if (panelRef.current) {
            updatePosition();
        }
    }, [panelRef.current]);

    const thumbsDownClass = bookRating === -1
        ? "text-red-500" 
        : "text-white hover:text-red-500";
        
    const thumbsUpClass = bookRating === 1
        ? "text-green-500"
        : "text-white hover:text-green-500";
        
    const heartClass = bookRating === 2
        ? "text-pink-500"
        : "text-white hover:text-pink-500";

    // The actual panel content
    const panelContent = (
        <div 
            ref={panelRef}
            className="fixed bg-gray-800 p-3 rounded-lg shadow-lg flex flex-row items-center gap-3 z-[9999]"
            style={{ 
                top: `${position.top}px`, 
                left: `${position.left}px`,
                transform: 'translateY(-100%)', // Move it up by its own height
            }}
            onMouseEnter={() => {/* Keep it open when hovering */}}
            onMouseLeave={onMouseLeave} // Now this should work
        >
            {/* Thumbs Down */}
            <button 
                ref={thumbsDownRef}
                className={`text-white p-3 rounded-full transition flex items-center justify-center shadow-md bg-red-600 hover:bg-red-700`}
                style={{ width: '3.5rem', height: '3.5rem' }} // Explicit size for consistency
                onClick={() => handleRateBook(-1)}
            >
                <FaThumbsDown className="w-6 h-6" />
            </button>
            
            {/* Thumbs Up */}
            <button 
                ref={thumbsUpRef}
                className={`text-white p-3 rounded-full transition flex items-center justify-center shadow-md bg-green-600 hover:bg-green-700`}
                style={{ width: '3.5rem', height: '3.5rem' }}
                onClick={() => handleRateBook(1)}
            >
                <FaThumbsUp className="w-6 h-6" />
            </button>
            
            {/* Heart */}
            <button 
                ref={heartRef}
                className={`text-white p-3 rounded-full transition flex items-center justify-center shadow-md bg-pink-600 hover:bg-pink-700`}
                style={{ width: '3.5rem', height: '3.5rem' }}
                onClick={() => handleRateBook(2)}
            >
                <FaHeart className="w-6 h-6" />
            </button>
        </div>
    );

    // Create a portal directly to the document body
    return ReactDOM.createPortal(
        panelContent,
        document.body
    );
};
