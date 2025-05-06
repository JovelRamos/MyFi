const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const { fetchTopScifiBooks } = require('./utils/fetchTSGBooks.js');
const Book = require('./models/Book');
const User = require('./models/User');
const auth = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 8000;
const uri = process.env.MONGODB_URI;

const { spawn } = require('child_process');

app.use(cors({
    origin: 'http://localhost:5173', // Your frontend URL
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  }));

app.use(express.json());

// Connect to MongoDB using Mongoose
async function connect(){
    try{
        await mongoose.connect(uri);
        console.log("Successful connection to MongoDB");
        
        // // Import books after successful connection
        // console.log("Starting book import...");
        // await fetchTopScifiBooks();
    } catch(error) {
        console.log(error);
    }
}

connect();

// Route to manually trigger book import
app.get('/api/import-books', async (req, res) => {
    try {
        await fetchTopScifiBooks();
        res.json({ message: 'Book import completed successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to import books' });
    }
});

// Endpoint for books
app.get('/api/books', async (req, res) => {
    try {
        const books = await Book.find().sort({ ratings_average: -1 });
        
        // If user is authenticated, include their data
        let userData = null;
        const token = req.header('Authorization')?.replace('Bearer ', '');
        
        if (token) {
            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                const user = await User.findById(decoded.userId);
                if (user) {
                    userData = {
                        currentlyReading: user.currentlyReading,
                        readingList: user.readingList
                    };
                }
            } catch (error) {
                // Token verification failed, but we'll still return books
                console.log('Token verification failed:', error);
            }
        }

        res.json({
            books,
            userData // Will be null if user is not authenticated
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch books' });
    }
});
app.get('/api/recommendations/:bookId', async (req, res) => {
  try {
      let { bookId } = req.params;
      // Get userId directly from query parameter instead of verifying a token
      let userId = req.query.userId;
      
      console.log('Processing recommendation request for book:', bookId, 'userId:', userId);
      
      // Check if the book exists in the database first
      const book = await Book.findById(bookId);
      if (!book) {
          console.log('Book not found in database:', bookId);
          return res.status(404).json({ error: 'Book not found in database' });
      }
      
      // Default to content-based filtering
      let useCollaborativeFiltering = false;
      let user = null;
      
      // Check if userId is provided and valid
      if (userId) {
          try {
              user = await User.findById(userId);
              if (user) {
                  console.log(`Found user for recommendations: ${user.email}`);
                  
                  // Check if finishedBooks array exists and contains at least 10 books with ratings
                  if (user.finishedBooks && Array.isArray(user.finishedBooks)) {
                      // Count books that have an actual rating (not null)
                      const ratedBooksCount = user.finishedBooks.filter(book => 
                          book.rating !== null && book.rating !== undefined
                      ).length;
                      
                      console.log(`User has ${ratedBooksCount} rated books (need 10+ for collaborative filtering)`);
                      
                      if (ratedBooksCount >= 10) {
                          useCollaborativeFiltering = true;
                          console.log(`Using collaborative filtering`);
                      } else {
                          console.log(`Not enough ratings, using content-based filtering`);
                      }
                  } else {
                      console.log('User has no finished books or not in expected format');
                  }
              } else {
                  console.log(`No user found with ID: ${userId}`);
              }
          } catch (error) {
              console.log(`Error finding user: ${error.message}`);
              // Continue with content-based filtering
          }
      } else {
          console.log('No userId provided, using content-based filtering');
      }
      
      // Choose which recommender to use
      console.log(`Collaborative filtering: ${useCollaborativeFiltering ? 'Yes' : 'No'}, User ID: ${userId || 'None'}`);
      
      const pythonScript = useCollaborativeFiltering 
          ? 'services/item_collaborative_filtering.py'
          : 'services/recommendation_service.py';

      // Prepare arguments based on filtering type
      let args = [];
      if (useCollaborativeFiltering) {
          // Pass user ID for collaborative filtering
          args.push(userId.toString());
      } else {
          // Pass book ID for content-based
          args.push(bookId);
      }

      console.log(`Using recommendation script: ${pythonScript} with args: ${args}`);

      // Spawn Python process with appropriate arguments
      const python = spawn('python', [pythonScript, ...args]);  
      
      let dataString = '';
      let errorString = '';

      // Collect data from script
      python.stdout.on('data', function (data) {
          dataString += data.toString();
          console.log(`Python stdout: received data chunk`);
      });

      // Handle errors
      python.stderr.on('data', (data) => {
          errorString += data.toString();
          console.error(`Python stderr: ${data}`);
      });

      python.on('close', async (code) => {
          if (code !== 0) {
              console.error(`Python process failed with code ${code}`);
              console.error(`Error output: ${errorString}`);
              return res.status(500).json({ 
                  error: 'Failed to get recommendations',
                  details: errorString
              });
          }

          console.log(`Python process completed successfully with code ${code}`);
          
          try {
              console.log(`Attempting to parse recommendation data...`);
              const recommendations = JSON.parse(dataString.trim());
              console.log(`Successfully parsed recommendations: ${recommendations.length} items found`);
              
             // Update user's recommendations if user exists
if (user) {
  console.log(`Processing recommendations for user ID: ${user._id}`);
  
  // Extract book IDs from recommendations
  const bookIds = recommendations
      .filter(book => book.id && typeof book.id === 'string')
      .map(book => book.id);
  
  console.log(`Extracted ${bookIds.length} book IDs from recommendations`);
  
  // Update user's recommendations
  if (bookIds.length > 0) {
      console.log(`User's current recommendations count: ${user.recommendations ? user.recommendations.length : 0}`);
      
      // Create recommendations array if it doesn't exist
      if (!user.recommendations) {
          user.recommendations = [];
          console.log('Created new recommendations array for user');
      }
      
      // REPLACE previous recommendations with new ones (instead of combining)
      const updatedRecommendations = bookIds;
      console.log(`New recommendations count: ${updatedRecommendations.length}`);
      
      try {
          console.log('Saving user recommendations to database...');
          // Use findByIdAndUpdate instead of save to avoid version conflicts
          await User.findByIdAndUpdate(
              user._id,
              { recommendations: updatedRecommendations },
              { new: true }
          );
          console.log(`Successfully saved user's recommendations to database (replacing previous recommendations)`);
      } catch (saveError) {
          console.error('Error saving user recommendations:', saveError);
      }
  } else {
      console.log('No valid book IDs found in recommendations, skipping update');
  }
} else {
  console.log('No authenticated user, skipping recommendations update');
}


              
              // Send response with recommendations
              res.json(recommendations);
              
          } catch (error) {
              console.error('Failed to process recommendations:', error);
              res.status(500).json({ 
                  error: 'Failed to process recommendations',
                  details: error.message
              });
          }
      });

  } catch (error) {
      console.error('Endpoint error:', error);
      res.status(500).json({ 
          error: 'Failed to get recommendations',
          details: error.message
      });
  }
});

app.get('/api/recommendations_multiple', async (req, res) => {
  try {
    let bookIds = req.query.books;
    let userId = req.query.userId;
    
    if (!bookIds) {
      return res.status(400).json({ error: 'No book IDs provided' });
    }

    console.log(`Processing recommendation request for books, userId: ${userId}`);
    
    // Split the comma-separated book IDs and clean them
    const bookIdArray = bookIds.split(',').map(id => {
      // Remove any existing '/works/' prefix and trim whitespace
      return id.trim().replace('/works/', '');
    });
    
    // Verify all books exist in the database
    for (const bookId of bookIdArray) {
      const book = await Book.findById(bookId);
      if (!book) {
        console.log(`Book not found in database: ${bookId}`);
        return res.status(404).json({ error: `Book not found in database: ${bookId}` });
      }
    }
    
    // Default to content-based filtering
    let useCollaborativeFiltering = false;
    let user = null;
    
    // Check if userId is provided and valid
    if (userId) {
      try {
        user = await User.findById(userId);
        
        if (user) {
          console.log(`Found user for recommendations: ${user.email}`);
          
          // Check if finishedBooks array exists and contains at least 10 books with ratings
          if (user.finishedBooks && Array.isArray(user.finishedBooks)) {
            // Count books that have an actual rating (not null)
            const ratedBooksCount = user.finishedBooks.filter(book => 
              book.rating !== null && book.rating !== undefined
            ).length;
            
            console.log(`User has ${ratedBooksCount} rated books (need 10+ for collaborative filtering)`);
            
            if (ratedBooksCount >= 10) {
              useCollaborativeFiltering = true;
              console.log(`Using collaborative filtering`);
            } else {
              console.log(`Not enough ratings, using content-based filtering`);
            }
          } else {
            console.log('User has no finished books or not in expected format');
          }
        } else {
          console.log(`No user found with ID: ${userId}`);
        }
      } catch (error) {
        console.log(`Error finding user: ${error.message}`);
        // Continue with content-based filtering
      }
    } else {
      console.log('No userId provided, using content-based filtering');
    }
    
    // Choose recommender based on rating count
    console.log(`Collaborative filtering: ${useCollaborativeFiltering ? 'Yes' : 'No'}, User ID: ${userId || 'None'}`);
    
    const pythonScript = useCollaborativeFiltering 
      ? 'services/item_collaborative_filtering.py'
      : 'services/recommendation_service.py';
    
    // Prepare arguments based on filtering type
    let args = [];
    if (useCollaborativeFiltering) {
      // Pass user ID for collaborative filtering
      args.push(userId.toString());
    } else {
      // Pass all book IDs for content-based
      args.push(...bookIdArray);
    }

    console.log(`Using recommendation script: ${pythonScript} with args: ${args}`);

    // Spawn Python process with appropriate arguments
    const python = spawn('python', [pythonScript, ...args]);
    
    let dataString = '';
    let errorString = '';

    python.stdout.on('data', function (data) {
      dataString += data.toString();
      console.log(`Python stdout: received data chunk`);
    });

    python.stderr.on('data', (data) => {
      errorString += data.toString();
      console.error(`Python stderr: ${data}`);
    });

    python.on('close', async (code) => {
      if (code !== 0) {
        console.error(`Python process failed with code ${code}`);
        console.error(`Error output: ${errorString}`);
        return res.status(500).json({ 
          error: 'Failed to get recommendations',
          details: errorString
        });
      }

      console.log(`Python process completed successfully with code ${code}`);
      
      try {
        console.log(`Attempting to parse recommendation data...`);
        const recommendations = JSON.parse(dataString.trim());
        console.log(`Successfully parsed recommendations: ${recommendations.length} items found`);
        
        // Update user's recommendations if user exists
        // Update user's recommendations if user exists
if (user) {
  console.log(`Processing recommendations for user ID: ${user._id}`);
  
  // Extract book IDs from recommendations
  const bookIds = recommendations
    .filter(book => book.id && typeof book.id === 'string')
    .map(book => book.id);
  
  console.log(`Extracted ${bookIds.length} book IDs from recommendations`);
  
  // Update user's recommendations
  if (bookIds.length > 0) {
    // Initialize recommendations array if it doesn't exist
    if (!user.recommendations) {
      user.recommendations = [];
      console.log('Created new recommendations array for user');
    }
    
    // REPLACE previous recommendations with new ones
    user.recommendations = bookIds;
    console.log(`New recommendations count: ${user.recommendations.length}`);
    
    try {
      console.log('Saving user recommendations to database...');
      await User.findByIdAndUpdate(
        user._id, 
        { recommendations: user.recommendations },
        { new: true }
      );
      console.log(`Successfully saved user's recommendations to database (replacing previous recommendations)`);
    } catch (saveError) {
      console.error('Error saving user recommendations:', saveError);
    }
  } else {
    console.log('No valid book IDs found in recommendations, skipping update');
  }
} else {
  console.log('No valid user found, skipping recommendations update');
}

        
        // Send response with recommendations
        res.json(recommendations);
        
      } catch (error) {
        console.error('Failed to process recommendations:', error);
        res.status(500).json({ 
          error: 'Failed to process recommendations',
          details: error.message
        });
      }
    });

  } catch (error) {
    console.error('Endpoint error:', error);
    res.status(500).json({ 
      error: 'Failed to get recommendations',
      details: error.message
    });
  }
});


// Register endpoint
app.post('/api/auth/register', async (req, res) => {
    try {
      const { email, password } = req.body;
  
      // Check if user already exists
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ error: 'Email already registered' });
      }
  
      // Create new user
      const user = new User({
        email,
        password,
        readingList: [],
        currentlyReading: [],
        recommendations: []
      });
  
      await user.save();
  
      // Generate token
      const token = jwt.sign(
        { userId: user._id },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRATION }
      );
  
      res.status(201).json({
        token,
        user: {
          id: user._id,
          email: user.email,
          readingList: user.readingList,
          currentlyReading: user.currentlyReading,
          recommendations: user.recommendations
        }
      });
    } catch (error) {
      res.status(500).json({ error: 'Registration failed' });
    }
});
  
