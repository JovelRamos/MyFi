// components/LogInPanel.tsx
import { useState } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../contexts/AuthContext';

interface LogInPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSwitchToSignup: () => void;
}

export default function LogInPanel({ isOpen, onClose, onSwitchToSignup }: LogInPanelProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  
  const { login } = useAuth();

  const validateForm = () => {
    const newErrors: { email?: string; password?: string } = {};
    
    if (!email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'Please enter a valid email';
    }

    if (!password) {
      newErrors.password = 'Password is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    try {
      await login(email, password);
      onClose();
    } catch (error) {
      console.error('LogIn error:', error);
      // Handle error appropriately
    }
  };

  return (
    <div
      className={`fixed inset-y-0 right-0 w-full sm:w-[400px] bg-(--panel-bg) shadow-xl transform transition-transform duration-300 ease-in-out ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      } z-50`}
    >
      <div className="h-full p-6 flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white">Welcome Back!</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-800 transition-colors"
          >
            <XMarkIcon className="h-6 w-6 text-white" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col gap-4">
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-white">
                Email
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full rounded-md bg-(--form-bg) border-gray-700 text-white 
                         shadow-sm focus:border-indigo-500 focus:ring-indigo-500 transition-all
                         duration-200 ease-in-out"
              />
              {errors.email && (
                <p className="mt-1 text-sm text-red-400">{errors.email}</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-white">
                Password
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full rounded-md bg-(--form-bg) border-gray-700 text-white 
                         shadow-sm focus:border-indigo-500 focus:ring-indigo-500 
                         transition-all duration-200 ease-in-out"
              />
              {errors.password && (
                <p className="mt-1 text-sm text-red-400">{errors.password}</p>
              )}
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="show-password"
                  type="checkbox"
                  checked={showPassword}
                  onChange={(e) => setShowPassword(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-700 text-indigo-600 
                           focus:ring-indigo-500 bg-(--form-bg)"
                />
                <label htmlFor="show-password" className="ml-2 block text-sm text-white">
                  Show password
                </label>
              </div>
              <div className="flex items-center">
                <input
                  id="remember-me"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-700 text-indigo-600 
                           focus:ring-indigo-500 bg-(--form-bg)"
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-white">
                  Remember me
                </label>
              </div>
            </div>


          </div>

          <button
            type="submit"
            className="w-full bg-indigo-600 text-white rounded-md py-2 px-4 
                     hover:bg-indigo-700 transition-colors mt-4"
          >
            Sign In
          </button>
          <div className="flex items-center justify-between">

<button
  type="button"
  className="w-full text-sm font-medium text-indigo-400 hover:text-indigo-300 
           transition-colors"
>
  Forgot password?
</button>
</div>
        </form>
        

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-400">
            Don't have an account?{' '}
            <button
              onClick={onSwitchToSignup}
              className="text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              Sign Up
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
