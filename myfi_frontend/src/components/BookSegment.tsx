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
      const scrollAmount = direction === 'left' ? -1500 : 1500;
      containerRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
      setScrollPosition(prev => {
        const newPosition = prev + scrollAmount;
        return Math.max(0, Math.min(newPosition, maxScroll));
      });
    }
  };

  return (
    <div className="relative mx-0 -mb-8">
      <div className="absolute left-4 z-0 w-full">
        <h2 className="text-2xl font-bold text-white">
          {segment.isPersonalized && '📚 '}{segment.title}
        </h2>
      </div>
      
      <div className="relative group">
        <button
          onClick={() => scroll('left')}
          className="absolute left-0 z-30 h-full px-2 py-4 bg-black bg-opacity-50 text-white opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ display: scrollPosition <= 0 ? 'none' : 'block' }}
        >
          ←
        </button>

        <div
          ref={containerRef}
          className="flex overflow-x-scroll overflow-y-visible scroll-smooth px-4"
          style={{ 
            paddingTop: '3rem',
            paddingBottom: '2rem',
            position: 'relative',
            zIndex: 1
          }}
          onScroll={(e) => setScrollPosition(e.currentTarget.scrollLeft)}
        >
          {segment.books.map((book) => (
            <div 
              key={book._id} 
              className="flex-none w-48 aspect-[2/3] relative"
              style={{
                margin: '1rem 2rem', 
              }}
            > 
              <BookCard book={book} />
            </div>
          ))}
        </div>

        <button
          onClick={() => scroll('right')}
          className="absolute right-0 top-0 z-30 h-full px-2 py-4 bg-black bg-opacity-50 text-white opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ display: scrollPosition >= maxScroll ? 'none' : 'block' }}
        >
          →
        </button>
      </div>
    </div>
  );
};