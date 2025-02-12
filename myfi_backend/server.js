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

app.use(cors());
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
            currentlyReading: ['/works/OL27482W'],  // The Hobbit
            readingList: ['/works/OL82536W']        // Harry Potter
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
        const { bookId } = req.params;
        
        // Spawn Python process
        const python = spawn('python', ['recommendation_service.py', bookId]);
        
        let dataString = '';

        // Collect data from script
        python.stdout.on('data', function (data) {
            dataString += data.toString();
        });

        // Handle errors
        python.stderr.on('data', (data) => {
            console.error(`Error from Python script: ${data}`);
        });

        // Send recommendations when process completes
        python.on('close', (code) => {
            if (code !== 0) {
                return res.status(500).json({ error: 'Failed to get recommendations' });
            }
            try {
                const recommendations = JSON.parse(dataString);
                res.json(recommendations);
            } catch (error) {
                res.status(500).json({ error: 'Failed to parse recommendations' });
            }
        });

    } catch (error) {
        res.status(500).json({ error: 'Failed to get recommendations' });
    }
});

app.listen(PORT, () => console.log(`Server started on ${PORT}`));
