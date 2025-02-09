import { useState, useRef, useEffect } from "react";
import { BookSegment } from "../types/BookSegment";
import { BookCard } from "./BookCard";

interface BookSegmentProps {
  segment: BookSegment;
}

export const BookSegmentRow = ({ segment }: BookSegmentProps) => {
  const [scrollPosition, setScrollPosition] = useState(0);
  const [maxScroll, setMaxScroll] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const bookWidthWithMargin = 300; // Approximate default width of book card, adjusted dynamically later
  const scrollButtonWidth = 50; // Width of the scroll buttons (matches peek cover width)

  useEffect(() => {
    if (containerRef.current) {
      const containerWidth = containerRef.current.clientWidth;
      const totalContentWidth = containerRef.current.scrollWidth;

      // Set maximum scroll position
      setMaxScroll(totalContentWidth - containerWidth);
    }
  }, [segment.books]);

  const calculateScrollAmount = () => {
    const containerWidth = containerRef.current?.clientWidth || 0;

    // Compute the number of books visible per row, subtracted by peek (scroll button width)
    const totalVisibleWidth = containerWidth - 2 * scrollButtonWidth; // Space excluding left/right peeks
    const booksPerRow = Math.floor(totalVisibleWidth / bookWidthWithMargin);

    // Calculate the amount to scroll — equivalent to one "row" of books
    return booksPerRow * bookWidthWithMargin;
  };

  const scroll = (direction: "left" | "right") => {
    if (containerRef.current) {
      const scrollAmount = calculateScrollAmount();
      const scrollByAmount = direction === "left" ? -scrollAmount : scrollAmount;

      containerRef.current.scrollBy({ left: scrollByAmount, behavior: "smooth" });

      setScrollPosition((prev) => {
        const newPosition = prev + scrollByAmount;
        return Math.max(0, Math.min(newPosition, maxScroll));
      });
    }
  };

  return (
    <div className="relative mx-0 -mb-8">
      <div className="absolute left-4 z-0 w-full">
        <h2 className="text-2xl font-bold text-white">
          {segment.isPersonalized && "📚 "}
          {segment.title}
        </h2>
      </div>

      <div className="relative group">
        {/* Left Scroll Button */}
        <button
          onClick={() => scroll("left")}
          className="absolute left-0 z-30 h-full px-2 py-4 bg-black bg-opacity-50 text-white opacity-0 group-hover:opacity-100 transition-opacity"
          style={{
            display: scrollPosition <= 0 ? "none" : "block",
            width: `${scrollButtonWidth}px`,
          }}
        >
          ←
        </button>

        <div
          ref={containerRef}
          className="flex overflow-x-scroll overflow-y-hidden scroll-smooth px-0"
          style={{
            paddingTop: "3rem",
            paddingBottom: "2rem",
            position: "relative",
            zIndex: 1,
          }}
          onScroll={(e) => setScrollPosition(e.currentTarget.scrollLeft)}
        >
          {segment.books.map((book, index) => (
            <div
              key={book._id}
              className="flex-none"
              style={{
                width: `calc(${100 / 6}% - 3rem)`, // Dynamically divide space for 6 books with margins
                marginRight: `${index === segment.books.length - 1 ? "" : "1rem"}`, 
                 // consistent spacing
                aspectRatio: "2 / 3",
              }}
            >
              <BookCard book={book} />
            </div>
          ))}
        </div>

        {/* Right Button */}
        <button
          onClick={() => scroll("right")}
          className="absolute right-0 top-0 z-30 h-full px-4 py-4 bg-black bg-opacity-50 text-white opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ display: scrollPosition >= maxScroll ? "none" : "block" }}
        >
          →
        </button>
      </div>
    </div>
  );
};
