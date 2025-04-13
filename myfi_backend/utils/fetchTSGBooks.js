const axios = require('axios');
const rateLimit = require('axios-rate-limit');
const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

// Create more conservative rate-limited axios instance
const http = rateLimit(axios.create(), { maxRequests: 2, perMilliseconds: 1000 });

const Book = require('../models/Book');

// Add delay function to manually pause between requests
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function searchBookByTitle(title, author = '') {
    try {
        await delay(100 + Math.random() * 200);
        
        // Build search query with title and optionally author
        let query = encodeURIComponent(title);
        if (author) {
            query = `${query}+author:${encodeURIComponent(author)}`;
        }
        
        const response = await http.get(`https://openlibrary.org/search.json?q=${query}`);
        
        if (response.data.docs && response.data.docs.length > 0) {
            const firstResult = response.data.docs[0];
            const workKey = firstResult.key?.replace('/works/', '') || null;
            const coverId = firstResult.cover_i || null;
            
            return {
                found: true,
                workKey: workKey,
                coverId: coverId,
                title: firstResult.title,
                author: firstResult.author_name ? firstResult.author_name[0] : null
            };
        }
        
        return { found: false };
    } catch (error) {
        if (error.response && error.response.status === 429) {
            console.log("Rate limit hit during search, waiting 3 seconds before retrying...");
            await delay(3000);
            // Recursively retry the request
            return searchBookByTitle(title, author);
        }
        console.error(`Error searching for title "${title}":`, error.message);
        return { found: false, error: error.message };
    }
}

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
        
        return { coverId, coverEditionKey, workData: response.data };
    } catch (error) {
        if (error.response && error.response.status === 429) {
            console.log("Rate limit hit, waiting 3 seconds before retrying...");
            await delay(3000);
            // Recursively retry
            return fetchCoverDetails(workId);
        }
        console.error(`Error fetching cover details for work ${workId}:`, error.message);
        return { coverId: null, coverEditionKey: null, workData: null };
    }
}

async function readCsvFile() {
    const results = [];
    const csvFilePath = path.resolve(__dirname, './scifi_list_OL_final.csv');
    
    return new Promise((resolve, reject) => {
        fs.createReadStream(csvFilePath)
            .pipe(csv())
            .on('data', (data) => {
                // Log sample records to verify OL_ID is present
                if (results.length < 3) {
                    console.log('Sample CSV record:', data);
                    console.log('OL_ID value:', data.OL_ID);
                    console.log('Keys in record:', Object.keys(data));
                }
                results.push(data);
            })
            .on('end', () => resolve(results))
            .on('error', (error) => reject(error));
    });
}


async function updateCsvFile(data) {
    const csvFilePath = path.resolve(__dirname, './scifi_list_OL_final.csv');
    
    // Get column headers from the first row
    const headers = Object.keys(data[0]).map(header => ({
        id: header,
        title: header
    }));
    
    const csvWriter = createCsvWriter({
        path: csvFilePath,  // Use the original file path
        header: headers
    });
    
    return csvWriter.writeRecords(data);
}

async function findCoverIdWithSearch(bookData, workId) {
    try {
        const title = bookData.Title || bookData.title;
        const author = bookData.Author || bookData.author;
        
        if (!title) {
            return null;
        }
        
        console.log(`Searching for cover ID for "${title}" by ${author || 'Unknown author'}`);
        
        const searchResult = await searchBookByTitle(title, author);
        
        if (!searchResult.found || !searchResult.coverId) {
            console.log(`No cover found in search for "${title}"`);
            return null;
        }
        
        console.log(`Found cover ID ${searchResult.coverId} for "${title}" via search`);
        
        // Update database with the found cover ID
        try {
            await Book.findByIdAndUpdate(workId, { cover_id: searchResult.coverId });
            console.log(`Updated book ${workId} with cover ID ${searchResult.coverId} from search`);
        } catch (dbError) {
            console.error(`Error updating database with cover ID for ${workId}:`, dbError.message);
        }
        
        return searchResult.coverId;
    } catch (error) {
        console.error(`Error searching for cover ID:`, error.message);
        return null;
    }
}

