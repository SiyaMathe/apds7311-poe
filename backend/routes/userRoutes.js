require('dotenv').config()
/**
 * routes/userRoutes.js
 * ============================================================
 * User Authentication Routes
 * 
 * Routes:
 * POST /api/users/register  - Create a new user account
 * POST /api/users/login     - Authenticate and receive JWT token
 * GET  /api/users/me        - Get current user profile (protected)
 * 
 * SECURITY FEATURES ON THESE ROUTES:
 * 1. Brute Force Protection via express-brute
 * 2. Input validation via custom middleware
 * 3. Generic error messages (anti-harvesting)
 * 4. JWT issued on successful login
 * 5. Account lockout after 5 failed attempts
 * ============================================================
 */
require('dotenv').config();

const express = require('express');
const jwt = require('jsonwebtoken');
const ExpressBrute = require('express-brute');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const { validateRegister, validateLogin } = require('../middleware/validate');

const router = express.Router();

// ============================================================
// BRUTE FORCE PROTECTION SETUP
// ============================================================
/**
 * express-brute tracks login attempts by IP address and username.
 * 
 * HOW IT WORKS:
 * - Uses in-memory store to track failed attempts (can also use MongoDB)
 * - After freeRetries exceeded, adds delay between attempts
 * - Delay increases exponentially with each attempt (Fibonacci)
 * 
 * BRUTE FORCE ATTACK: An attacker tries thousands of passwords
 * rapidly. By adding delays after failures, we make this infeasible.
 * 
 * FOR PRODUCTION: Replace MemoryStore with MongooseStore so
 * rate limits persist across server restarts and multiple instances.
 * Example:
 *   const MongooseStore = require('express-brute-mongoose');
 *   const store = new MongooseStore(BruteForceModel);
 */
const bruteStore = new ExpressBrute.MemoryStore();
const loginBrute = new ExpressBrute(bruteStore, {
  // Allow 5 free attempts before throttling begins
  freeRetries: 5,
  
  // Minimum delay after freeRetries is exceeded (ms)
  minWait: 5000, // 5 seconds
  
  // Maximum delay between attempts (ms)
  maxWait: 15 * 60 * 1000, // 15 minutes
  
  // Reset counter after this long with no attempts
  lifetime: 60 * 60, // 1 hour (in seconds)
  
  // Custom handler when limit is exceeded
  failCallback: (req, res, next, nextValidRequestDate) => {
    res.status(429).json({
      status: 'error',
      /**
       * ANTI-HARVESTING: Don't mention "login attempts" or reveal
       * anything about the account. Just say "too many requests."
       */
      message: `Too many requests. Please try again after ${nextValidRequestDate.toLocaleTimeString()}.`,
    });
  },
  
  // Handle store errors gracefully
  handleStoreError: (error) => {
    console.error('Brute force store error:', error);
  }
});

// ============================================================
// HELPER: Generate JWT Token
// ============================================================
/**
 * generateToken - Creates a signed JWT for authenticated users
 * 
 * @param {string} userId - MongoDB ObjectId of the user
 * @returns {string} - Signed JWT token
 */
const generateToken = (userId) => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is missing from environment variables');
  }
  return jwt.sign(
    { userId }, 
    process.env.JWT_SECRET, 
    { expiresIn: process.env.JWT_EXPIRES_IN || '1d' }
  );
};

// ============================================================
// ROUTE: POST /api/users/register
// ============================================================
/**
 * Register a new user
 * 
 * Flow:
 * 1. validateRegister middleware checks & sanitizes input
 * 2. Check if username/accountNumber/idNumber already exists
 * 3. Create user (password auto-hashed by pre-save hook in model)
 * 4. Return success (no token at registration - must login separately)
 * 
 * SECURITY NOTE: We use the same generic error message for duplicate
 * username AND all other conflicts to prevent username harvesting.
 */
router.post('/register', validateRegister, async (req, res) => {
  try {
    const { fullName, username, accountNumber, idNumber, password, department } = req.body;

    /**
     * Check for existing user.
     * 
     * IMPORTANT: If we return "Username already taken" vs "Account number taken"
     * separately, an attacker could enumerate valid usernames.
     * Instead, we use a single generic error message.
     */
    const existingUser = await User.findOne({
      $or: [{ username }, { accountNumber }, { idNumber }]
    });

    if (existingUser) {
      return res.status(409).json({
        status: 'error',
        /**
         * ANTI-HARVESTING: Generic message - doesn't reveal WHICH field
         * is already taken, so attacker cannot discover valid usernames.
         */
        message: 'Registration failed. Please verify your details and try again.',
      });
    }

    // Create the user - password hashing happens in the model's pre-save hook
    const user = await User.create({
      fullName,
      username,
      accountNumber,
      idNumber,
      password, // Plain text here - bcrypt hashes it automatically
      department,
    });

    // Return success without exposing sensitive fields
    // user.toJSON() automatically removes password (see model)
    res.status(201).json({
      status: 'success',
      message: 'Account created successfully. You may now log in.',
      data: {
        user: user.toJSON(),
      },
    });

  } catch (error) {
    // Handle Mongoose validation errors (schema-level)
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(e => e.message);
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: messages,
      });
    }
    
    console.error('Registration error:', error);
    res.status(500).json({
      status: 'error',
      message: 'An error occurred during registration. Please try again.',
    });
  }
});

