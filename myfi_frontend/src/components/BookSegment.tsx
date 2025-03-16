import { useState, useRef, useEffect } from "react";
import { BookSegment } from "../types/BookSegment";
import { BookCard } from "./BookCard";

interface BookSegmentProps {
  segment: BookSegment;
}

export const BookSegmentRow = ({ segment }: BookSegmentProps) => {
  const [currentPage, setCurrentPage] = useState(0);
  const [showControls, setShowControls] = useState(false);
  const segmentRef = useRef<HTMLDivElement>(null);
  const booksPerPage = 6;
  const totalPages = Math.ceil(segment.books.length / booksPerPage);



  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (segmentRef.current) {
        const rect = segmentRef.current.getBoundingClientRect();
        const isInVerticalRange = e.clientY >= rect.top && e.clientY <= rect.bottom;
        setShowControls(isInVerticalRange);
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    return () => document.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const getCurrentPageBooks = () => {
    const start = currentPage * booksPerPage;
    const end = start + booksPerPage;
    return segment.books.slice(start, end);
  };

  return (
    <div 
      ref={segmentRef}
      className="mb-16 relative"
    >
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-white">
          {segment.isPersonalized && "📚 "}
          {segment.title}
        </h2>
        
        {/* Page Indicators */}
        {showControls && (
          <div className="flex">
            {Array.from({ length: totalPages }).map((_, index) => (
              <div
                key={index}
                className={`h-1 transition-all duration-200
                          ${index === currentPage 
                            ? 'w-8 bg-white' 
                            : 'w-4 bg-gray-600'}`}
                aria-label={`Page ${index + 1} of ${totalPages}`}
              />
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center relative">
        {/* Previous Button */}
        {showControls && currentPage > 0 && (
          <button
            onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
            className="absolute left-[-60px] top-1/2 -translate-y-1/2 w-12 h-24 
                     bg-gray-800 hover:bg-gray-700 text-white rounded-l
                     transition-colors duration-200 flex items-center justify-center"
          >
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}

{/* Books Grid */}
<div className="grid grid-cols-6 gap-8 w-full">
    {getCurrentPageBooks().map((book) => (
        <div key={book._id} className="aspect-[2/3] relative">
                <BookCard book={book} />
        </div>
    ))}
</div>


        {/* Next Button */}
        {showControls && currentPage < totalPages - 1 && (
          <button
            onClick={() => setCurrentPage(prev => Math.min(totalPages - 1, prev + 1))}
            className="absolute right-[-60px] top-1/2 -translate-y-1/2 w-12 h-24 
                     bg-gray-800 hover:bg-gray-700 text-white rounded-r
                     transition-colors duration-200 flex items-center justify-center"
          >
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
};