async function processMissingBook(bookData, errorLog) {
    try {
        const title = bookData.Title || bookData.title;
        const author = bookData.Author || bookData.author;
        
        if (!title) {
            errorLog.push({ 
                error: 'Missing both OL_key and title', 
                book: JSON.stringify(bookData) 
            });
            return null;
        }
        
        console.log(`Searching for title: "${title}" by ${author || 'Unknown author'}`);
        
        const searchResult = await searchBookByTitle(title, author);
        
        if (!searchResult.found) {
            errorLog.push({ 
                error: 'Title not found in search', 
                title: title, 
                author: author 
            });
            return null;
        }
        
        console.log(`Found match for "${title}": Work key: ${searchResult.workKey}, Cover ID: ${searchResult.coverId}`);
        
        // Update the book data with the found work key and cover ID
        bookData.OL_key = searchResult.workKey;
        
        // Extract just the work ID from the key (if needed)
        const workId = searchResult.workKey;
        
        // Now fetch full details for this work
        let description = null;
        let coverDetails = { 
            coverId: searchResult.coverId, // Use the cover ID from search
            coverEditionKey: null, 
            workData: null 
        };
        
        if (workId) {
            try {
                description = await fetchBookDescription(workId);
                
                // Even if we have a cover ID from search, still fetch work data for other properties
                const workDetails = await fetchCoverDetails(workId);
                coverDetails.coverEditionKey = workDetails.coverEditionKey;
                coverDetails.workData = workDetails.workData;
                
                // If we don't have a cover from search, but we found one in the work data, use that
                if (!coverDetails.coverId && workDetails.coverId) {
                    coverDetails.coverId = workDetails.coverId;
                }
                
            } catch (fetchError) {
                console.error(`Error fetching details for ${workId}:`, fetchError.message);
                errorLog.push({ 
                    error: `Failed to fetch details: ${fetchError.message}`, 
                    title: title, 
                    workId: workId 
                });
                // Still continue with the data we have
            }
        }
        
        // Create book document for database
        const bookDocument = {
            _id: workId,
            book_id: bookData.OL_ID || null,
            title: title,
            description: description,
            author_names: author ? [author] : [],
            cover_edition_key: coverDetails.coverEditionKey,
            cover_id: coverDetails.coverId,
            first_publish_year: bookData.first_publish_year || 
                (coverDetails.workData ? coverDetails.workData.first_publish_year : null),
            languages: ['eng'],
            edition_count: (coverDetails.workData ? coverDetails.workData.edition_count || 1 : 1),
            publishers: bookData.publishers || [],
            number_of_pages: bookData.number_of_pages || null,
            isbn: bookData['ISBN-13'] || bookData['ISBN-10'] || null
        };
        
        // Check if book already exists
        const existingBook = await Book.findOne({ _id: workId });
        
        if (existingBook) {
            await Book.findByIdAndUpdate(existingBook._id, bookDocument);
            console.log(`Updated book from search: ${bookDocument.title} (Cover ID: ${coverDetails.coverId || 'None'})`);
        } else {
            const newBook = new Book(bookDocument);
            await newBook.save();
            console.log(`Saved new book from search: ${bookDocument.title} (Cover ID: ${coverDetails.coverId || 'None'})`);
        }
        
        return bookData; // Return the updated book data for CSV update
    } catch (error) {
        console.error(`Error processing missing book:`, error.message);
        errorLog.push({ 
            error: `Processing error: ${error.message}`, 
            title: bookData.Title || bookData.title || 'Unknown' 
        });
        return null;
    }
}

