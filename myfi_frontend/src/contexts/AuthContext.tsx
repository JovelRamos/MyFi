// AuthContext.tsx
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface User {
  id: string;
  email: string;
  readingList: string[];
  currentlyReading: string[];
  finishedBooks: string[];
  ratings?: {bookId: string, rating: number}[]; // Optional: add this too
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  register: (email: string, password: string) => Promise<void>;
  isAuthenticated: boolean;  // Add this
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      verifyToken(token);
    } else {
      setLoading(false);
    }
  }, []);

// AuthContext.tsx - update the login and register functions

const login = async (email: string, password: string) => {
  try {
    const response = await fetch('http://localhost:8000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Login failed');
    }

    const data = await response.json();
    localStorage.setItem('token', data.token);
    // Also store user data for easy access
    localStorage.setItem('userData', JSON.stringify(data.user));
    setUser(data.user);
    setIsAuthenticated(true);
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
};

const register = async (email: string, password: string) => {
  try {
    const response = await fetch('http://localhost:8000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Registration failed');
    }

    const data = await response.json();
    localStorage.setItem('token', data.token);
    // Also store user data for easy access
    localStorage.setItem('userData', JSON.stringify(data.user));
    setUser(data.user);
    setIsAuthenticated(true);
  } catch (error) {
    console.error('Registration error:', error);
    throw error;
  }
};

// Update logout to also clear userData
const logout = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('userData');
  setUser(null);
  setIsAuthenticated(false);
};

// Update verifyToken to also store user data
const verifyToken = async (token: string) => {
  try {
    const response = await fetch('http://localhost:8000/api/auth/verify', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (response.ok) {
      const userData = await response.json();
      setUser(userData);
      // Store user data for easy access
      localStorage.setItem('userData', JSON.stringify(userData));
      setIsAuthenticated(true);
    } else {
      throw new Error('Token verification failed');
    }
  } catch (error) {
    console.error('Token verification failed:', error);
    localStorage.removeItem('token');
    localStorage.removeItem('userData');
    setUser(null);
    setIsAuthenticated(false);
  } finally {
    setLoading(false);
  }
};


  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      login, 
      logout, 
      register, 
      isAuthenticated 
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
