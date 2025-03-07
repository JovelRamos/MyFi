// AddOptionsPanel.tsx
import { useRef, useEffect } from 'react';

interface AddOptionsPanelProps {
    handleAddToList: () => Promise<void>;
    handleMarkAsReading: () => Promise<void>;
    isOpen: boolean;
    setIsOpen: (isOpen: boolean) => void;
}

export const AddOptionsPanel = ({ 
    handleAddToList, 
    handleMarkAsReading,
    isOpen,
    setIsOpen
}: AddOptionsPanelProps) => {
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

    return (
        <div 
            ref={panelRef}
            className={`absolute left-full top-1/2 transform -translate-y-1/2 ml-2 bg-gray-800 rounded-lg p-3 flex flex-col gap-3 z-40 shadow-xl transition-opacity duration-200 ease-in-out ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
            onMouseEnter={() => setIsOpen(true)}
        >
            <button 
                className="text-white p-2 bg-green-700 hover:bg-green-600 rounded w-40"
                onClick={handleAddToList}
            >
                Reading List
            </button>
            <button 
                className="text-white p-2 bg-blue-700 hover:bg-blue-600 rounded w-40"
                onClick={handleMarkAsReading}
            >
                Currently Reading
            </button>
        </div>
    );
};
