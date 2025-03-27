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
import ReactDOM from 'react-dom';

interface BookButtonsProps {
    book: Book;
    isHovered: boolean;
}

interface TooltipProps {
    text: string;
    targetRef: React.RefObject<HTMLElement>;
    visible: boolean;
}

// Tooltip component using portal
const Tooltip = ({ text, targetRef, visible }: TooltipProps) => {
    const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
    
    useEffect(() => {
        if (visible && targetRef.current) {
            const rect = targetRef.current.getBoundingClientRect();
            setTooltipPosition({
                top: rect.top + rect.height / 2,
                left: rect.left - 120
            });
        }
    }, [visible, targetRef]);
    
    if (!visible) return null;
    
    return ReactDOM.createPortal(
        <div 
            style={{
                position: 'fixed',
                top: `${tooltipPosition.top}px`,
                left: `${tooltipPosition.left}px`,
                backgroundColor: 'black',
                color: 'white',
                padding: '4px 8px',
                borderRadius: '4px',
                fontSize: '0.75rem',
                whiteSpace: 'nowrap',
                zIndex: 9999,
                pointerEvents: 'none',
                transform: 'translateY(-50%)'
            }}
        >
            {text}
        </div>,
        document.body
    );
};

export const BookButtons = ({ book, isHovered }: BookButtonsProps) => {
    const [activePanel, setActivePanel] = useState<'read' | 'add' | null>(null);
    
    // Track hovering state for each button independently of panels
    const [hoveredButtons, setHoveredButtons] = useState<Set<string>>(new Set());
    
    // Computed states for panel visibility
    const showReadPanel = activePanel === 'read';
    const showAddPanel = activePanel === 'add';
    
    // Refs for tooltip positioning
    const addButtonRef = useRef<HTMLButtonElement>(null);
    const readButtonRef = useRef<HTMLButtonElement>(null);
    const infoButtonRef = useRef<HTMLButtonElement>(null);
    const removeButtonRef = useRef<HTMLButtonElement>(null);
    
    const { 
        readingList, 
        currentlyReading, 
        ratings,
        addToReadingList, 
        markAsCurrentlyReading,
        removeFromReadingList,
        removeFromCurrentlyReading, 
        markAsFinished,
        rateBook 
    } = useUserBooks();
    
    const isInReadingList = readingList.includes(book._id);
    const isCurrentlyReading = currentlyReading.includes(book._id);
    const bookRating = ratings.find(r => r.bookId === book._id)?.rating;
    
    // Helper functions to manage hoveredButtons Set
    const addHoveredButton = (button: string) => {
        setHoveredButtons(prev => new Set([...prev, button]));
    };
    
    const removeHoveredButton = (button: string) => {
        setHoveredButtons(prev => {
            const newSet = new Set(prev);
            newSet.delete(button);
            return newSet;
        });
    };
    
    const isButtonHovered = (button: string) => hoveredButtons.has(button);
    
    // Reset states when the card is no longer hovered
    useEffect(() => {
        if (!isHovered) {
            setActivePanel(null);
            setHoveredButtons(new Set());
        }
    }, [isHovered]);
    
    // BookButtons.tsx - Just update the handler functions to be more efficient
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
            // Check if the book is in currently reading or reading list and remove accordingly
            if (isCurrentlyReading) {
                await removeFromCurrentlyReading(book._id);
                toast.success(`"${book.title}" removed from currently reading!`);
            } else if (isInReadingList) {
                await removeFromReadingList(book._id);
                toast.success(`"${book.title}" removed from your reading list!`);
            }
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
            await markAsFinished(book._id);
            toast.success(message);
        } catch (error) {
            toast.error('Failed to rate book. Please try again.');
            console.error(error);
        }
        
        setActivePanel(null);
    };
    
    const handleMoreInfo = () => {
        // Create a URL compatible for Open Library
        const openLibraryId = book._id.replace('/works/', '');
        window.open(`https://openlibrary.org/works/${openLibraryId}`, '_blank');
        toast.info(`Opening details for "${book.title}"`);
    };
    
    // Define UI states based on user data
    const addButtonClass = "bg-green-600 hover:bg-green-700";
    const readButtonClass = "bg-blue-600 hover:bg-blue-700";
    const infoButtonClass = "bg-purple-600 hover:bg-purple-700";
    const removeButtonClass = "bg-red-600 hover:bg-red-700";
    
    const buttonSize = { width: '3.5rem', height: '3.5rem' };

    return (
        <>
            {/* Tooltips using React Portals - Always show when button is hovered, regardless of panel state */}
            {isHovered && (
                <>
                    <Tooltip 
                        text="Add to Reading List" 
                        targetRef={addButtonRef} 
                        visible={isButtonHovered('add')} 
                    />
                    <Tooltip 
                        text="Mark as Read" 
                        targetRef={readButtonRef} 
                        visible={isButtonHovered('read')} 
                    />
                    <Tooltip 
                        text="More Information" 
                        targetRef={infoButtonRef} 
                        visible={isButtonHovered('info')} 
                    />
                    {(isInReadingList || isCurrentlyReading) && (
                        <Tooltip 
                            text="Remove from List" 
                            targetRef={removeButtonRef} 
                            visible={isButtonHovered('remove')} 
                        />
                    )}
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
                        onMouseEnter={() => {
                            addHoveredButton('add');
                            setActivePanel('add');
                        }}
                        onMouseLeave={() => {
                            removeHoveredButton('add');
                            // Don't close panel on button leave
                        }}
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

                {/* Read Button */}
                <div className="relative">
                    <button 
                        ref={readButtonRef}
                        className={`text-white p-3 rounded-full transition flex items-center justify-center shadow-md ${readButtonClass}`}
                        style={buttonSize}
                        aria-label="Read"
                        onClick={handleMarkAsFinished} // Directly mark as finished when clicking the button
                        onMouseEnter={() => {
                            addHoveredButton('read');
                            setActivePanel('read'); // Show ratings dropdown on hover
                        }}
                        onMouseLeave={() => {
                            removeHoveredButton('read');
                            // Don't close panel on button leave
                        }}
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
                    onClick={handleMoreInfo} // Open detailed info in a new tab
                    onMouseEnter={() => {
                        addHoveredButton('info');
                        setActivePanel(null); // Close other panels
                    }}
                    onMouseLeave={() => {
                        removeHoveredButton('info');
                    }}
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
                        onMouseEnter={() => {
                            addHoveredButton('remove');
                            setActivePanel(null); // Close other panels
                        }}
                        onMouseLeave={() => {
                            removeHoveredButton('remove');
                        }}
                    >
                        <FaTimes className="w-6 h-6" />
                    </button>
                )}
            </div>
        </>
    );
};
