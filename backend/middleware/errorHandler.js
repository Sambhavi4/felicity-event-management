/**
 * Error Handler Middleware
 * 
 * WHY CENTRALIZED ERROR HANDLING?
 * - Consistent error response format across all endpoints
 * - Cleaner controller code (just throw errors)
 * - Single place to handle logging and error transformation
 * - Different handling for development vs production
 * 
 * ASYNC HANDLER WRAPPER
 * - Eliminates need for try-catch in every async controller
 * - Automatically catches errors and passes to error handler
 */

/**
 * Custom Error Class
 * Allows throwing errors with specific status codes
 */
export class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true; // Indicates trusted, operational error
    
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Async Handler Wrapper
 * 
 * USAGE:
 * Instead of:
 *   const getUser = async (req, res, next) => {
 *     try {
 *       // ... code
 *     } catch (error) {
 *       next(error);
 *     }
 *   };
 * 
 * Use:
 *   const getUser = asyncHandler(async (req, res, next) => {
 *     // ... code (errors automatically caught)
 *   });
 */
export const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Not Found Handler
 * Catches requests to undefined routes
 */
export const notFound = (req, res, next) => {
  const error = new AppError(`Not found - ${req.originalUrl}`, 404);
  next(error);
};

/**
 * Global Error Handler
 * Processes all errors and sends appropriate response
 */
export const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;
  error.stack = err.stack;
  
  // Log error for debugging (in development)
  // Always log error server-side with request context to aid debugging.
  // In production you may want to route these logs to a monitoring service instead.
  try {
    console.error('Error occurred:', {
      message: err.message,
      stack: err.stack,
      name: err.name,
      statusCode: err.statusCode || null,
      url: req?.originalUrl,
      method: req?.method,
      params: req?.params,
      query: req?.query || null
    });
  } catch (logErr) {
    // Fallback to simple logging if structured logging fails
    console.error('Error logging failed:', logErr);
    console.error(err);
  }
  
  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = `Resource not found`;
    error = new AppError(message, 404);
  }
  
  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    const message = `${field} already exists`;
    error = new AppError(message, 400);
  }
  
  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(val => val.message);
    const message = messages.join('. ');
    error = new AppError(message, 400);
  }
  
  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    error = new AppError('Invalid token', 401);
  }
  
  if (err.name === 'TokenExpiredError') {
    error = new AppError('Token expired', 401);
  }
  
  // Send response
  res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || 'Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  });
};
