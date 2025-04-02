# MyFi API Backend

A Node.js backend service for the MyFi science fiction book recommendation application.

## Overview

This backend service provides:
- REST API endpoints for book discovery
- User authentication and reading list management
- ML-powered sci-fi book recommendations
- Book data collection from Open Library API

## Technology Stack

- **Node.js & Express**: API framework
- **MongoDB**: Database storage via Mongoose
- **JWT**: Authentication token management
- **Python**: ML recommendation engine

## Architecture

### Core Components

1. **API Server**: Express.js REST API endpoints
2. **Data Import**: Utilities to fetch book data from Open Library
3. **Recommendation Engine**: Python-based ML system for personalized book recommendations
4. **Authentication System**: JWT-based user management

## Getting Started

### Prerequisites

- Node.js 14+
- MongoDB database
- Python 3.7+ with scikit-learn and other ML dependencies

### Environment Variables

Create a `.env` file with the following variables:

```
PORT=8000
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
JWT_EXPIRATION=24h
```

### Installation

```bash
# Install Node.js dependencies
npm install

# Install Python dependencies for the recommendation engine
pip install scikit-learn pymongo numpy scipy
```

### Running the Back End

```bash
npm start
```

## API Endpoints

### Books

- `GET /api/books` - Get all books, sorted by rating
- `GET /api/books/:bookId` - Get details for a specific book
- `GET /api/import-books` - Manually trigger book import process

### Recommendations

- `GET /api/recommendations/:bookId` - Get recommendations for a specific book
- `GET /api/recommendations_multiple?books=id1,id2,id3` - Get recommendations based on multiple books

### Authentication

- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login existing user
- `GET /api/auth/verify` - Verify authentication token

### User Reading Lists

- `POST /api/user/currently-reading` - Add/remove/finish book in "currently reading" list
- `POST /api/user/reading-list` - Add/remove book from reading list
- `POST /api/user/rate-book` - Rate a book

### Debug Endpoints

- `GET /api/debug/books` - View first few books in database
- `GET /api/debug/book/:bookId` - Check if a specific book exists
- `GET /api/debug/recommendations_multiple` - Test recommendation system

## Data Import Process

The system uses two data import utilities:

1. `fetchBaseBooks.js` - Fetches top-rated sci-fi books from Open Library
2. `fetchTSGBooks.js` - Imports book & user data from The Story Graph

Data is normalized and saved to MongoDB for quick access.

## Recommendation System

The recommendation engine uses two approaches:

1. **Content-Based**: Using TF-IDF vectorization of book descriptions
2. **Collaborative Filtering**: Provides item-based recommendations using user ratings

The system uses Python ML libraries for computation and communicates with the Node.js backend via child processes.

## Authentication

JWT-based authentication with token verification middleware to protect user-specific endpoints.

## Development

### Adding New Endpoints

Add new routes to `server.js` following the existing patterns for consistency.

### Extending the Recommendation System

The recommendation system can be enhanced by modifying the Python scripts in the `services` directory.