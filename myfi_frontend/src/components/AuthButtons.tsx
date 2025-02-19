// components/AuthButtons.tsx
import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import LogInPanel from './LogInPanel';
import RegisterPanel from './RegisterPanel';

export default function AuthButtons() {
  const [LogInPanelOpen, setLogInPanelOpen] = useState(false);
  const [RegisterPanelOpen, setRegisterPanelOpen] = useState(false);
  const { user, logout } = useAuth();

  const switchToRegister = () => {
    setLogInPanelOpen(false);
    setRegisterPanelOpen(true);
  };

  const switchToLogin = () => {
    setRegisterPanelOpen(false);
    setLogInPanelOpen(true);
  };

  if (user) {
    return (
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center">
            <span className="text-white text-sm font-medium">
              {user.email[0].toUpperCase()}
            </span>
          </div>
          <span className="text-gray-200 text-sm">{user.email}</span>
        </div>
        <button
          onClick={logout}
          className="px-4 py-2 text-sm font-medium text-white bg-transparent 
                   border border-gray-700 rounded-md hover:bg-gray-800 
                   transition-all duration-200 ease-in-out"
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center gap-4">
        <button
          onClick={() => setLogInPanelOpen(true)}
          className="px-4 py-2 text-sm font-medium text-white 
                   bg-indigo-600 rounded-md hover:bg-indigo-500 
                   transform hover:scale-105 transition-all duration-200 
                   ease-in-out shadow-lg hover:shadow-indigo-500/25"
        >
          Sign in
        </button>
        <button
          onClick={() => setRegisterPanelOpen(true)}
          className="px-4 py-2 text-sm font-medium text-white 
                   bg-indigo-600 rounded-md hover:bg-indigo-500 
                   transform hover:scale-105 transition-all duration-200 
                   ease-in-out shadow-lg hover:shadow-indigo-500/25"
        >
          Sign up
        </button>
      </div>

      <LogInPanel
        isOpen={LogInPanelOpen}
        onClose={() => setLogInPanelOpen(false)}
        onSwitchToSignup={switchToRegister}
      />
      <RegisterPanel
        isOpen={RegisterPanelOpen}
        onClose={() => setRegisterPanelOpen(false)}
        onSwitchToLogin={switchToLogin}
      />
    </>
  );
}
