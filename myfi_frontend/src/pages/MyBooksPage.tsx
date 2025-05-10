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
    
    // Process recommendations based on 5-star books
    const highlyRatedBookIds = Object.entries(ratings)
        .filter(([_, rating]) => rating >= 5)
        .map(([bookId]) => bookId);
    
    // Create a map to track which recommendations come from which source books
    const recommendationSources: Record<string, string[]> = {};
    
    // Add recommendations if they don't already exist in user books
    recommendations.forEach(rec => {
      if (!allBooks.some(book => book._id === rec._id)) {
        // Set source book information from 5-star book that led to this recommendation
        // Find which 5-star books this recommendation is connected to
        const sourcesForRec = highlyRatedBookIds.filter(bookId => 
          similarityData[bookId]?.[rec._id] > 0.5 // Threshold for similarity
        );
        
        if (sourcesForRec.length > 0) {
          recommendationSources[rec._id] = sourcesForRec;
          
          // Add connections to visualization
          sourcesForRec.forEach(sourceId => {
            const similarityScore = similarityData[sourceId][rec._id] || 0;
            connections.push({
              source: sourceId,
              target: rec._id,
              strength: similarityScore,
              type: 'recommendation'
            });
          });
          
          allBooks.push(rec);
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
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(dimensions.width / 2, dimensions.height / 2))
      .force('collision', d3.forceCollide().radius(d => (d as BookNode).radius + 10))
      .on('tick', ticked);

    // Define forces based on selected clustering method
    if (clusterMethod === 'status') {
      // Cluster by reading status
      simulation
        .force('x', d3.forceX<BookNode>().strength(0.1).x(d => {
          switch(d.status) {
            case 'reading': return dimensions.width * 0.25;
            case 'to-read': return dimensions.width * 0.75;
            case 'finished': return dimensions.width * 0.25;
            case 'recommended': return dimensions.width * 0.75;
            default: return dimensions.width * 0.5;
          }
        }))
        .force('y', d3.forceY<BookNode>().strength(0.1).y(d => {
          switch(d.status) {
            case 'reading': return dimensions.height * 0.75;
            case 'to-read': return dimensions.height * 0.75;
            case 'finished': return dimensions.height * 0.25;
            case 'recommended': return dimensions.height * 0.25;
            default: return dimensions.height * 0.5;
          }
        }));
    } else if (clusterMethod === 'similarity') {
      // Position books by similarity - similar books cluster together
      // Use multidimensional scaling approach
      
      // Add forces based on book connections
      const linkForce = d3.forceLink<BookNode, BookConnection>()
        .id(d => d.id)
        .links(connections)
        .distance(d => 200 * (1 - d.strength)) // Similar books are closer
        .strength(d => d.strength * 0.5);
      
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
        .force('x', d3.forceX<BookNode>().strength(0.02).x(d => {
          // Very weak status-based clustering
          switch(d.status) {
            case 'reading': return dimensions.width * 0.4;
            case 'to-read': return dimensions.width * 0.6;
            case 'finished': return dimensions.width * 0.4;
            case 'recommended': return dimensions.width * 0.6;
            default: return dimensions.width * 0.5;
          }
        }))
        .force('y', d3.forceY<BookNode>().strength(0.02).y(d => {
          // Very weak status-based clustering
          switch(d.status) {
            case 'reading': return dimensions.height * 0.6;
            case 'to-read': return dimensions.height * 0.6;
            case 'finished': return dimensions.height * 0.4;
            case 'recommended': return dimensions.height * 0.4;
            default: return dimensions.height * 0.5;
          }
        }));
    } else if (clusterMethod === 'genre') {
      // Placeholder for genre-based clustering
      // You would need to extract genres from your book data
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
    node.filter(d => d.rating && d.rating >= 5)
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
    
    // Add rating indicator for rated books
    node.filter(d => d.rating && d.rating > 0)
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

function MyBooksPage() {
  const { isAuthenticated } = useAuth();
  const { readingList, currentlyReading, finishedBooks, isInitialLoading } = useUserBooks();
  const navigate = useNavigate();
  const [books, setBooks] = useState<Book[]>([]);
  const [recommendations, setRecommendations] = useState<Book[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [readingStatus, setReadingStatus] = useState<Record<string, 'reading' | 'to-read' | 'finished'>>({});
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [similarityData, setSimilarityData] = useState<Record<string, Record<string, number>>>({});
  
  // Fetch books and user data
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
  
  // Fetch book ratings
  useEffect(() => {
    const fetchRatings = async () => {
      try {
        // In a real app, fetch from your API
        // For now, we'll simulate with random ratings for finished books
        const ratingsMap: Record<string, number> = {};
        
        finishedBooks.forEach(item => {
          // Generate rating 1-5, with bias toward higher ratings for finished books
          const rating = Math.max(3, Math.round(Math.random() * 2 + 3)); // 3-5 star ratings
          ratingsMap[item.bookId] = rating;
        });
        
        setRatings(ratingsMap);
      } catch (error) {
        console.error('Failed to fetch ratings:', error);
      }
    };

    if (finishedBooks.length > 0) {
      fetchRatings();
    }
  }, [finishedBooks]);
  
  // Fetch similarity data and recommendations
  useEffect(() => {
    const fetchSimilarityData = async () => {
      try {
        // In a real app, fetch from your API
        // For demonstration, we'll simulate similarity data
        const similarityMap: Record<string, Record<string, number>> = {};
        
        const allBookIds = books.map(book => book._id);
        
        // Create clusters of similar books
        const bookClusters: string[][] = [];
        let remainingBooks = [...allBookIds];
        
        // Create 10-15 clusters of books
        while (remainingBooks.length > 0) {
          const clusterSize = Math.min(
            Math.floor(Math.random() * 5) + 2, // 2-6 books per cluster
            remainingBooks.length
          );
          
          const cluster = remainingBooks.slice(0, clusterSize);
          bookClusters.push(cluster);
          remainingBooks = remainingBooks.slice(clusterSize);
        }
        
        // Generate similarity scores within clusters
        bookClusters.forEach(cluster => {
          for (let i = 0; i < cluster.length; i++) {
            const bookId1 = cluster[i];
            if (!similarityMap[bookId1]) {
              similarityMap[bookId1] = {};
            }
            
            for (let j = 0; j < cluster.length; j++) {
              if (i !== j) {
                const bookId2 = cluster[j];
                // Books in same cluster have high similarity (0.7-0.95)
                similarityMap[bookId1][bookId2] = 0.7 + Math.random() * 0.25;
              }
            }
          }
        });
        
        // Add some cross-cluster similarities (lower scores)
        for (let i = 0; i < 20; i++) { // Add some random connections
          const cluster1 = bookClusters[Math.floor(Math.random() * bookClusters.length)];
          const cluster2 = bookClusters[Math.floor(Math.random() * bookClusters.length)];
          
          if (cluster1 !== cluster2 && cluster1.length > 0 && cluster2.length > 0) {
            const book1 = cluster1[Math.floor(Math.random() * cluster1.length)];
            const book2 = cluster2[Math.floor(Math.random() * cluster2.length)];
            
            if (!similarityMap[book1]) similarityMap[book1] = {};
            if (!similarityMap[book2]) similarityMap[book2] = {};
            
            // Lower similarity for cross-cluster (0.3-0.6)
            const similarity = 0.3 + Math.random() * 0.3;
            similarityMap[book1][book2] = similarity;
            similarityMap[book2][book1] = similarity;
          }
        }
        
        setSimilarityData(similarityMap);
        
        // Generate recommendations based on 5-star books and similarity
        const userBookIds = new Set([
          ...readingList,
          ...currentlyReading,
          ...finishedBooks.map(fb => fb.bookId)
        ]);
        
        const highlyRatedBooks = Object.entries(ratings)
          .filter(([_, rating]) => rating >= 5)
          .map(([bookId]) => bookId);
          
        // Get recommendations from similarity data
        const recommendationCandidates = new Set<string>();
        
        highlyRatedBooks.forEach(bookId => {
          if (similarityMap[bookId]) {
            Object.entries(similarityMap[bookId])
              .filter(([recId, score]) => score > 0.7 && !userBookIds.has(recId))
              .forEach(([recId]) => recommendationCandidates.add(recId));
          }
        });
        
        // Convert to book objects
        const recBooks = books.filter(book => 
          recommendationCandidates.has(book._id)
        );
        
        setRecommendations(recBooks);
        
      } catch (error) {
        console.error('Failed to fetch similarity data:', error);
      }
    };

    if (!isLoading && books.length > 0) {
      fetchSimilarityData();
    }
  }, [books, readingList, currentlyReading, finishedBooks, ratings, isLoading]);
  
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
          similarityData={similarityData}
          ratings={ratings}
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
          <li>Books are colored by their status (blue = reading, green = to read, red = finished, purple = recommended)</li>
          <li>Books with gold borders are rated 5 stars</li>
          <li>Connected books by purple dotted lines are similar to each other</li>
          <li>Recommendations appear based on your highly-rated books</li>
          <li>Click a book to see details and rating</li>
          <li>Switch between clustering methods using the buttons above</li>
        </ul>
      </div>
    </div>
  );
}

export default MyBooksPage;
