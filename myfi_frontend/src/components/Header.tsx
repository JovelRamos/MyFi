// components/Header.tsx
import { Link, NavLink } from 'react-router-dom';
import AuthButtons from './AuthButtons';

export default function Header() {
  return (
    <header className="bg-gray-800 border-b border-gray-700">
      <div className="max-w-[3840px] min-w-[1920px] mx-auto py-4 px-24 flex justify-between items-center">
        <div className="flex items-center space-x-8">
          <Link to="/" className="flex items-center space-x-4">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">
              MyFi Books
            </h1>
            <span className="px-2 py-1 text-xs font-medium bg-gray-700 rounded-full text-gray-300">
              Beta
            </span>
          </Link>
          
          {/* Navigation items */}
          <nav className="flex items-center space-x-8">
            <NavLink 
              to="/" 
              className={({ isActive }) => 
                isActive ? "text-white font-medium" : "text-gray-300 hover:text-white transition-colors"
              }
            >
              Home
            </NavLink>
            <NavLink 
              to="/my-books" 
              className={({ isActive }) => 
                isActive ? "text-white font-medium" : "text-gray-300 hover:text-white transition-colors"
              }
            >
              My Books
            </NavLink>
          </nav>
        </div>
        
        <AuthButtons />
      </div>
    </header>
  );
}
