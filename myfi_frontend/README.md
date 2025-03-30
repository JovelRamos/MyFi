# MyFi Frontend

MyFi Frontend is the client-side component for the MyFi science fiction book recommendation application. Built with React and TypeScript, the frontend provides an intuitive interface that connects users with personalized book recommendations, dynamic book segments, and seamless reading list management.

---

## Overview

MyFi Frontend offers:

- User authentication integrated with a backend JWT-based API.
- Dynamic book segments featuring ML-powered book recommendations.
- Interactive UI elements including animated hover panels and responsive book cards.
- Seamless integration with backend services for real-time updates on user reading lists and ratings.

---

## Technology Stack

- **React & TypeScript**: Component-based UI with strict type safety.
- **React Router**: Client-side routing and navigation.
- **Context API**: Global state management for authentication, user books, and hover interactions.
- **Fetch API**: Communication with the MyFi API backend.
- **Tailwind CSS** (or similar): Styling and responsive design for a modern interface.

---

## Architecture

### Core Components

1. **Authentication Module**  
   - Manages user login, logout, registration, and token verification.
   - Communicates with the backend using JWT-based token authentication.

2. **User Book Data Management**  
   - Handles reading lists, currently reading, finished books, and ratings.
   - Updates are fetched from or sent to the backend API.

3. **Book Segments & Recommendations**  
   - Dynamically generates book segments including "Currently Reading", "My List", and ML-powered "Recommended For You".
   - Supports curated segments like "Trending in Science Fiction" and period-specific collections.

4. **Interactive UI Components**  
   - Components like BookCard, BookPanel, and BookButtons provide interactive and animated book displays.
   - Hover events and transitions enhance the browsing experience.

5. **Routing & Layout**  
   - Uses React Router to enable a multi-page application experience.
   - A consistent MainLayout keeps the look and feel aligned with the MyFi branding and backend continuity.

---

## Project Structure

- **src/App.tsx**  
  The entry point of the application. Wraps the main routes with AuthProvider, UserBookProvider, and HoverProvider to enable global state management.

- **src/contexts/**  
  Contains:
  - **AuthContext.tsx** – Handles user authentication, token verification, and registration.
  - **UserBookContext.tsx** – Manages user reading list and book rating functionalities.
  - **HoverContext.tsx** – Provides hover state to display interactive book panels.

- **src/pages/**  
  - **HomePage.tsx** – Displays various dynamic book segments and recommendations.
  - **MyBooksPage.tsx** – Provides a dedicated page for user-specific reading lists and book history.

- **src/layouts/MainLayout.tsx**  
  A common layout structure that includes elements like headers, footers, and navigation, ensuring consistency across all pages.

- **src/components/**  
  Contains reusable components:
  - **BookCard.tsx** – Implements the book cover with hover interactions.
  - **BookPanel.tsx** – Reveals detailed book information and action buttons on hover.
  - **BookButtons.tsx** – Offers actions like adding books to reading lists or marking them as finished.

- **src/services/api.ts**  
  A centralized module to interact with the MyFi API backend for fetching and updating data.

- **src/types/**  
  Defines TypeScript types for book data, book segments, user data, etc., ensuring robust type-checking.

- **SegmentManager.ts**  
  Contains business logic to generate book segments by integrating ML recommendations and curated sorting.

---

## Getting Started

### Prerequisites

- Node.js 14+  
- npm or yarn package manager

Ensure the MyFi API Backend is running (typically on http://localhost:8000) so the frontend can authenticate users and retrieve book data.

### Environment Variables

The frontend does not require an extensive set of environment variables; however, ensure the API endpoint URLs in the context and service files point to your backend server.

Example configuration snippet (if using a .env file):

  REACT_APP_API_URL=http://localhost:8000/api

### Installation

1. Clone the repository:

   git clone [REPOSITORY_URL]
   cd myfi_frontend

2. Install dependencies:

   npm install

   or

   yarn install

---

## Running the Application

Start the development server:

   npm start

or

   yarn start

The application will be served at [http://localhost:3000](http://localhost:3000). Navigate through the app to view dynamic book segments, interact with book cards, and manage your reading list.

---

## Integration with MyFi API Backend

The frontend is designed to work seamlessly with the MyFi API Backend. Key API endpoints used include:

- **Authentication:**
  - POST /api/auth/register
  - POST /api/auth/login
  - GET /api/auth/verify

- **User Reading Lists:**
  - POST /api/user/currently-reading
  - POST /api/user/reading-list
  - POST /api/user/rate-book

- **Recommendations:**
  - GET /api/recommendations_multiple?books=id1,id2,...