async function fetchTopScifiBooks() {
    try {
        // Create arrays to collect all errors and fixed books
        const errorLog = [];
        const missingCoverLog = [];
        const missingKeyLog = [];
        const fixedBooks = [];
        const fixedCovers = [];
        
        // Read books from CSV file 
        const booksFromCsv = await readCsvFile();
        console.log(`Loaded ${booksFromCsv.length} books from CSV file`);
        
        let csvNeedsUpdate = false;
        
        // Process each book from CSV
        for (const bookData of booksFromCsv) {
            // Try different possible column names for flexibility
            const workId = bookData.OL_key || bookData['OL key'] || bookData['OL_key'];
            
            if (!workId) {
                const errorMsg = `Missing OL_key for book: ${bookData.Title || 'Unknown title'}`;
                console.log(`⚠️ ${errorMsg}`);
                
                missingKeyLog.push({
                    title: bookData.Title || 'Unknown title',
                    author: bookData.Author || 'Unknown author',
                    isbn: bookData['ISBN-13'] || bookData['ISBN-10'] || 'No ISBN'
                });
                
                // Try to find this book by title search
                const updatedBookData = await processMissingBook(bookData, errorLog);
                
                if (updatedBookData) {
                    csvNeedsUpdate = true;
                    fixedBooks.push({
                        original: `${bookData.Title || 'Unknown'} by ${bookData.Author || 'Unknown'}`,
                        newKey: updatedBookData.OL_key
                    });
                }
                
                continue;
            }
            
            try {
                // Add delay between processing each book
                await delay(400);
                
                // Fetch book data using Work ID directly
                const description = await fetchBookDescription(workId);
                
                // Fetch cover details and additional work data
                const { coverId, coverEditionKey, workData } = await fetchCoverDetails(workId);
                
                // Create book document base
                const bookDocument = {
                    _id: workId,
                    book_id: bookData.OL_ID || null,
                    title: bookData.Title || (workData ? workData.title : 'Unknown'),
                    description: description,
                    author_names: bookData.Author ? [bookData.Author] : [],
                    cover_edition_key: coverEditionKey,
                    cover_id: coverId,
                    first_publish_year: bookData.first_publish_year || (workData ? workData.first_publish_year : null),
                    languages: ['eng'],
                    edition_count: workData ? workData.edition_count || 1 : 1,
                    publishers: bookData.publishers || [],
                    number_of_pages: bookData.number_of_pages || null,
                    isbn: bookData['ISBN-13'] || bookData['ISBN-10'] || null
                };
                
                // If the book is missing a cover, try to find one via search
                if (!coverId) {
                    const errorMsg = `No cover found for book: ${bookData.Title || (workData ? workData.title : 'Unknown')}`;
                    console.log(`⚠️ ${errorMsg}`);
                    
                    // Try to find a cover ID using search
                    const searchCoverId = await findCoverIdWithSearch(bookData, workId);
                    
                    if (searchCoverId) {
                        bookDocument.cover_id = searchCoverId;
                        fixedCovers.push({
                            title: bookData.Title || (workData ? workData.title : 'Unknown'),
                            author: bookData.Author || 'Unknown author',
                            coverId: searchCoverId
                        });
                        console.log(`✅ Fixed missing cover for "${bookData.Title}" with cover ID: ${searchCoverId}`);
                    } else {
                        missingCoverLog.push({
                            workId: workId,
                            title: bookData.Title || (workData ? workData.title : 'Unknown'),
                            author: bookData.Author || 'Unknown author'
                        });
                    }
                }
                
                // Check if book already exists
                const existingBook = await Book.findOne({ _id: workId });
                
                if (existingBook) {
                    // Update existing record
                    await Book.findByIdAndUpdate(existingBook._id, bookDocument);
                    console.log(`Updated book: ${bookDocument.title} (Cover ID: ${bookDocument.cover_id || 'None'}) [Book ID: ${bookDocument.book_id || 'None'}]`);
                } else {
                    // Create new record
                    const newBook = new Book(bookDocument);
                    await newBook.save();
                    console.log(`Saved new book: ${bookDocument.title} (Cover ID: ${bookDocument.cover_id || 'None'}) [Book ID: ${bookDocument.book_id || 'None'}]`);
                }
            } catch (error) {
                const errorMsg = `Error processing work ID ${workId}: ${error.message}`;
                console.error(errorMsg);
                errorLog.push({
                    workId: workId,
                    title: bookData.Title || 'Unknown',
                    error: error.message
                });
                // Add a longer delay after errors
                await delay(1000);
                continue; // Skip to next book on error
            }
        }

        // Write updated CSV file if changes were made
        if (csvNeedsUpdate) {
            await updateCsvFile(booksFromCsv);
            console.log('CSV file has been updated in place with new OL_key values');
        }
        
        console.log('Book import completed successfully');
        
        // Print summary of all errors at the end
        console.log("\n=== IMPORT SUMMARY ===");
        console.log(`Total books processed: ${booksFromCsv.length}`);
        console.log(`Missing OL_keys initially: ${missingKeyLog.length}`);
        console.log(`Fixed missing keys: ${fixedBooks.length}`);
        console.log(`Missing covers initially: ${missingCoverLog.length + fixedCovers.length}`);
        console.log(`Fixed missing covers: ${fixedCovers.length}`);
        console.log(`Still missing covers: ${missingCoverLog.length}`);
        console.log(`Processing errors: ${errorLog.length}`);
        
        if (fixedBooks.length > 0) {
            console.log("\n=== FIXED MISSING OL_KEYS ===");
            fixedBooks.forEach((book, index) => {
                console.log(`${index + 1}. "${book.original}" → OL_key: ${book.newKey}`);
            });
        }
        
        if (fixedCovers.length > 0) {
            console.log("\n=== FIXED MISSING COVERS ===");
            fixedCovers.forEach((book, index) => {
                console.log(`${index + 1}. "${book.title}" by ${book.author} → Cover ID: ${book.coverId}`);
            });
        }
        
        if (missingKeyLog.length > fixedBooks.length) {
            console.log("\n=== BOOKS STILL MISSING OL_KEY ===");
            const stillMissing = missingKeyLog.length - fixedBooks.length;
            console.log(`${stillMissing} books could not be found via search`);
        }
        
        if (missingCoverLog.length > 0) {
            console.log("\n=== BOOKS STILL MISSING COVERS ===");
            missingCoverLog.forEach((book, index) => {
                console.log(`${index + 1}. "${book.title}" by ${book.author} (Work ID: ${book.workId})`);
            });
        }
        
        if (errorLog.length > 0) {
            console.log("\n=== PROCESSING ERRORS ===");
            errorLog.forEach((error, index) => {
                console.log(`${index + 1}. ${error.workId ? `Work ID ${error.workId}` : `"${error.title || 'Unknown'}"`}: ${error.error}`);
            });
        }
        
        return {
            totalBooks: booksFromCsv.length,
            missingKeys: missingKeyLog.length,
            fixedKeys: fixedBooks.length,
            initialMissingCovers: missingCoverLog.length + fixedCovers.length,
            fixedCovers: fixedCovers.length,
            stillMissingCovers: missingCoverLog.length,
            errors: errorLog.length
        };
    } catch (error) {
        console.error('Error in book import process:', error);
        throw error;
    }
}

module.exports = { fetchTopScifiBooks };
