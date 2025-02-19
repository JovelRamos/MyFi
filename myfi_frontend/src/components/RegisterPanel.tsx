// components/RegisterPanel.tsx
import { useState, useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../contexts/AuthContext';

interface RegisterPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSwitchToLogin: () => void;
}

export default function RegisterPanel({ isOpen, onClose, onSwitchToLogin }: RegisterPanelProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [errors, setErrors] = useState<{
    email?: string;
    password?: string;
    confirmPassword?: string;
  }>({});
  
  const { register } = useAuth();

  const calculatePasswordStrength = (pass: string) => {
    let strength = 0;
    if (pass.length >= 8) strength += 1;
    if (/[A-Z]/.test(pass)) strength += 1;
    if (/[a-z]/.test(pass)) strength += 1;
    if (/[0-9]/.test(pass)) strength += 1;
    if (/[^A-Za-z0-9]/.test(pass)) strength += 1;
    return strength;
  };

  useEffect(() => {
    setPasswordStrength(calculatePasswordStrength(password));
    
    if (confirmPassword) {
      if (password !== confirmPassword) {
        setErrors(prev => ({ ...prev, confirmPassword: "Passwords don't match" }));
      } else {
        setErrors(prev => ({ ...prev, confirmPassword: undefined }));
      }
    }
  }, [password, confirmPassword]);

  const validateForm = () => {
    const newErrors: { email?: string; password?: string; confirmPassword?: string } = {};
    
    if (!email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'Please enter a valid email';
    }

    if (!password) {
      newErrors.password = 'Password is required';
    } else if (passwordStrength < 4) {
      newErrors.password = 'Please choose a stronger password';
    }

    if (password !== confirmPassword) {
      newErrors.confirmPassword = "Passwords don't match";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      await register(email, password);
      onClose();
    } catch (error) {
      console.error('Register error:', error);
    }
  };

  return (
    <div
      className={`fixed inset-y-0 right-0 w-full sm:w-[400px] bg-(--panel-bg) shadow-xl transform transition-transform duration-300 ease-in-out ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      } z-50`}
    >
      <div className="h-full p-6 flex flex-col overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white">Sign Up</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-800 transition-colors"
          >
            <XMarkIcon className="h-6 w-6 text-white" />
          </button>
        </div>

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
                type={showPasswords ? 'text' : 'password'}
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

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-white">
                Confirm Password
              </label>
              <input
                type={showPasswords ? 'text' : 'password'}
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-1 block w-full rounded-md bg-(--form-bg) border-gray-700 text-white 
                         shadow-sm focus:border-indigo-500 focus:ring-indigo-500 
                         transition-all duration-200 ease-in-out"
              />
              {errors.confirmPassword ? (
                <p className="mt-1 text-sm text-red-400">{errors.confirmPassword}</p>
              ) : confirmPassword && password === confirmPassword ? (
                <p className="mt-1 text-sm text-green-400">Passwords match</p>
              ) : null}
            </div>
              {/* Password strength indicator */}
              <div className="mt-2">
                <div className="flex gap-1 h-1">
                  {[1, 2, 3, 4, 5].map((level) => (
                    <div
                      key={level}
                      className={`flex-1 rounded-full transition-all duration-300 ${
                        passwordStrength >= level
                          ? level <= 2
                            ? 'bg-red-500'
                            : level <= 3
                            ? 'bg-yellow-500'
                            : 'bg-green-500'
                          : 'bg-gray-700'
                      }`}
                    />
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Password strength: {
                    passwordStrength <= 2 ? 'Weak' :
                    passwordStrength <= 3 ? 'Medium' : 'Strong'
                  }
                </p>
              </div>
            <div className="flex items-center">
              <input
                id="show-password"
                type="checkbox"
                checked={showPasswords}
                onChange={(e) => setShowPasswords(e.target.checked)}
                className="h-4 w-4 rounded border-gray-700 text-indigo-600 focus:ring-indigo-500 bg-(--form-bg)"
              />
              <label htmlFor="show-password" className="ml-2 block text-sm text-white">
                Show passwords
              </label>
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-indigo-600 text-white rounded-md py-2 px-4 
                     hover:bg-indigo-700 transition-colors mt-4"
          >
            Sign Up
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-400">
            Already have an account?{' '}
            <button
              onClick={onSwitchToLogin}
              className="text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              Sign In
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
