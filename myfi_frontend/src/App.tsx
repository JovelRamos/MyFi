// src/App.tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { UserBookProvider } from './contexts/UserBookContext';
import { HoverProvider } from './contexts/HoverContext'; 
import HomePage from './pages/HomePage';
import MyBooksPage from './pages/MyBooksPage';
import MainLayout from './layouts/MainLayout';
import 'react-toastify/dist/ReactToastify.css';

function App() {
  return (
    <AuthProvider>
      <UserBookProvider>
        <HoverProvider> {/* Add the HoverProvider here */}
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<MainLayout />}>
                <Route index element={<HomePage />} />
                <Route path="my-books" element={<MyBooksPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </HoverProvider>
      </UserBookProvider>
    </AuthProvider>
  );
}

export default App;
