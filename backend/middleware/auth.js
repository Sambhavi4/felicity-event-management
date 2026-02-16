/**
 * Authentication Middleware
 * 
 * WHY MIDDLEWARE?
 * - Separates authentication logic from route handlers
 * - Reusable across all protected routes
 * - Cleaner, more maintainable code
 * 
 * JWT FLOW:
 * 1. Client sends token in Authorization header: "Bearer <token>"
 * 2. Middleware extracts and verifies token
 * 3. If valid, attaches user to request object
 * 4. Route handler has access to req.user
 * 
 * SECURITY CONSIDERATIONS:
 * - Token expiration prevents indefinite access
 * - select('+password') NOT called - password never exposed
 * - Role-based access control as separate middleware
 */

import jwt from 'jsonwebtoken';
import User from '../models/User.js';

/**
 * Protect routes - Verify JWT token
 */
export const protect = async (req, res, next) => {
  try {
    let token;
    
    // Check for token in Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      // Extract token: "Bearer eyJhbGc..." -> "eyJhbGc..."
      token = req.headers.authorization.split(' ')[1];
    }
    
    // No token found
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized - No token provided'
      });
    }
    
    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Get user from token payload
      const user = await User.findById(decoded.id);
      
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Not authorized - User not found'
        });
      }
      
      // Check if user is active
      if (!user.isActive) {
        return res.status(401).json({
          success: false,
          message: 'Account has been deactivated. Please contact admin.'
        });
      }
      
      // Attach user to request
      req.user = user;
      next();
      
    } catch (error) {
      // Token verification failed
      return res.status(401).json({
        success: false,
        message: 'Not authorized - Invalid token'
      });
    }
    
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error in authentication'
    });
  }
};

/**
 * Role-based access control
 * 
 * USAGE:
 * router.get('/admin-only', protect, authorize('admin'), controller)
 * router.get('/organizer-admin', protect, authorize('organizer', 'admin'), controller)
 * 
 * WHY HIGHER-ORDER FUNCTION?
 * - Returns a middleware function customized with allowed roles
 * - Flexible: can specify one or multiple roles
 * - Clean syntax when used in routes
 */
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized - Please login first'
      });
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. ${req.user.role} role is not authorized to access this resource`
      });
    }
    
    next();
  };
};

/**
 * Optional auth - Don't fail if no token, but attach user if present
 * Useful for endpoints that work differently for logged-in users
 */
export const optionalAuth = async (req, res, next) => {
  try {
    let token;
    
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id);
        if (user && user.isActive) {
          req.user = user;
        }
      } catch (error) {
        // Token invalid - continue without user
      }
    }
    
    next();
    
  } catch (error) {
    next();
  }
};
