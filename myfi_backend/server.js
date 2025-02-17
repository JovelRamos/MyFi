const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();
const { fetchTopScifiBooks } = require('./utils/fetchBaseBooks');
const Book = require('./models/Book');

const app = express();
const PORT = 8000;

const uri = "mongodb+srv://jovel:423275077127@myfi.ezmdt.mongodb.net/?retryWrites=true&w=majority&appName=myfi"

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
        
        // Import books after successful connection
        console.log("Starting book import...");
        await fetchTopScifiBooks();
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
        
        // Test user data
        const userData = {
            currentlyReading: ['/works/OL82536W, /works/OL27482W'],  // Harry Potter & The Hobbit
            readingList: ['']    
        };

        res.json({
            books,
            userData
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch books' });
    }
});



app.get('/api/recommendations/:bookId', async (req, res) => {
    try {
        let { bookId } = req.params;
        
        // Add '/works/' prefix back if it's not present
        if (!bookId.startsWith('/works/')) {
            bookId = `/works/${bookId}`;
        }
        
        console.log('Processing recommendation request for book:', bookId);
        
        // Check if the book exists in the database first
        const book = await Book.findById(bookId);
        if (!book) {
            console.log('Book not found in database:', bookId);
            return res.status(404).json({ error: 'Book not found in database' });
        }
        
        // Spawn Python process
        const python = spawn('python', ['services/recommendation_service.py', bookId]);
        
        let dataString = '';
        let errorString = '';

        // Collect data from script
        python.stdout.on('data', function (data) {
            dataString += data.toString();
            console.log(`Python stdout: ${data}`);
        });

        // Handle errors
        python.stderr.on('data', (data) => {
            errorString += data.toString();
            console.error(`Python stderr: ${data}`);
        });

        python.on('close', (code) => {
            if (code !== 0) {
                console.error(`Python process failed with code ${code}`);
                console.error(`Error output: ${errorString}`);
                return res.status(500).json({ 
                    error: 'Failed to get recommendations',
                    details: errorString
                });
            }

            try {
                const recommendations = JSON.parse(dataString.trim());
                res.json(recommendations);
            } catch (error) {
                console.error('Failed to parse recommendations:', error);
                res.status(500).json({ 
                    error: 'Failed to parse recommendations',
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

// Test endpoint to check if a book exists
app.get('/api/books/:bookId', async (req, res) => {
    try {
        const { bookId } = req.params;
        const formattedId = bookId.startsWith('/works/') ? bookId : `/works/${bookId}`;
        
        console.log('Looking for book with ID:', formattedId);
        
        const book = await Book.findById(formattedId);
        
        if (!book) {
            return res.status(404).json({ 
                error: 'Book not found',
                searchedId: formattedId
            });
        }
        
        res.json(book);
    } catch (error) {
        res.status(500).json({ 
            error: 'Failed to fetch book',
            details: error.message,
            searchedId: req.params.bookId
        });
    }
});


// Debug endpoint to check first few books in database
app.get('/api/debug/books', async (req, res) => {
    try {
        const books = await Book.find().limit(5);
        res.json({
            count: await Book.countDocuments(),
            sampleBooks: books
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/debug/book/:bookId', async (req, res) => {
    try {
        const { bookId } = req.params;
        const formattedId = bookId.startsWith('/works/') ? bookId : `/works/${bookId}`;
        const book = await Book.findById(formattedId);
        res.json({
            exists: !!book,
            bookData: book,
            searchedId: formattedId
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Add this new endpoint for multiple book recommendations
app.get('/api/recommendations_multiple', async (req, res) => {
    try {
        let bookIds = req.query.books;
        
        if (!bookIds) {
            return res.status(400).json({ error: 'No book IDs provided' });
        }

        // Split the comma-separated book IDs and clean them
        const bookIdArray = bookIds.split(',').map(id => {
            // Remove any existing '/works/' prefix and trim whitespace
            id = id.trim().replace('/works/', '');
            // Add '/works/' prefix
            return `/works/${id}`;
        });
        
        console.log('Processing recommendation request for books:', bookIdArray);
        
        // Verify all books exist in the database
        for (const bookId of bookIdArray) {
            const book = await Book.findById(bookId);
            if (!book) {
                console.log('Book not found in database:', bookId);
                return res.status(404).json({ error: `Book not found in database: ${bookId}` });
            }
        }
        
        // Spawn Python process with multiple book IDs
        const python = spawn('python', [
            'services/recommendation_service.py',
            ...bookIdArray
        ]);
        
        let dataString = '';
        let errorString = '';

        python.stdout.on('data', function (data) {
            dataString += data.toString();
            console.log(`Python stdout: ${data}`);
        });

        python.stderr.on('data', (data) => {
            errorString += data.toString();
            console.error(`Python stderr: ${data}`);
        });

        python.on('close', (code) => {
            if (code !== 0) {
                console.error(`Python process failed with code ${code}`);
                console.error(`Error output: ${errorString}`);
                return res.status(500).json({ 
                    error: 'Failed to get recommendations',
                    details: errorString
                });
            }

            try {
                const recommendations = JSON.parse(dataString.trim());
                res.json(recommendations);
            } catch (error) {
                console.error('Failed to parse recommendations:', error);
                res.status(500).json({ 
                    error: 'Failed to parse recommendations',
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


// Add debug endpoint for testing multiple recommendations
app.get('/api/debug/recommendations_multiple', async (req, res) => {
    try {
        // Test with some sample book IDs
        const testBookIds = ['/works/OL82536W', '/works/OL27482W'];
        
        console.log('Testing multiple recommendations for:', testBookIds);
        
        // Spawn Python process with test book IDs
        const python = spawn('python', [
            'services/recommendation_service.py',
            ...testBookIds
        ]);
        
        let dataString = '';
        let errorString = '';

        python.stdout.on('data', (data) => {
            dataString += data.toString();
            console.log(`Debug Python stdout: ${data}`);
        });

        python.stderr.on('data', (data) => {
            errorString += data.toString();
            console.error(`Debug Python stderr: ${data}`);
        });

        python.on('close', (code) => {
            res.json({
                status: code === 0 ? 'success' : 'error',
                exitCode: code,
                stdout: dataString,
                stderr: errorString,
                testBookIds: testBookIds
            });
        });

    } catch (error) {
        res.status(500).json({ 
            error: 'Debug endpoint failed',
            details: error.message
        });
    }
});







app.listen(PORT, () => console.log(`Server started on ${PORT}`));
