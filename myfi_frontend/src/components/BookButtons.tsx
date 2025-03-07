// BookButtons.tsx
import { useState, useRef, useEffect } from 'react';
import { Book } from '../types/Book';
import { 
  FaBookOpen, FaPlus, FaInfoCircle, FaTimes 
} from 'react-icons/fa';
import { useUserBooks } from '../contexts/UserBookContext';
import { toast } from 'react-toastify';
import { AddOptionsPanel } from './AddOptionsPanel';
import { ReadOptionsPanel } from './ReadOptionsPanel';

interface BookButtonsProps {
    book: Book;
    isHovered: boolean;
}

export const BookButtons = ({ book, isHovered }: BookButtonsProps) => {
    const [activePanel, setActivePanel] = useState<'read' | 'add' | null>(null);
    const [showRatingButtons, setShowRatingButtons] = useState(false);
    
    // Computed states for panel visibility
    const showReadPanel = activePanel === 'read';
    const showAddPanel = activePanel === 'add';
    
    // Refs for tooltip positioning
    const addButtonRef = useRef<HTMLButtonElement>(null);
    const readButtonRef = useRef<HTMLButtonElement>(null);
    const infoButtonRef = useRef<HTMLButtonElement>(null);
    const removeButtonRef = useRef<HTMLButtonElement>(null);
    const thumbsDownRef = useRef<HTMLButtonElement>(null);
    const thumbsUpRef = useRef<HTMLButtonElement>(null);
    const heartRef = useRef<HTMLButtonElement>(null);
    
    // Tooltip refs
    const addTooltipRef = useRef<HTMLDivElement>(null);
    const readTooltipRef = useRef<HTMLDivElement>(null);
    const infoTooltipRef = useRef<HTMLDivElement>(null);
    const removeTooltipRef = useRef<HTMLDivElement>(null);
    const thumbsDownTooltipRef = useRef<HTMLDivElement>(null);
    const thumbsUpTooltipRef = useRef<HTMLDivElement>(null);
    const heartTooltipRef = useRef<HTMLDivElement>(null);
    
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
    
    // Reset active panel when the card is no longer hovered
    useEffect(() => {
        if (!isHovered) {
            setActivePanel(null);
        }
    }, [isHovered]);
    
    // Effect to position tooltips based on button positions
    useEffect(() => {
        if (!isHovered) return;
        
        const positionTooltip = (buttonRef: React.RefObject<HTMLButtonElement>, tooltipRef: React.RefObject<HTMLDivElement>, text: string) => {
            if (buttonRef.current && tooltipRef.current) {
                const buttonRect = buttonRef.current.getBoundingClientRect();
                tooltipRef.current.textContent = text;
                tooltipRef.current.style.left = `${buttonRect.left - 120}px`;
                tooltipRef.current.style.top = `${buttonRect.top + buttonRect.height/2}px`;
                tooltipRef.current.style.display = 'block';
            }
        };
        
        // Position tooltips
        positionTooltip(addButtonRef, addTooltipRef, "Add to Reading List");
        positionTooltip(readButtonRef, readTooltipRef, "Mark as Read");
        positionTooltip(infoButtonRef, infoTooltipRef, "More Information");
        
        if (isInReadingList || isCurrentlyReading) {
            positionTooltip(removeButtonRef, removeTooltipRef, "Remove from List");
        }
        
        if (showRatingButtons) {
            positionTooltip(thumbsDownRef, thumbsDownTooltipRef, "Disliked it");
            positionTooltip(thumbsUpRef, thumbsUpTooltipRef, "Liked it");
            positionTooltip(heartRef, heartTooltipRef, "Loved it!");
        }
        
    }, [isHovered, showRatingButtons, isInReadingList, isCurrentlyReading]);
    
    const handleAddToList = async () => {
        try {
            await addToReadingList(book._id);
            toast.success(`"${book.title}" added to your reading list!`);
        } catch (error) {
            toast.error('Failed to add book. Please try again.');
            console.error(error);
        }
        setActivePanel(null);
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
        setActivePanel(null);
    };
    
    const handleMarkAsFinished = async () => {
        try {
            await markAsFinished(book._id);
            toast.success(`"${book.title}" marked as finished!`);
        } catch (error) {
            toast.error('Failed to update reading status. Please try again.');
            console.error(error);
        }
        setActivePanel(null);
    };
    
    const handleRateBook = async (rating: number) => {
        try {
            await rateBook(book._id, rating);
            
            let message = '';
            if (rating === 1) message = `You rated "${book.title}" 1 star!`;
            else if (rating === 2) message = `You rated "${book.title}" 2 stars!`;
            else if (rating === 3) message = `You rated "${book.title}" 3 stars!`;
            else if (rating === 4) message = `You rated "${book.title}" 4 stars!`;
            else message = `You rated "${book.title}" 5 stars!`;
            
            toast.success(message);
        } catch (error) {
            toast.error('Failed to rate book. Please try again.');
            console.error(error);
        }
        
        setActivePanel(null);
        setShowRatingButtons(false);
    };
    
    // Define UI states based on user data
    const addButtonClass = "bg-green-600 hover:bg-green-700";
    const readButtonClass = "bg-blue-600 hover:bg-blue-700";
    const infoButtonClass = "bg-purple-600 hover:bg-purple-700";
    const removeButtonClass = "bg-red-600 hover:bg-red-700";
    
    const buttonSize = { width: '3.5rem', height: '3.5rem' };
    
    const tooltipStyle = {
        position: 'absolute' as 'absolute',
        backgroundColor: 'black',
        color: 'white',
        padding: '4px 8px',
        borderRadius: '4px',
        fontSize: '0.75rem',
        whiteSpace: 'nowrap' as 'nowrap',
        zIndex: 9999,
        pointerEvents: 'none' as 'none',
        display: 'none'
    };

    return (
        <>
            {/* Tooltips */}
            {isHovered && (
                <>
                    <div ref={addTooltipRef} style={tooltipStyle} />
                    <div ref={readTooltipRef} style={tooltipStyle} />
                    <div ref={infoTooltipRef} style={tooltipStyle} />
                    <div ref={removeTooltipRef} style={tooltipStyle} />
                    <div ref={thumbsDownTooltipRef} style={tooltipStyle} />
                    <div ref={thumbsUpTooltipRef} style={tooltipStyle} />
                    <div ref={heartTooltipRef} style={tooltipStyle} />
                </>
            )}
          
            {/* Main content */}
            <div className="bg-gray-800 flex flex-col justify-center items-center gap-4 p-3 overflow-visible" 
                style={{ 
                    width: '30%',
                    transform: isHovered ? 'translateX(0)' : 'translateX(-100%)',
                    transition: 'transform 300ms ease-out 50ms',
                }}
            >
                {/* Add Button */}
                <div className="relative">
                    <button 
                        ref={addButtonRef}
                        className={`text-white p-3 rounded-full transition flex items-center justify-center shadow-md ${addButtonClass}`}
                        style={buttonSize}
                        aria-label="Add to List"
                        onMouseEnter={() => setActivePanel('add')}
                    >
                        <FaPlus className="w-6 h-6" />
                    </button>
                    
                    {/* Add Options Panel */}
                    <AddOptionsPanel 
                        handleAddToList={handleAddToList}
                        handleMarkAsReading={handleMarkAsReading}
                        isOpen={showAddPanel}
                        setIsOpen={(isOpen) => setActivePanel(isOpen ? 'add' : null)}
                    />
                </div>

                {/* Read Button and Rating Buttons */}
                <div className="relative">
                    <button 
                        ref={readButtonRef}
                        className={`text-white p-3 rounded-full transition flex items-center justify-center shadow-md ${readButtonClass}`}
                        style={buttonSize}
                        aria-label="Read"
                        onClick={handleMarkAsFinished} // Directly mark as finished when clicking the button
                        onMouseEnter={() => setActivePanel('read')} // Show ratings dropdown on hover
                    >
                        <FaBookOpen className="w-6 h-6" />
                    </button>
                    
                    {/* Read Options Panel */}
                    <ReadOptionsPanel 
                        handleRateBook={handleRateBook}
                        bookRating={bookRating}
                        isOpen={showReadPanel}
                        setIsOpen={(isOpen) => setActivePanel(isOpen ? 'read' : null)}
                    />
                </div>

                {/* More Info Button */}
                <button 
                    ref={infoButtonRef}
                    className={`text-white p-3 rounded-full transition flex items-center justify-center shadow-md ${infoButtonClass}`}
                    style={buttonSize}
                    aria-label="More Info"
                    onClick={() => console.log('More info clicked')}
                    onMouseEnter={() => setActivePanel(null)} // Close other panels
                >
                    <FaInfoCircle className="w-6 h-6" />
                </button>
                
                {/* Remove Button - visible for books in reading list OR currently reading */}
                {(isInReadingList || isCurrentlyReading) && (
                    <button 
                        ref={removeButtonRef}
                        className={`text-white p-3 rounded-full transition flex items-center justify-center shadow-md ${removeButtonClass}`}
                        style={buttonSize}
                        aria-label="Remove from List"
                        onClick={handleRemoveFromList}
                        onMouseEnter={() => setActivePanel(null)} // Close other panels
                    >
                        <FaTimes className="w-6 h-6" />
                    </button>
                )}
            </div>
        </>
    );
};
