const mongoose = require('mongoose');

const BookSchema = new mongoose.Schema({
    title: String,
    description: String,
    author_names: [String],
    author_keys: [String],
    cover_edition_key: String,
    cover_id: Number,
    first_publish_year: Number,
    languages: [String],
    open_library_key: String,
    edition_count: Number,
    ratings_average: Number,
    ratings_count: Number
});

module.exports = mongoose.model('Book', BookSchema);