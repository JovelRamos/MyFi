// src/contexts/HoverContext.tsx
import React, { createContext, useContext, useState } from 'react';

interface HoveredBook {
  bookId: string;
  containerId: string;
}

interface HoverContextType {
  hoveredBook: HoveredBook | null;
  setHoveredBook: (book: HoveredBook | null) => void;
}

const HoverContext = createContext<HoverContextType>({
  hoveredBook: null,
  setHoveredBook: () => {},
});

export const useHoverContext = () => useContext(HoverContext);

export const HoverProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const [hoveredBook, setHoveredBook] = useState<HoveredBook | null>(null);

  return (
    <HoverContext.Provider value={{ hoveredBook, setHoveredBook }}>
      {children}
    </HoverContext.Provider>
  );
};
