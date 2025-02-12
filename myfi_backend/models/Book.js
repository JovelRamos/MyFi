const mongoose = require('mongoose');

const BookSchema = new mongoose.Schema({
    _id: { type: String }, // This will be your OpenLibrary key (/works/...)
    title: String,
    description: String,
    author_names: [String],
    author_keys: [String],
    cover_edition_key: String,
    cover_id: Number,
    first_publish_year: Number,
    languages: [String],
    edition_count: Number,
    ratings_average: Number,
    ratings_count: Number
}, { _id: false }); // This tells Mongoose not to auto-generate an _id

module.exports = mongoose.model('Book', BookSchema);