const mongoose = require('mongoose');
const axios = require('axios');
const rateLimit = require('axios-rate-limit');
require('dotenv').config();

const Book = require('../models/Book');

// Get command line arguments
const args = process.argv.slice(2);
const pageStart = parseInt(args[0]) || 1;
const pageNum = parseInt(args[1]) || 1;

// MongoDB connection string
const uri = "mongodb+srv://jovel:423275077127@myfi.ezmdt.mongodb.net/?retryWrites=true&w=majority&appName=myfi";

// Create rate-limited axios instance (30 requests per minute = 1 request per 2 seconds)
const http = rateLimit(axios.create(), { maxRequests: 1, perMilliseconds: 2000 });

async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchBooks() {
    try {
        // Connect to MongoDB
        await mongoose.connect(uri);
        console.log("Connected to MongoDB");

        console.log(`Starting fetch from page ${pageStart} for ${pageNum} pages...`);
        
        for (let currentPage = pageStart; currentPage < pageStart + pageNum; currentPage++) {
            console.log(`Fetching page ${currentPage}...`);
            
            const response = await http.get(
                `https://openlibrary.org/search.json?subject=Science+fiction&sort=rating&limit=100&page=${currentPage}`
            );

            const books = response.data.docs;
            console.log(`Found ${books.length} books on page ${currentPage}`);
            
            // Process and save each book
            for (const bookData of books) {
                const bookDocument = {
                    title: bookData.title,
                    author_names: bookData.author_name || [],
                    author_keys: bookData.author_key || [],
                    cover_edition_key: bookData.cover_edition_key,
                    cover_id: bookData.cover_i,
                    first_publish_year: bookData.first_publish_year,
                    languages: bookData.language || [],
                    open_library_key: bookData.key,
                    edition_count: bookData.edition_count,
                };

                try {
                    // Check if book already exists
                    const existingBook = await Book.findOne({ open_library_key: bookData.key });
                    
                    if (existingBook) {
                        // Update existing record
                        await Book.findByIdAndUpdate(existingBook._id, bookDocument);
                        console.log(`Updated book: ${bookData.title}`);
                    } else {
                        // Create new record
                        const newBook = new Book(bookDocument);
                        await newBook.save();
                        console.log(`Saved new book: ${bookData.title}`);
                    }
                } catch (err) {
                    console.error(`Error processing book ${bookData.title}:`, err);
                    continue;
                }
            }

            console.log(`Completed page ${currentPage}`);
            
            // Add additional delay between pages
            if (currentPage < pageStart + pageNum - 1) {
                console.log('Waiting before next page...');
                await delay(1000);
            }
        }

        console.log('Book import completed successfully');
    } catch (error) {
        console.error('Error:', error);
    } finally {
        // Close MongoDB connection
        await mongoose.connection.close();
        console.log('MongoDB connection closed');
        process.exit(0);
    }
}

// Run the script
fetchBooks();