// ============================================================
// ROUTE: POST /api/users/login
// ============================================================
/**
 * Authenticate a user and issue a JWT
 * 
 * SECURITY CHAIN:
 * 1. loginBrute middleware: limits attempts per IP (brute force protection)
 * 2. validateLogin middleware: basic input sanitization
 * 3. Find user by username (account lookup)
 * 4. Check account lockout (too many failed attempts)
 * 5. Compare password using bcrypt
 * 6. On failure: increment attempt counter, return generic error
 * 7. On success: reset counter, issue JWT
 * 
 * CRITICAL - GENERIC ERRORS FOR LOGIN:
 * We NEVER tell the user whether the username or password was wrong.
 * "Invalid username or password" is the correct pattern.
 * If we said "Username not found", attackers could enumerate valid usernames.
 * This is called USERNAME HARVESTING prevention.
 */
router.post('/login', loginBrute.prevent, validateLogin, async (req, res) => {
  try {
    const { username, password } = req.body;

    /**
     * STEP 1: Find user by username
     * 
     * We use .select('+password') because the password field has
     * select: false in the schema (it's excluded by default).
     * We need it here to compare with the provided password.
     */
    const user = await User.findOne({ username }).select('+password');

    /**
     * STEP 2: Anti-harvesting check
     * 
     * If user doesn't exist, we still perform a fake bcrypt compare.
     * WHY? bcrypt.compare takes time (~100ms). If we return immediately
     * for non-existent users but take 100ms for wrong passwords,
     * an attacker can tell which users exist via timing differences.
     * 
     * By always taking the same amount of time, we prevent this
     * timing side-channel attack.
     */
    if (!user) {
      // Perform dummy compare to maintain consistent response time
      await bcryptDummy();
      return res.status(401).json({
        status: 'error',
        // ANTI-HARVESTING: Same message whether username or password is wrong
        message: 'Invalid credentials. Please check your username and password.',
      });
    }

    /**
     * STEP 3: Check if account is locked (too many failed attempts)
     */
    if (user.isLocked()) {
      const lockExpiry = new Date(user.lockUntil).toLocaleTimeString();
      return res.status(423).json({
        status: 'error',
        message: `Account temporarily locked due to multiple failed attempts. Try again after ${lockExpiry}.`,
      });
    }

    /**
     * STEP 4: Compare provided password with stored hash
     * 
     * bcrypt.compare() is used here via the model instance method.
     * It extracts the salt from the stored hash, re-hashes the
     * candidate password, and compares the results.
     */
    const isPasswordCorrect = await user.comparePassword(password);

    if (!isPasswordCorrect) {
      // Increment failed attempt counter (may lock account)
      await user.incrementLoginAttempts();
      
      return res.status(401).json({
        status: 'error',
        // Same message - never reveal which field was wrong
        message: 'Invalid credentials. Please check your username and password.',
      });
    }

    /**
     * STEP 5: Successful login
     * 
     * - Reset the brute force counter for this IP
     * - Reset login attempt counter on the user document
     * - Generate and return JWT
     */
    // This is the safer way to handle reset within an async handler
if (req.brute && req.brute.reset) {
    req.brute.reset(() => {});
}

    // Reset failed login counter in the database
    if (user.loginAttempts > 0) {
      await user.updateOne({
        $set: { loginAttempts: 0 },
        $unset: { lockUntil: 1 }
      });
    }

    // Generate JWT token
    const token = generateToken(user._id);

    res.status(200).json({
      status: 'success',
      message: 'Login successful',
      data: {
        token,
        // Include user details (toJSON() strips sensitive fields)
        user: user.toJSON(),
      },
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      status: 'error',
      message: 'An error occurred during login. Please try again.',
    });
  }
});

// ============================================================
// ROUTE: GET /api/users/me  (PROTECTED)
// ============================================================
/**
 * Get the currently authenticated user's profile
 * 
 * Requires: Valid JWT in Authorization header
 * The protect middleware verifies the token and sets req.user
 */
router.get('/me', protect, async (req, res) => {
  try {
    // req.user is set by the protect middleware
    res.status(200).json({
      status: 'success',
      data: {
        user: req.user.toJSON(),
      },
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Could not retrieve user profile.',
    });
  }
});

// ============================================================
// HELPER: Dummy bcrypt operation for timing attack prevention
// ============================================================
/**
 * When a username doesn't exist, we still run a bcrypt operation
 * to ensure the response time is the same as a real password check.
 * This prevents timing attacks that could reveal valid usernames.
 */
const bcryptDummy = async () => {
  const bcrypt = require('bcryptjs');
  // Compare against a dummy hash - result will always be false
  const dummyHash = '$2a$12$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';
  await bcrypt.compare('dummy_password', dummyHash);
};

module.exports = router;
