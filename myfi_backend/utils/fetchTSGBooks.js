const axios = require('axios');
const rateLimit = require('axios-rate-limit');
const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');

// Create more conservative rate-limited axios instance
const http = rateLimit(axios.create(), { maxRequests: 2, perMilliseconds: 1000 });

const Book = require('../models/Book');

// Add delay function to manually pause between requests
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchBookDescription(workId) {
    try {
        // Add small random delay before each request
        await delay(100 + Math.random() * 200);
        
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
        if (error.response && error.response.status === 429) {
            console.log("Rate limit hit, waiting 3 seconds before retrying...");
            await delay(3000);
            // Recursively retry the request
            return fetchBookDescription(workId);
        }
        console.error(`Error fetching description for work ${workId}:`, error.message);
        return null;
    }
}

async function fetchCoverDetails(workId) {
    try {
        await delay(100 + Math.random() * 200);
        
        const response = await http.get(`https://openlibrary.org/works/${workId}.json`);
        let coverId = null;
        let coverEditionKey = null;
        
        if (response.data.covers && response.data.covers.length > 0) {
            coverId = response.data.covers[0];
        }
        
        // Try to get a cover edition key if available
        if (response.data.cover_edition) {
            coverEditionKey = response.data.cover_edition.split('/').pop();
        }
        
        return { coverId, coverEditionKey };
    } catch (error) {
        if (error.response && error.response.status === 429) {
            console.log("Rate limit hit, waiting 3 seconds before retrying...");
            await delay(3000);
            // Recursively retry
            return fetchCoverDetails(workId);
        }
        console.error(`Error fetching cover details for work ${workId}:`, error.message);
        return { coverId: null, coverEditionKey: null };
    }
}

async function readCsvFile() {
    const results = [];
    const csvFilePath = path.resolve(__dirname, '../data/scifi_list_OL_final.csv');
    
    return new Promise((resolve, reject) => {
        fs.createReadStream(csvFilePath)
            .pipe(csv())
            .on('data', (data) => results.push(data))
            .on('end', () => resolve(results))
            .on('error', (error) => reject(error));
    });
}

async function fetchTopScifiBooks() {
    try {
        // Read books from CSV file
        const booksFromCsv = await readCsvFile();
        console.log(`Loaded ${booksFromCsv.length} books from CSV file`);
        
        // Process each book from CSV
        for (const bookData of booksFromCsv) {
            // Use ISBN-13 if available, otherwise use ISBN-10
            const isbn = bookData['ISBN-13'] || bookData['ISBN-10'];
            
            if (!isbn) {
                console.log(`⚠️ Missing ISBN for book: ${bookData.title || 'Unknown title'}`);
                continue;
            }
            
            try {
                // Add delay between processing each book
                await delay(400);
                
                // Fetch book data using ISBN
                let response;
                try {
                    response = await http.get(`https://openlibrary.org/isbn/${isbn}.json`);
                } catch (isbnError) {
                    if (isbnError.response && isbnError.response.status === 429) {
                        console.log("Rate limit hit, waiting 5 seconds before retrying...");
                        await delay(5000);
                        response = await http.get(`https://openlibrary.org/isbn/${isbn}.json`);
                    } else {
                        throw isbnError;
                    }
                }
                
                if (!response.data.works || response.data.works.length === 0) {
                    console.log(`⚠️ No work data found for ISBN ${isbn}`);
                    continue;
                }
                
                // Extract work ID
                const workKey = response.data.works[0].key;
                const workId = workKey.split('/')[2];
                
                // Fetch description from works API
                const description = await fetchBookDescription(workId);
                
                // Fetch cover details from works API
                const { coverId, coverEditionKey } = await fetchCoverDetails(workId);
                
                if (!coverId) {
                    console.log(`⚠️ No cover found for book: ${bookData.title || response.data.title}`);
                }
                
                // Create book document
                const bookDocument = {
                    _id: workKey,
                    title: bookData.title || response.data.title,
                    description: description,
                    author_names: bookData.author ? [bookData.author] : [],
                    cover_edition_key: coverEditionKey || response.data.key.split('/').pop(),
                    cover_id: coverId,
                    first_publish_year: bookData.first_publish_year || null,
                    languages: ['eng'], // Assuming English as default
                    edition_count: 1,
                    publishers: response.data.publishers || [],
                    number_of_pages: response.data.number_of_pages || null,
                    isbn: isbn
                };
                
                // Check if book already exists
                const existingBook = await Book.findOne({ _id: workKey });
                
                if (existingBook) {
                    // Update existing record
                    await Book.findByIdAndUpdate(existingBook._id, bookDocument);
                    console.log(`Updated book: ${bookDocument.title} (Cover ID: ${coverId || 'None'})`);
                } else {
                    // Create new record
                    const newBook = new Book(bookDocument);
                    await newBook.save();
                    console.log(`Saved new book: ${bookDocument.title} (Cover ID: ${coverId || 'None'})`);
                }
            } catch (error) {
                console.error(`Error processing ISBN ${isbn}:`, error.message);
                // Add a longer delay after errors
                await delay(1000);
                continue; // Skip to next book on error
            }
        }

        console.log('Book import completed successfully');
    } catch (error) {
        console.error('Error in book import process:', error);
        throw error;
    }
}

module.exports = { fetchTopScifiBooks };