// Login endpoint update
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRATION }
    );

    res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        readingList: user.readingList,
        currentlyReading: user.currentlyReading,
        finishedBooks: user.finishedBooks || [],
        recommendations: user.recommendations || []
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Login failed' });
  }
});

// Verify token endpoint
app.get('/api/auth/verify', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      id: user._id,
      email: user.email,
      readingList: user.readingList,
      currentlyReading: user.currentlyReading,
      finishedBooks: user.finishedBooks || [],
      recommendations: user.recommendations || []
    });
  } catch (error) {
    res.status(500).json({ error: 'Verification failed' });
  }
});

// Currently reading endpoint update
app.post('/api/user/currently-reading', auth, async (req, res) => {
  try {
    const { bookId, action } = req.body;
    console.log(`Processing request: ${action} book ${bookId}`);
    
    const user = await User.findById(req.userId);
    if (!user) {
      console.log(`User not found: ${req.userId}`);
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Ensure arrays exist
    if (!user.currentlyReading) user.currentlyReading = [];
    if (!user.finishedBooks) user.finishedBooks = [];
    
    // Log current state before changes
    console.log(`Before update - Currently reading: ${user.currentlyReading.length}, Finished: ${user.finishedBooks.length}`);
    
    if (!action || action === 'add') {
      // Add to currently reading if not already there
      if (!user.currentlyReading.includes(bookId)) {
        user.currentlyReading.push(bookId);
        console.log(`Added ${bookId} to currently reading`);
      } else {
        console.log(`${bookId} already in currently reading list`);
      }
    } else if (action === 'remove') {
      // Remove from currently reading
      console.log(`Removing ${bookId} from currently reading`);
      user.currentlyReading = user.currentlyReading.filter(id => id !== bookId);
    } else if (action === 'finish') {
      console.log(`Attempting to mark ${bookId} as finished`);
      
      // Check if book is in currently reading list
      const isCurrentlyReading = user.currentlyReading.includes(bookId);
      console.log(`Book is${isCurrentlyReading ? '' : ' not'} in currently reading list`);
      
      // Remove from currently reading
      user.currentlyReading = user.currentlyReading.filter(id => id !== bookId);
      
      // Check if book is already in finished books
      const existingIndex = user.finishedBooks.findIndex(item => item.bookId === bookId);
      
      if (existingIndex === -1) {
        // Add to finished books if not already there
        user.finishedBooks.push({ bookId, rating: null });
        console.log(`Added ${bookId} to finished books with null rating`);
      } else {
        console.log(`${bookId} already in finished books list`);
      }
    }
    
    // Log state after changes
    console.log(`After update - Currently reading: ${user.currentlyReading.length}, Finished: ${user.finishedBooks.length}`);
    
    await user.save();
    
    // Return the updated lists
    res.json({ 
      currentlyReading: user.currentlyReading,
      finishedBooks: user.finishedBooks
    });
  } catch (error) {
    console.error('Error updating reading status:', error);
    res.status(500).json({ error: 'Failed to update reading status', details: error.message });
  }
});

// Rate a book endpoint update
app.post('/api/user/rate-book', auth, async (req, res) => {
  try {
    const { bookId, rating } = req.body;
    const user = await User.findById(req.userId);
    
    if (!user.finishedBooks) user.finishedBooks = [];
    
    // Find if the book is already in finished books
    const bookIndex = user.finishedBooks.findIndex(item => item.bookId === bookId);
    
    if (bookIndex !== -1) {
      // Update existing book's rating
      user.finishedBooks[bookIndex].rating = rating;
    } else {
      // Add new finished book with rating
      user.finishedBooks.push({ bookId, rating });
    }
    
    await user.save();
    res.json({ finishedBooks: user.finishedBooks });
  } catch (error) {
    res.status(500).json({ error: 'Failed to rate book' });
  }
});

// Update the reading-list endpoint to add items at the beginning of the array
app.post('/api/user/reading-list', auth, async (req, res) => {
  try {
    const { bookId, action } = req.body;
    const user = await User.findById(req.userId);
    
    if (!action || action === 'add') {
      if (!user.readingList.includes(bookId)) {
        // Add to the beginning of the array (most recent first)
        user.readingList.unshift(bookId);
      }
    } else if (action === 'remove') {
      user.readingList = user.readingList.filter(id => id !== bookId);
    }
    
    await user.save();
    res.json({ readingList: user.readingList });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update reading list' });
  }
});

// Endpoint to get user's saved recommendations
app.get('/api/user/recommendations', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Check if user has recommendations
    if (!user.recommendations || user.recommendations.length === 0) {
      return res.json({ recommendations: [] });
    }
    
    // Find books that match the recommendation IDs
    const recommendedBooks = await Book.find({ 
      _id: { $in: user.recommendations } 
    });
    
    // Return formatted recommendations
    res.json({
      recommendations: recommendedBooks.map(book => ({
        id: book._id,
        title: book.title,
        author: book.author_names ? book.author_names[0] : 'Unknown Author',
        cover_url: book.cover_url || '',
        similarity_score: 1.0 // Default score since these are saved recommendations
      }))
    });
    
  } catch (error) {
    console.error('Error fetching user recommendations:', error);
    res.status(500).json({ error: 'Failed to fetch recommendations' });
  }
});


app.listen(PORT, () => console.log(`Server started on ${PORT}`));
