// src/pages/MyBooksPage.tsx
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useUserBooks } from '../contexts/UserBookContext';
import { Book } from '../types/Book';
import { useNavigate } from 'react-router-dom';
import * as d3 from 'd3';
import { SimulationNodeDatum } from 'd3';

// Extended Book type for D3 simulation
interface BookNode extends SimulationNodeDatum {
  id: string;
  book: Book;
  radius: number;
  status: 'reading' | 'to-read' | 'finished' | 'recommended';
  x?: number;
  y?: number;
}

function BookClusterMap({ 
  books, 
  readingStatus, 
  recommendations 
}: { 
  books: Book[], 
  readingStatus: Record<string, 'reading' | 'to-read' | 'finished'>,
  recommendations: Book[]
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [bookStatus, setBookStatus] = useState<'reading' | 'to-read' | 'finished' | 'recommended' | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  
  useEffect(() => {
    const updateDimensions = () => {
      if (svgRef.current?.parentElement) {
        setDimensions({
          width: svgRef.current.parentElement.clientWidth,
          height: window.innerHeight * 0.7
        });
      }
    };
    
    window.addEventListener('resize', updateDimensions);
    updateDimensions();
    
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    
    // Combine user books and recommendations
    const allBooks = [...books];
    
    // Add recommendations if they don't already exist in user books
    recommendations.forEach(rec => {
      if (!allBooks.some(book => book._id === rec._id)) {
        allBooks.push(rec);
      }
    });
    
    if (allBooks.length === 0) return;

    // Create nodes from books
    const nodes: BookNode[] = allBooks.map(book => {
      // Check if book is a recommendation
      const isRecommendation = recommendations.some(rec => rec._id === book._id) && 
                             !Object.keys(readingStatus).includes(book._id);
      
      return {
        id: book._id,
        book: book,
        radius: isRecommendation ? 35 : 40, // Make recommendations slightly smaller
        status: isRecommendation ? 'recommended' : (readingStatus[book._id] || 'to-read')
      };
    });

    // Define color scale for different book statuses
    const colorScale = d3.scaleOrdinal<string>()
      .domain(['reading', 'to-read', 'finished', 'recommended'])
      .range(['#60A5FA', '#6EE7B7', '#F87171', '#C084FC']); // Purple for recommendations

    // Create force simulation
    const simulation = d3.forceSimulation(nodes)
      .force('charge', d3.forceManyBody().strength(-100))
      .force('center', d3.forceCenter(dimensions.width / 2, dimensions.height / 2))
      .force('collision', d3.forceCollide().radius(d => (d as BookNode).radius + 5))
      .on('tick', ticked);

    // Group clusters by status
    const forceX = d3.forceX<BookNode>().strength(0.1);
    const forceY = d3.forceY<BookNode>().strength(0.1);
    
    // Adjust positioning based on book status - creating four clusters
    forceX.x(d => {
      switch(d.status) {
        case 'reading': return dimensions.width * 0.25;
        case 'to-read': return dimensions.width * 0.75;
        case 'finished': return dimensions.width * 0.25;
        case 'recommended': return dimensions.width * 0.75;
        default: return dimensions.width * 0.5;
      }
    });
    
    forceY.y(d => {
      switch(d.status) {
        case 'reading': return dimensions.height * 0.75;
        case 'to-read': return dimensions.height * 0.75;
        case 'finished': return dimensions.height * 0.25;
        case 'recommended': return dimensions.height * 0.25;
        default: return dimensions.height * 0.5;
      }
    });
    
    simulation.force('x', forceX).force('y', forceY);

    // Create SVG elements
    const nodesG = svg.append('g')
      .attr('class', 'nodes');

    // Add cluster labels
    const labels = [
      { text: "Currently Reading", x: dimensions.width * 0.25, y: dimensions.height * 0.9, color: '#60A5FA' },
      { text: "Reading List", x: dimensions.width * 0.75, y: dimensions.height * 0.9, color: '#6EE7B7' },
      { text: "Finished Books", x: dimensions.width * 0.25, y: dimensions.height * 0.1, color: '#F87171' },
      { text: "Recommendations", x: dimensions.width * 0.75, y: dimensions.height * 0.1, color: '#C084FC' }
    ];

    svg.selectAll('.cluster-label')
      .data(labels)
      .enter()
      .append('text')
      .attr('class', 'cluster-label')
      .attr('x', d => d.x)
      .attr('y', d => d.y)
      .attr('text-anchor', 'middle')
      .attr('fill', d => d.color)
      .attr('font-weight', 'bold')
      .attr('font-size', '18px')
      .text(d => d.text);

    // Add book nodes (circles with cover images)
    const node = nodesG.selectAll('.node')
      .data(nodes)
      .enter()
      .append('g')
      .attr('class', d => `node node-${d.status}`)
      .call(d3.drag<SVGGElement, BookNode>()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended))
      .on('click', (event, d) => {
        setSelectedBook(d.book);
        setBookStatus(d.status);
        event.stopPropagation();
      });

    // Add clipPath for circular book covers
    node.append('clipPath')
      .attr('id', d => `clip-${d.id}`)
      .append('circle')
      .attr('r', d => d.radius);

    // Add glowing effect for recommendations
    node.filter(d => d.status === 'recommended')
      .append('circle')
      .attr('r', d => d.radius + 6)
      .attr('fill', 'none')
      .attr('stroke', '#C084FC')
      .attr('stroke-width', 2)
      .attr('stroke-opacity', 0.5)
      .attr('class', 'recommendation-glow');

    // Add border circle
    node.append('circle')
      .attr('r', d => d.radius + 3)
      .attr('fill', 'none')
      .attr('stroke', d => colorScale(d.status))
      .attr('stroke-width', 3);

    // Add book cover images
    node.append('image')
      .attr('xlink:href', d => d.book.cover_id ? 
        `https://covers.openlibrary.org/b/id/${d.book.cover_id}-M.jpg` : 
        '/placeholder-cover.jpg')
      .attr('x', d => -d.radius)
      .attr('y', d => -d.radius)
      .attr('width', d => d.radius * 2)
      .attr('height', d => d.radius * 2)
      .attr('clip-path', d => `url(#clip-${d.id})`)
      .attr('preserveAspectRatio', 'xMidYMid slice');
    
    // Add small recommendation badge for recommended books
    node.filter(d => d.status === 'recommended')
      .append('circle')
      .attr('r', 10)
      .attr('cy', d => -d.radius)
      .attr('cx', d => d.radius)
      .attr('fill', '#C084FC')
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 1);

    node.filter(d => d.status === 'recommended')
      .append('text')
      .attr('y', d => -d.radius)
      .attr('x', d => d.radius)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('fill', '#ffffff')
      .attr('font-size', '10px')
      .attr('font-weight', 'bold')
      .text('★');
    
    // Add tooltip on hover
    node.append('title')
      .text(d => `${d.book.title} by ${d.book.author_names?.[0] || 'Unknown'}`);

    // Add subtle connection lines between books by same author
    const authorBooks = new Map<string, string[]>();
    
    // Collect books by author
    nodes.forEach(node => {
      const author = node.book.author_names?.[0];
      if (author) {
        if (!authorBooks.has(author)) {
          authorBooks.set(author, []);
        }
        authorBooks.get(author)?.push(node.id);
      }
    });
    
    // Draw connecting lines for authors with multiple books
    const connections: { source: string; target: string }[] = [];
    
    authorBooks.forEach((bookIds) => {
      if (bookIds.length > 1) {
        for (let i = 0; i < bookIds.length - 1; i++) {
          for (let j = i + 1; j < bookIds.length; j++) {
            connections.push({
              source: bookIds[i],
              target: bookIds[j]
            });
          }
        }
      }
    });
    
    const line = d3.line();
    
    const connectionLines = svg.append('g')
      .attr('class', 'connections')
      .selectAll('.connection')
      .data(connections)
      .enter()
      .append('path')
      .attr('class', 'connection')
      .attr('stroke', '#8B5CF6')
      .attr('stroke-opacity', 0.2)
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '3,3')
      .attr('fill', 'none');
    
    function ticked() {
      node.attr('transform', d => `translate(${d.x},${d.y})`);
      
      // Update connection lines
      connectionLines.attr('d', function(d) {
        const source = nodes.find(n => n.id === d.source);
        const target = nodes.find(n => n.id === d.target);
        
        if (source && target && source.x && source.y && target.x && target.y) {
          return line([[source.x, source.y], [target.x, target.y]]);
        }
        return '';
      });

      // Make recommendations gently pulse
      d3.selectAll('.recommendation-glow')
        .attr('stroke-opacity', 0.3 + 0.3 * Math.sin(Date.now() / 1000));
    }

    function dragstarted(event: any, d: BookNode) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event: any, d: BookNode) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event: any, d: BookNode) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }

    // Close book details panel when clicking on the empty space
    svg.on('click', () => {
      setSelectedBook(null);
      setBookStatus(null);
    });

    return () => {
      simulation.stop();
    };
  }, [books, readingStatus, recommendations, dimensions]);

  return (
    <div className="w-full h-full relative">
      <svg 
        ref={svgRef} 
        className="w-full bg-gray-900 rounded-xl" 
        style={{ height: dimensions.height }}
      />
      
      {selectedBook && (
        <div className="absolute top-5 left-5 bg-gray-800 p-6 rounded-lg shadow-xl max-w-sm z-10 border-2" 
             style={{ 
               borderColor: bookStatus === 'reading' ? '#60A5FA' : 
                           bookStatus === 'to-read' ? '#6EE7B7' : 
                           bookStatus === 'recommended' ? '#C084FC' : '#F87171' 
             }}>
          <button 
            onClick={() => {
              setSelectedBook(null);
              setBookStatus(null);
            }}
            className="absolute top-2 right-2 text-gray-400 hover:text-white"
          >
            ✕
          </button>
          <div className="flex flex-col items-center">
            <img 
              src={selectedBook.cover_id ? `https://covers.openlibrary.org/b/id/${selectedBook.cover_id}-M.jpg` : '/placeholder-cover.jpg'} 
              alt={`Cover for ${selectedBook.title}`}
              className="h-40 object-cover rounded-md shadow-lg mb-4"
            />
            <h3 className="text-xl font-bold text-white">{selectedBook.title}</h3>
            <p className="text-gray-300 mb-2">{selectedBook.author_names?.[0] || 'Unknown author'}</p>
            <p className="text-gray-400 text-sm mb-3">
              {bookStatus === 'reading' ? 'Currently Reading' : 
               bookStatus === 'to-read' ? 'On Reading List' : 
               bookStatus === 'recommended' ? 'Recommended for You' : 'Finished'}
            </p>
            
            {bookStatus === 'recommended' && (
              <button className="bg-purple-600 hover:bg-purple-700 text-white py-1 px-3 rounded-md text-sm">
                Add to Reading List
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function MyBooksPage() {
  const { isAuthenticated } = useAuth();
  const { readingList, currentlyReading, finishedBooks, isInitialLoading } = useUserBooks();
  const navigate = useNavigate();
  const [books, setBooks] = useState<Book[]>([]);
  const [recommendations, setRecommendations] = useState<Book[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [readingStatus, setReadingStatus] = useState<Record<string, 'reading' | 'to-read' | 'finished'>>({});
  
  useEffect(() => {  
    const fetchBooks = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('http://localhost:8000/api/books');
        if (!response.ok) throw new Error('Failed to fetch books');
        
        const data = await response.json();
        setBooks(data.books);
      } catch (error) {
        console.error('Failed to fetch books:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchBooks();
  }, []);

  // Fetch recommendations based on user's reading history
  useEffect(() => {
    const fetchRecommendations = async () => {
      try {
        // Don't generate recommendations if the user hasn't finished any books
        if (finishedBooks.length === 0) {
          return;
        }
        
        // Here you would normally fetch recommendations from your API
        // For now, we'll simulate by selecting 4-6 random books not in user's lists
        const userBookIds = new Set([
          ...readingList,
          ...currentlyReading,
          ...finishedBooks.map(fb => fb.bookId)
        ]);
        
        const candidateBooks = books.filter(book => !userBookIds.has(book._id));
        
        // Randomly select 4-6 books
        const recommendationCount = Math.floor(Math.random() * 3) + 4; // 4 to 6 books
        const randomRecommendations: Book[] = [];
        
        for (let i = 0; i < recommendationCount && candidateBooks.length > 0; i++) {
          const randomIndex = Math.floor(Math.random() * candidateBooks.length);
          randomRecommendations.push(candidateBooks[randomIndex]);
          candidateBooks.splice(randomIndex, 1);
        }
        
        setRecommendations(randomRecommendations);
        
      } catch (error) {
        console.error('Failed to fetch recommendations:', error);
      }
    };

    if (!isLoading && books.length > 0) {
      fetchRecommendations();
    }
  }, [books, readingList, currentlyReading, finishedBooks, isLoading]);

  // Create a map of book status for all user books
  useEffect(() => {
    const statusMap: Record<string, 'reading' | 'to-read' | 'finished'> = {};
    
    // Mark reading list books
    readingList.forEach(bookId => {
      statusMap[bookId] = 'to-read';
    });
    
    // Mark currently reading books
    currentlyReading.forEach(bookId => {
      statusMap[bookId] = 'reading';
    });
    
    // Mark finished books
    finishedBooks.forEach(item => {
      statusMap[item.bookId] = 'finished';
    });
    
    setReadingStatus(statusMap);
  }, [readingList, currentlyReading, finishedBooks]);

  // Get all user books
  const userBooks = books.filter(book => 
    readingList.includes(book._id) || 
    currentlyReading.includes(book._id) || 
    finishedBooks.some(fb => fb.bookId === book._id)
  );

  // Redirect non-authenticated users to login
  if (!isAuthenticated && !isInitialLoading) {
    return (
      <div className="p-8 bg-gray-800 rounded-lg text-center">
        <h2 className="text-2xl font-bold text-white mb-4">You need to be logged in</h2>
        <p className="text-gray-400 mb-6">Please log in to view your book collections.</p>
        <button 
          className="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
          onClick={() => navigate('/')}
        >
          Go to Home Page
        </button>
      </div>
    );
  }

  if (isInitialLoading || isLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center z-50 bg-zinc-900 bg-opacity-80">
        <div className="relative w-16 h-16">
          <div className="absolute top-0 left-0 w-full h-full border-4 border-gray-600 rounded-full"></div>
          <div className="absolute top-0 left-0 w-full h-full border-4 border-t-red-600 rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  const hasAnyBooks = userBooks.length > 0 || recommendations.length > 0;

  return (
    <div className="space-y-5">
      <h1 className="text-3xl font-bold text-white mb-8">My Books - Cluster Map</h1>
      
      {hasAnyBooks ? (
        <BookClusterMap 
          books={userBooks} 
          readingStatus={readingStatus} 
          recommendations={recommendations}
        />
      ) : (
        <div className="bg-gray-800 p-8 rounded-lg text-center">
          <h3 className="text-xl font-bold text-white mb-4">You don't have any books yet</h3>
          <p className="text-gray-400 mb-6">Start by exploring the library and adding books to your collections.</p>
          <button 
            className="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
            onClick={() => navigate('/explore')}
          >
            Explore Books
          </button>
        </div>
      )}
      
      <div className="bg-gray-800 p-4 rounded-lg mt-4">
        <h3 className="text-md font-semibold text-white mb-2">How to use:</h3>
        <ul className="text-gray-400 text-sm list-disc pl-5">
          <li>Drag book covers to move them around</li>
          <li>Click on a book to see more details</li>
          <li>Books are grouped by reading status</li>
          <li>Blue = Currently Reading, Green = Reading List, Red = Finished Books, Purple = Recommendations</li>
          <li>Dotted lines connect books by the same author</li>
        </ul>
      </div>
    </div>
  );
}

export default MyBooksPage;
