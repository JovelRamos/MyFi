// AddOptionsPanel.tsx

interface AddOptionsPanelProps {
    handleAddToList: () => Promise<void>;
    handleMarkAsReading: () => Promise<void>;
}

export const AddOptionsPanel = ({ 
    handleAddToList, 
    handleMarkAsReading 
}: AddOptionsPanelProps) => {
    return (
        <div className="absolute left-full top-1/2 transform -translate-y-1/2 ml-2 bg-gray-800 rounded-lg p-3 flex flex-col gap-3 z-40 shadow-xl">
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
