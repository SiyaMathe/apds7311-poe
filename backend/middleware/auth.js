/**
 * middleware/auth.js
 * ============================================================
 * JWT Authentication Middleware
 * 
 * This middleware protects routes by verifying JSON Web Tokens (JWT).
 * It runs BEFORE the route handler, acting as a security checkpoint.
 * 
 * HOW JWT WORKS:
 * 1. User logs in with valid credentials
 * 2. Server creates a JWT containing user ID + expiry, signed with a secret key
 * 3. JWT is sent to the client (stored in localStorage or httpOnly cookie)
 * 4. Client sends JWT in the Authorization header on every protected request
 * 5. This middleware verifies the JWT before allowing access
 * 
 * JWT STRUCTURE (three base64-encoded parts separated by dots):
 *   Header.Payload.Signature
 *   eyJhbGc... . eyJ1c2VySWQi... . SflKxwRJSMeK...
 *   (algorithm) (data/claims)     (signature)
 * 
 * WHY JWT OVER SESSIONS?
 * - Stateless: server doesn't need to store session data
 * - Scalable: works across multiple servers without shared session store
 * - The signature ensures the token hasn't been tampered with
 * 
 * SECURITY: The secret key in .env must be kept private.
 * If compromised, all tokens can be forged.
 * ============================================================
 */

const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * protect - Middleware to verify JWT and attach user to request
 * 
 * Usage: Add as middleware to any route that requires authentication
 * Example: router.get('/posts', protect, getPosts)
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Call next middleware/route handler
 */
const protect = async (req, res, next) => {
  try {
    let token;

    /**
     * STEP 1: Extract the JWT from the Authorization header
     * 
     * Standard format: "Authorization: Bearer <token>"
     * The "Bearer" prefix is a convention from OAuth 2.0.
     * We split on the space and take the second part (index 1).
     */
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer ')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    // If no token found, reject the request
    if (!token) {
      return res.status(401).json({
        status: 'error',
        /**
         * ANTI-HARVESTING: Generic error message that doesn't reveal
         * whether the endpoint exists or what specific authentication
         * mechanism is required.
         */
        message: 'Access denied. Authentication required.',
      });
    }

    /**
     * STEP 2: Verify the JWT signature
     * 
     * jwt.verify() does three things:
     * 1. Checks the signature against our secret key
     *    (if tampered with, the signature won't match)
     * 2. Checks the token hasn't expired (exp claim)
     * 3. Decodes and returns the payload
     * 
     * If any check fails, it throws an error which we catch below.
     */
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    /**
     * STEP 3: Find the user in the database
     * 
     * We verify the user still exists - they might have been deleted
     * after the token was issued. This is important for security:
     * if an account is deleted/disabled, old tokens should stop working.
     */
    const currentUser = await User.findById(decoded.userId);

    if (!currentUser) {
      return res.status(401).json({
        status: 'error',
        message: 'The user associated with this token no longer exists.',
      });
    }

    /**
     * STEP 4: Attach user to request object
     * 
     * Now all subsequent route handlers can access req.user
     * to know who is making the request.
     */
    req.user = currentUser;

    // ✅ Authentication successful - proceed to the route handler
    next();

  } catch (error) {
    /**
     * Handle specific JWT errors with appropriate messages:
     * - TokenExpiredError: Token has passed its expiry time
     * - JsonWebTokenError: Token is malformed or signature is invalid
     * 
     * ANTI-HARVESTING: We return 401 for all auth failures,
     * never revealing what specifically went wrong to an attacker.
     */
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        status: 'error',
        message: 'Your session has expired. Please log in again.',
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid authentication token. Please log in again.',
      });
    }

    // Generic error handler
    console.error('Auth middleware error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Authentication error. Please try again.',
    });
  }
};

/**
 * restrictTo - Role-based access control middleware
 * 
 * Usage: Add after protect to limit access by role
 * Example: router.delete('/users/:id', protect, restrictTo('admin'), deleteUser)
 * 
 * @param {...string} roles - Allowed roles (e.g., 'admin', 'user')
 */
const restrictTo = (...roles) => {
  return (req, res, next) => {
    // req.user is set by the protect middleware that runs before this
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        status: 'error',
        message: 'You do not have permission to perform this action.',
      });
    }
    next();
  };
};

module.exports = { protect, restrictTo };
