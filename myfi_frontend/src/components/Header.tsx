// components/Header.tsx
import AuthButtons from './AuthButtons';

export default function Header() {
  return (
    <header className="bg-(--panel-bg) border-b border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex-1 flex items-center">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-indigo-600 flex items-center justify-center">
              <span className="text-white font-bold">L</span>
            </div>
            <span className="text-white font-medium">Logo</span>
          </div>
        </div>
        
        {/* Navigation items could go here */}
        <nav className="hidden md:flex items-center space-x-8 mx-6">
          <a href="#" className="text-gray-300 hover:text-white transition-colors">
            Home
          </a>
          <a href="#" className="text-gray-300 hover:text-white transition-colors">
            Features
          </a>
          <a href="#" className="text-gray-300 hover:text-white transition-colors">
            About
          </a>
        </nav>
        
        <AuthButtons />
      </div>
    </header>
  );
}
