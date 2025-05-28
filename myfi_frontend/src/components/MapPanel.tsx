// src/components/MapPanel.tsx
import { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { SimulationNodeDatum } from 'd3';
import { Book } from '../types/Book';

// Extended Book type for D3 simulation
interface BookNode extends SimulationNodeDatum {
  id: string;
  book: Book;
  radius: number;
  status: 'reading' | 'to-read' | 'finished' | 'recommended';
  x?: number;
  y?: number;
  rating?: number;
  similarityScore?: number; // For positioning based on similarity
  sourceBookId?: string; // For recommended books, links to the source book
}

// For item-based recommendation connections
interface BookConnection {
  source: string;
  target: string;
  strength: number; // Similarity strength
  type: 'similarity' | 'recommendation';
}

function BookClusterMap({ 
  books, 
  readingStatus,
  recommendations,
  similarityData,
  ratings
}: { 
  books: Book[], 
  readingStatus: Record<string, 'reading' | 'to-read' | 'finished'>,
  recommendations: Book[],
  similarityData: Record<string, Record<string, number>>, // book -> similar book -> score
  ratings: Record<string, number> // book id -> rating (1-5)
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [bookStatus, setBookStatus] = useState<'reading' | 'to-read' | 'finished' | 'recommended' | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [clusterMethod, setClusterMethod] = useState<'status' | 'similarity' | 'genre'>('similarity');
  
  // Update dimensions when window resizes
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

    // Track connections between books
    const connections: BookConnection[] = [];
    
    // Process recommendations based on highly rated books (4-5 stars)
    const highlyRatedBookIds = Object.entries(ratings)
        .filter(([_, rating]) => rating >= 4)
        .map(([bookId]) => bookId);

    // Create a map to track which recommendations come from which source books
    const recommendationSources: Record<string, string[]> = {};

    
    // Add recommendations if they don't already exist in user books
    recommendations.forEach(rec => {
        if (!allBooks.some(book => book._id === rec._id)) {
        // Add this recommendation to allBooks regardless of connections
        allBooks.push(rec);
        
        // Find if it connects to any highly rated books
        const sourcesForRec = highlyRatedBookIds.filter(bookId => 
            similarityData[bookId]?.[rec._id] > 0.5
        );
        
        // If we found connections, create them
        if (sourcesForRec.length > 0) {
            recommendationSources[rec._id] = sourcesForRec;
            
            sourcesForRec.forEach(sourceId => {
            const similarityScore = similarityData[sourceId]?.[rec._id] || 0.5;
            connections.push({
                source: sourceId,
                target: rec._id,
                strength: similarityScore,
                type: 'recommendation'
            });
            });
        } 
        // If no connections found but we still want to show the recommendation
        else if (highlyRatedBookIds.length > 0) {
            // Create a weak connection to a random highly rated book
            const randomSourceId = highlyRatedBookIds[Math.floor(Math.random() * highlyRatedBookIds.length)];
            connections.push({
            source: randomSourceId,
            target: rec._id,
            strength: 0.3, // Weaker connection
            type: 'recommendation'
            });
            recommendationSources[rec._id] = [randomSourceId];
        }
        // If no highly rated books at all, place near center
        else {
            // We'll handle positioning with the default center force
            recommendationSources[rec._id] = [];
        }
        }
    });
  
    
    // Add similarity connections between existing books
    allBooks.forEach(book1 => {
      if (similarityData[book1._id]) {
        Object.entries(similarityData[book1._id])
          .filter(([book2Id, score]) => 
            score > 0.7 && // Only show strong connections
            book1._id < book2Id && // Avoid duplicate connections
            allBooks.some(b => b._id === book2Id) // Only connect to books in our visualization
          )
          .forEach(([book2Id, score]) => {
            connections.push({
              source: book1._id,
              target: book2Id,
              strength: score,
              type: 'similarity'
            });
          });
      }
    });
    
    if (allBooks.length === 0) return;

    // Create nodes from books
    const nodes: BookNode[] = allBooks.map(book => {
      // Check if book is a recommendation
      const isRecommendation = recommendationSources[book._id] !== undefined;
      
      // Get average similarity score for positioning
      let similarityScore = 0;
      let connectionCount = 0;
      
      connections.forEach(conn => {
        if (conn.source === book._id || conn.target === book._id) {
          similarityScore += conn.strength;
          connectionCount += 1;
        }
      });
      
      if (connectionCount > 0) {
        similarityScore /= connectionCount;
      }
      
      const sourceBookId = isRecommendation ? recommendationSources[book._id][0] : undefined;
      
      return {
        id: book._id,
        book: book,
        radius: isRecommendation ? 35 : 40,
        status: isRecommendation ? 'recommended' : (readingStatus[book._id] || 'to-read'),
        rating: ratings[book._id],
        similarityScore: similarityScore,
        sourceBookId: sourceBookId
      };
    });

    // Define color scale for different book statuses
    const colorScale = d3.scaleOrdinal<string>()
      .domain(['reading', 'to-read', 'finished', 'recommended'])
      .range(['#60A5FA', '#6EE7B7', '#F87171', '#C084FC']);

// Create force simulation
const simulation = d3.forceSimulation(nodes)
  .force('charge', d3.forceManyBody().strength(-150)) // Reduced from -300
  .force('center', d3.forceCenter(dimensions.width / 2, dimensions.height / 2).strength(0.3)) // Increased from 0.1
  .force('collision', d3.forceCollide().radius(d => (d as BookNode).radius + 8).strength(0.9)) // Reduced spacing from 15 to 8
  .alphaDecay(0.02)
  .velocityDecay(0.6) // Increased from 0.4
  .on('tick', ticked);

// Define forces based on selected clustering method
if (clusterMethod === 'status') {
  // Cluster by reading status
  simulation
    .force('x', d3.forceX<BookNode>().strength(0.3).x(d => { // Increased from 0.1
      switch(d.status) {
        case 'reading': return dimensions.width * 0.3; // Moved closer to center
        case 'to-read': return dimensions.width * 0.7;
        case 'finished': return dimensions.width * 0.3;
        case 'recommended': return dimensions.width * 0.7;
        default: return dimensions.width * 0.5;
      }
    }))
    .force('y', d3.forceY<BookNode>().strength(0.3).y(d => { // Increased from 0.1
      switch(d.status) {
        case 'reading': return dimensions.height * 0.65; // Moved closer to center
        case 'to-read': return dimensions.height * 0.65;
        case 'finished': return dimensions.height * 0.35;
        case 'recommended': return dimensions.height * 0.35;
        default: return dimensions.height * 0.5;
      }
    }));
} else if (clusterMethod === 'similarity') {
  // Position books by similarity - similar books cluster together
  
  // Add forces based on book connections
  const linkForce = d3.forceLink<BookNode, BookConnection>()
    .id(d => d.id)
    .links(connections)
    .distance(d => 120 * (1 - d.strength)) // Reduced from 200
    .strength(d => d.strength * 0.7); // Increased from 0.5
  
  simulation.force('link', linkForce);
  
  // Add forces for recommendations to stay close to source books
  nodes.filter(d => d.sourceBookId).forEach(node => {
    if (node.sourceBookId) {
      const sourceNode = nodes.find(n => n.id === node.sourceBookId);
      if (sourceNode && sourceNode.x && sourceNode.y) {
        // Initialize position near source
        node.x = sourceNode.x + (Math.random() - 0.5) * 50;
        node.y = sourceNode.y + (Math.random() - 0.5) * 50;
      }
    }
  });
  
  // Add light status-based clustering to prevent complete chaos
  simulation
    .force('x', d3.forceX<BookNode>().strength(0.1).x(d => { // Increased from 0.02
      // Very weak status-based clustering
      switch(d.status) {
        case 'reading': return dimensions.width * 0.45; // Moved closer to center
        case 'to-read': return dimensions.width * 0.55;
        case 'finished': return dimensions.width * 0.45;
        case 'recommended': return dimensions.width * 0.55;
        default: return dimensions.width * 0.5;
      }
    }))
    .force('y', d3.forceY<BookNode>().strength(0.1).y(d => { // Increased from 0.02
      // Very weak status-based clustering
      switch(d.status) {
        case 'reading': return dimensions.height * 0.55; // Moved closer to center
        case 'to-read': return dimensions.height * 0.55;
        case 'finished': return dimensions.height * 0.45;
        case 'recommended': return dimensions.height * 0.45;
        default: return dimensions.height * 0.5;
      }
    }));
}
 else if (clusterMethod === 'genre') {
      // Placeholder for genre-based clustering
    }

    // Create SVG elements
    const nodesG = svg.append('g')
      .attr('class', 'nodes');
      
    // Draw connection lines first (so they appear behind nodes)
    const connectionLinesGroup = svg.append('g')
      .attr('class', 'connections');
      
    const connectionLines = connectionLinesGroup
      .selectAll('.connection-line')
      .data(connections)
      .enter()
      .append('line')
      .attr('class', d => `connection-line ${d.type}`)
      .attr('stroke', d => d.type === 'recommendation' ? '#C084FC' : '#8B5CF6')
      .attr('stroke-opacity', d => d.type === 'recommendation' ? 0.7 : 0.3)
      .attr('stroke-width', d => d.strength * 3)
      .attr('stroke-dasharray', d => d.type === 'recommendation' ? '5,5' : '3,3');

    // Add cluster method labels if using status-based clustering
    if (clusterMethod === 'status') {
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
    }

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
      
    // Add highlight for 5-star rated books
    node.filter(d => typeof d.rating === 'number' && d.rating >= 5)
      .append('circle')
      .attr('r', d => d.radius + 6)
      .attr('fill', 'none')
      .attr('stroke', '#FFD700') // Gold for 5-star books
      .attr('stroke-width', 3)
      .attr('stroke-dasharray', '0')
      .attr('class', 'five-star-highlight');

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
// src/components/MapPanel.tsx

// Add book cover images
node.append('image')
    .attr('xlink:href', d => {
    console.log(`Generating cover URL for "${d.book.title}":`, {
        book_id: d.book._id,
        cover_id: d.book.cover_id,
        status: d.status,
        is_recommendation: d.status === 'recommended'
    });
    
    if (d.book.cover_id) {
        const coverId = String(d.book.cover_id);
        console.log(`Cover ID found: ${coverId}`);
        
        if (/^\d+$/.test(coverId)) {
        const url = `https://covers.openlibrary.org/b/id/${coverId}-M.jpg`;
        console.log(`Using numeric cover ID URL: ${url}`);
        return url;
        }
        
        if (coverId.startsWith('OL') && coverId.includes('M')) {
        const url = `https://covers.openlibrary.org/b/olid/${coverId.replace('M', '')}-M.jpg`;
        console.log(`Using OL edition key URL: ${url}`);
        return url;
        }
    }
    
    if (d.book._id && d.book._id.startsWith('OL')) {
        const url = `https://covers.openlibrary.org/b/olid/${d.book._id}-M.jpg`;
        console.log(`Using book ID as OL URL: ${url}`);
        return url;
    }
    
    console.log(`No cover found, using placeholder for "${d.book.title}"`);
    return '/placeholder-cover.jpg';
    })
    .attr('x', d => -d.radius)
    .attr('y', d => -d.radius)
    .attr('width', d => d.radius * 2)
    .attr('height', d => d.radius * 2)
    .attr('clip-path', d => `url(#clip-${d.id})`)
    .attr('preserveAspectRatio', 'xMidYMid slice')
    .on('error', function(event, d) {
        const current = d3.select(this).attr('xlink:href');
        console.log(`Image load error for "${d.book.title}":`, {
            attempted_url: current,
            book_data: d.book
        });
        
        if (current !== '/placeholder-cover.jpg') {
            d3.select(this).attr('xlink:href', '/placeholder-cover.jpg');
        }
    })
    .on('load', function(event, d) {
        console.log(`Image loaded successfully for "${d.book.title}"`);
    });

    
    // Add rating indicator for rated books
    node.filter(d => typeof d.rating === 'number' && d.rating > 0)
      .append('g')
      .attr('class', 'rating')
      .attr('transform', d => `translate(0, ${d.radius + 16})`)
      .each(function(d) {
        if (!d.rating) return;
        const rating = Math.round(d.rating);
        const g = d3.select(this);
        const starSize = 6;
        const totalWidth = rating * starSize * 2;
        
        for (let i = 0; i < rating; i++) {
          g.append('text')
            .attr('x', i * starSize * 2 - totalWidth/2 + starSize)
            .attr('y', 0)
            .attr('text-anchor', 'middle')
            .attr('fill', '#FFD700') // Gold stars
            .attr('font-size', starSize * 2)
            .text('★');
        }
      });
    
    // Add small badge for recommended books
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
      .text(d => {
        let title = `${d.book.title} by ${d.book.author_names?.[0] || 'Unknown'}`;
        if (d.rating) title += ` (${d.rating}★)`;
        return title;
      });

    function ticked() {
      // Update node positions
      node.attr('transform', d => `translate(${d.x},${d.y})`);
      
      // Update connection lines
      connectionLines
        .attr('x1', d => {
          const source = nodes.find(n => n.id === d.source);
          return source?.x || 0;
        })
        .attr('y1', d => {
          const source = nodes.find(n => n.id === d.source);
          return source?.y || 0;
        })
        .attr('x2', d => {
          const target = nodes.find(n => n.id === d.target);
          return target?.x || 0;
        })
        .attr('y2', d => {
          const target = nodes.find(n => n.id === d.target);
          return target?.y || 0;
        });

      // Make recommendations gently pulse
      d3.selectAll('.recommendation-glow')
        .attr('stroke-opacity', 0.3 + 0.3 * Math.sin(Date.now() / 1000));
      
      // Make 5-star books gently pulse with gold glow
      d3.selectAll('.five-star-highlight')
        .attr('stroke-opacity', 0.7 + 0.3 * Math.sin(Date.now() / 800));
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
  }, [books, readingStatus, recommendations, similarityData, ratings, dimensions, clusterMethod]);

  return (
    <div className="w-full h-full relative">
      <div className="mb-4 flex justify-between items-center">
        <div className="flex space-x-2">
          <button
            className={`px-3 py-1 rounded text-sm ${clusterMethod === 'similarity' ? 'bg-indigo-600' : 'bg-gray-700'}`}
            onClick={() => setClusterMethod('similarity')}
          >
            By Similarity
          </button>
          <button
            className={`px-3 py-1 rounded text-sm ${clusterMethod === 'status' ? 'bg-indigo-600' : 'bg-gray-700'}`}
            onClick={() => setClusterMethod('status')}
          >
            By Status
          </button>
        </div>
        <div className="flex items-center space-x-4 text-sm">
          <div className="flex items-center">
            <span className="w-3 h-3 inline-block rounded-full mr-1" style={{backgroundColor: '#60A5FA'}}></span>
            <span>Reading</span>
          </div>
          <div className="flex items-center">
            <span className="w-3 h-3 inline-block rounded-full mr-1" style={{backgroundColor: '#6EE7B7'}}></span>
            <span>To Read</span>
          </div>
          <div className="flex items-center">
            <span className="w-3 h-3 inline-block rounded-full mr-1" style={{backgroundColor: '#F87171'}}></span>
            <span>Finished</span>
          </div>
          <div className="flex items-center">
            <span className="w-3 h-3 inline-block rounded-full mr-1" style={{backgroundColor: '#C084FC'}}></span>
            <span>Recommended</span>
          </div>
          <div className="flex items-center">
            <span className="w-3 h-3 inline-block border-2 border-yellow-400 rounded-full mr-1"></span>
            <span>5★ Books</span>
          </div>
        </div>
      </div>
      
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
            
            {ratings[selectedBook._id] && (
              <div className="flex mb-2">
                {Array.from({length: 5}).map((_, i) => (
                  <span 
                    key={i} 
                    className={`text-xl ${i < ratings[selectedBook._id] ? 'text-yellow-400' : 'text-gray-600'}`}
                  >
                    ★
                  </span>
                ))}
              </div>
            )}
            
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

export default BookClusterMap;
