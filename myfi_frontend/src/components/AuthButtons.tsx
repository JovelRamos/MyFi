// components/AuthButtons.tsx
import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import AuthPanel from './AuthPanel';

export default function AuthButtons() {
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const { user, logout } = useAuth();

  const openPanel = (mode: 'login' | 'signup') => {
    setAuthMode(mode);
    setIsPanelOpen(true);
  };

  if (user) {
    return (
      <div className="flex items-center gap-4">
        <span className="text-gray-700">{user.email}</span>
        <button
          onClick={logout}
          className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 transition-colors"
        >
          Logout
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center gap-4">
        <button
          onClick={() => openPanel('login')}
          className="px-4 py-2 text-sm font-medium text-indigo-600 hover:text-indigo-500 transition-colors"
        >
          Login
        </button>
        <button
          onClick={() => openPanel('signup')}
          className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 transition-colors"
        >
          Sign Up
        </button>
      </div>

      <AuthPanel
        isOpen={isPanelOpen}
        onClose={() => setIsPanelOpen(false)}
        initialMode={authMode}
      />
    </>
  );
}
