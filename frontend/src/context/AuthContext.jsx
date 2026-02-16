/* eslint-disable react-refresh/only-export-components */
/**
 * Auth Context
 * 
 * Global state management for authentication
 * 
 * WHY CONTEXT?
 * - Auth state needed across entire app
 * - Avoids prop drilling
 * - Provides clean API for auth operations
 * 
 * PATTERN:
 * - Context holds state (user, loading, etc.)
 * - Provider wraps app
 * - useAuth hook for easy access
 */

import { createContext, useContext, useState, useEffect } from 'react';
import authService from '../services/authService';

// Create context
const AuthContext = createContext(null);

/**
 * Auth Provider Component
 * 
 * Wraps app and provides auth state/methods to all children
 */
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  /**
   * Initialize auth state on mount
   * Check if user is already logged in (token in localStorage)
   */
  useEffect(() => {
    const initAuth = async () => {
      try {
        const token = localStorage.getItem('token');
        
        if (token) {
          // Verify token and get user data
          const response = await authService.getMe();
          setUser(response.user);
        }
      } catch (err) {
        // Token invalid or expired
        console.error('Auth initialization error:', err);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  /**
   * Register new participant
   */
  const register = async (userData) => {
    try {
      setError(null);
      const response = await authService.register(userData);
      setUser(response.user);
      return response;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  /**
   * Login user
   */
  const login = async (email, password, captchaId, captchaAnswer) => {
    try {
      setError(null);
      const response = await authService.login(email, password, captchaId, captchaAnswer);
      setUser(response.user);
      return response;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  /**
   * Logout user
   */
  const logout = () => {
    authService.logout();
    setUser(null);
  };

  /**
   * Update user in context
   */
  const updateUser = (updatedUser) => {
    setUser(updatedUser);
    localStorage.setItem('user', JSON.stringify(updatedUser));
  };

  /**
   * Complete onboarding
   */
  const completeOnboarding = async (data) => {
    try {
      const response = await authService.completeOnboarding(data);
      setUser(response.user);
      return response;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  // Context value
  const value = {
    user,
    loading,
    error,
    isAuthenticated: !!user,
    register,
    login,
    logout,
    updateUser,
    completeOnboarding
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

/**
 * useAuth Hook
 * 
 * Custom hook for accessing auth context
 * Throws error if used outside AuthProvider
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return context;
};

export default AuthContext;
