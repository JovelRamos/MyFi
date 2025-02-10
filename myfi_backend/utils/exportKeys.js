const mongoose = require('mongoose');
const fs = require('fs');
const Book = require('../models/Book');  // adjust path as needed

const uri = "mongodb+srv://jovel:423275077127@myfi.ezmdt.mongodb.net/?retryWrites=true&w=majority";

async function exportOpenLibraryKeysAndDescriptions() {
    try {
        // Connect to MongoDB
        await mongoose.connect(uri);
        console.log("Connected to MongoDB");

        // Fetch all books with their keys and descriptions
        const books = await Book.find({}, 'open_library_key description');
        
        // Convert to array of objects containing key and description
        const booksArray = books.map(book => ({
            key: book.open_library_key,
            description: book.description || null
        }));

        // Write to file
        fs.writeFileSync('open_library_data.json', JSON.stringify(booksArray, null, 2));
        
        console.log("Data exported successfully to open_library_data.json");
        
        // Create a readable format for quick review
        const readableContent = booksArray
            .map(book => `Title: ${book.title}\nKey: ${book.key}\nDescription: ${book.description}\n\n`)
            .join('---\n\n');
        
        fs.writeFileSync('open_library_data_readable.txt', readableContent);
        
        console.log("Readable format exported to open_library_data_readable.txt");

        // Disconnect from MongoDB
        await mongoose.disconnect();
    } catch (error) {
        console.error("Error:", error);
    }
}

exportOpenLibraryKeysAndDescriptions();
