import { useState, useRef, useEffect } from 'react';
import { BookSegment } from '../types/BookSegment';
import { BookCard } from './BookCard';

interface BookSegmentProps {
  segment: BookSegment;
}

export const BookSegmentRow = ({ segment }: BookSegmentProps) => {
  const [scrollPosition, setScrollPosition] = useState(0);
  const [maxScroll, setMaxScroll] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      setMaxScroll(
        containerRef.current.scrollWidth - containerRef.current.clientWidth
      );
    }
  }, [segment.books]);

  const scroll = (direction: 'left' | 'right') => {
    if (containerRef.current) {
      const scrollAmount = direction === 'left' ? -800 : 800;
      containerRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
      setScrollPosition(prev => {
        const newPosition = prev + scrollAmount;
        return Math.max(0, Math.min(newPosition, maxScroll));
      });
    }
  };

  return (
    <div className="py-4">
      <div className="flex items-center justify-between px-4 mb-3">
        <h2 className="text-2xl font-bold text-white">
          {segment.isPersonalized && '📚 '}{segment.title}
        </h2>
        {segment.sourceBook && (
          <span className="text-sm text-gray-400">
            Based on: {segment.sourceBook.title}
          </span>
        )}
      </div>
      
      <div className="relative group">
        <button
          onClick={() => scroll('left')}
          className="absolute left-0 z-10 h-full px-2 py-4 bg-black bg-opacity-50 text-white opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ display: scrollPosition <= 0 ? 'none' : 'block' }}
        >
          ←
        </button>

        <div
          ref={containerRef}
          className="flex overflow-x-hidden scroll-smooth space-x-4 px-4"
          onScroll={(e) => setScrollPosition(e.currentTarget.scrollLeft)}
        >
          {segment.books.map((book) => (
            <div key={book._id} className="flex-none w-48 h-64">
              <BookCard book={book} />
            </div>
          ))}
        </div>

        <button
          onClick={() => scroll('right')}
          className="absolute right-0 top-0 z-10 h-full px-2 py-4 bg-black bg-opacity-50 text-white opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ display: scrollPosition >= maxScroll ? 'none' : 'block' }}
        >
          →
        </button>
      </div>
    </div>
  );
};
