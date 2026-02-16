/**
 * Custom Hooks
 * 
 * This file exports custom React hooks for common functionality.
 * Hooks are reusable logic that can be shared across components.
 */

import { useState, useEffect } from 'react';

/**
 * useLocalStorage Hook
 * 
 * Persists state in localStorage with automatic JSON serialization.
 * 
 * @param {string} key - The localStorage key
 * @param {any} initialValue - Initial value if key doesn't exist
 * @returns {[any, Function]} - [storedValue, setValue]
 * 
 * Example:
 * const [theme, setTheme] = useLocalStorage('theme', 'light');
 */
export const useLocalStorage = (key, initialValue) => {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  const setValue = (value) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error(`Error setting localStorage key "${key}":`, error);
    }
  };

  return [storedValue, setValue];
};

/**
 * useDebounce Hook
 * 
 * Debounces a value - only updates after a delay without changes.
 * Useful for search inputs to avoid too many API calls.
 * 
 * @param {any} value - The value to debounce
 * @param {number} delay - Delay in milliseconds
 * @returns {any} - The debounced value
 * 
 * Example:
 * const debouncedSearch = useDebounce(searchTerm, 500);
 */
export const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

/**
 * useWindowSize Hook
 * 
 * Returns current window dimensions, updates on resize.
 * 
 * @returns {{ width: number, height: number }}
 * 
 * Example:
 * const { width, height } = useWindowSize();
 * const isMobile = width < 768;
 */
export const useWindowSize = () => {
  const [windowSize, setWindowSize] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 0,
    height: typeof window !== 'undefined' ? window.innerHeight : 0,
  });

  useEffect(() => {
    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return windowSize;
};

/**
 * useOnClickOutside Hook
 * 
 * Detects clicks outside a referenced element.
 * Useful for closing modals/dropdowns when clicking outside.
 * 
 * @param {React.RefObject} ref - Reference to the element
 * @param {Function} handler - Callback when click outside occurs
 * 
 * Example:
 * const modalRef = useRef();
 * useOnClickOutside(modalRef, () => setIsOpen(false));
 */
export const useOnClickOutside = (ref, handler) => {
  useEffect(() => {
    const listener = (event) => {
      if (!ref.current || ref.current.contains(event.target)) {
        return;
      }
      handler(event);
    };

    document.addEventListener('mousedown', listener);
    document.addEventListener('touchstart', listener);

    return () => {
      document.removeEventListener('mousedown', listener);
      document.removeEventListener('touchstart', listener);
    };
  }, [ref, handler]);
};
