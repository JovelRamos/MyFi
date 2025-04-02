//myfi_backend/utils/fetchBaseBooks.js
const axios = require('axios');
const rateLimit = require('axios-rate-limit');

// Create rate-limited axios instance (15 requests per second)
const http = rateLimit(axios.create(), { maxRequests: 15, perMilliseconds: 1000 });

const Book = require('../models/Book');

async function fetchBookDescription(workId) {
    try {
        const response = await http.get(`https://openlibrary.org/works/${workId}.json`);
        if (response.data.description) {
            // Handle both string and object descriptions
            const description = typeof response.data.description === 'object' 
                ? response.data.description.value 
                : response.data.description;
            
            // Split on '----------' and take only the first part
            return description.split('----------')[0].trim();
        }
        return null;
    } catch (error) {
        console.error(`Error fetching description for work ${workId}:`, error);
        return null;
    }
}

async function fetchTopScifiBooks() {
    try {
        // Fetch initial search results
        const response = await http.get(
            'https://openlibrary.org/search.json?subject=Science+fiction&sort=rating&limit=100'
        );

        const books = response.data.docs;
        
        // Process and save each book
        for (const bookData of books) {
            if (!bookData.language) {
                console.log(`⚠️ Missing language data for book: ${bookData.title}`);
                continue
            } else if (!bookData.language.includes('eng')) {
                console.log(`Skipping non-English book: ${bookData.title}`);
                continue;
            }

            // Extract work ID from the key
            const workId = bookData.key.split('/')[2];
            
            // Fetch description from works API
            const description = await fetchBookDescription(workId);

            const bookDocument = {
                _id: bookData.key,
                title: bookData.title,
                description: description,
                author_names: bookData.author_name || [],
                author_keys: bookData.author_key || [],
                cover_edition_key: bookData.cover_edition_key,
                cover_id: bookData.cover_i,
                first_publish_year: bookData.first_publish_year,
                languages: bookData.language || [],
                edition_count: bookData.edition_count,
            };

            // Check if book already exists
            const existingBook = await Book.findOne({ _id: bookData.key });
            
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
        }

        console.log('Book import completed successfully');
    } catch (error) {
        console.error('Error fetching books:', error);
        throw error;
    }
}

module.exports = { fetchTopScifiBooks };