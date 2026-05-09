/**
 * models/User.js
 * ============================================================
 * User Database Schema & Model
 * 
 * This defines the shape of a User document in MongoDB and
 * includes all the security logic for password handling.
 * 
 * KEY SECURITY CONCEPTS IMPLEMENTED HERE:
 * 
 * 1. PASSWORD HASHING with bcrypt:
 *    - Passwords are NEVER stored as plain text
 *    - bcrypt applies a one-way hashing algorithm
 *    - A random "salt" is added before hashing to prevent
 *      rainbow table attacks (pre-computed hash lookups)
 *    - Salt rounds = 12 means bcrypt runs 2^12 = 4096 iterations,
 *      making brute force attacks computationally expensive
 * 
 * 2. INPUT VALIDATION at schema level:
 *    - Mongoose validators reject bad data before it hits the DB
 *    - This is a second layer after frontend validation
 * 
 * 3. PASSWORD NEVER RETURNED:
 *    - The toJSON method strips the password from API responses
 *    - Even if a developer forgets to exclude it in a query,
 *      the password won't leak in API responses
 * ============================================================
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const validator = require('validator');

// Define the schema (structure) for a User document
const userSchema = new mongoose.Schema(
  {
    // Full name - required, trimmed of whitespace
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
      minlength: [2, 'Full name must be at least 2 characters'],
      maxlength: [100, 'Full name cannot exceed 100 characters'],
    },

    // Username - must be unique, alphanumeric only
    username: {
      type: String,
      required: [true, 'Username is required'],
      unique: true,  // Creates a unique index in MongoDB
      trim: true,
      minlength: [3, 'Username must be at least 3 characters'],
      maxlength: [30, 'Username cannot exceed 30 characters'],
      // Whitelist validation: only allow letters, numbers, underscores, hyphens
      // This prevents injection attacks and harvesting via special characters
      match: [
        /^[a-zA-Z0-9_-]+$/,
        'Username can only contain letters, numbers, underscores, and hyphens'
      ],
    },

    // Account number - unique identifier for government employees
    accountNumber: {
      type: String,
      required: [true, 'Account number is required'],
      unique: true,
      trim: true,
      // Whitelist: only alphanumeric characters allowed
      match: [
        /^[A-Z0-9]{6,12}$/,
        'Account number must be 6-12 uppercase letters/numbers'
      ],
    },

    // ID Number - South African 13-digit ID
    idNumber: {
      type: String,
      required: [true, 'ID number is required'],
      unique: true,
      trim: true,
      // SA ID numbers are exactly 13 digits
      match: [
        /^\d{13}$/,
        'ID number must be exactly 13 digits'
      ],
    },

    // Password - stored as a bcrypt hash, NEVER plain text
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      // select: false means this field is NOT returned in queries by default
      // Must explicitly request it with .select('+password')
      select: false,
    },

    // Department - which government department the user belongs to
    department: {
      type: String,
      required: [true, 'Department is required'],
      trim: true,
      enum: {
        values: [
          'Finance',
          'Health',
          'Education',
          'Defence',
          'Justice',
          'Home Affairs',
          'Transport',
          'Agriculture',
          'Energy',
          'IT Administration'
        ],
        message: 'Please select a valid government department'
      }
    },

    // Role - controls what the user can do (RBAC - Role Based Access Control)
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },

    // Track failed login attempts for brute force protection
    loginAttempts: {
      type: Number,
      default: 0,
    },

    // Lock account after too many failed attempts
    lockUntil: {
      type: Date,
      default: null,
    },

    // Track when user was created
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    // Add createdAt and updatedAt timestamps automatically
    timestamps: true,
  }
);

// ============================================================
// PRE-SAVE MIDDLEWARE (runs before every .save() call)
// This is where we hash the password
// ============================================================
userSchema.pre('save', async function (next) {
  /**
   * Only hash the password if it has been modified (or is new).
   * This prevents re-hashing an already-hashed password when
   * updating other user fields (e.g., changing department).
   */
  if (!this.isModified('password')) return next();

  try {
    /**
     * BCRYPT HASHING PROCESS:
     * 
     * Step 1: Generate a salt
     *   - Salt is random data added to the password before hashing
     *   - This ensures two users with the same password get different hashes
     *   - saltRounds = 12 means the algorithm runs 2^12 = 4096 times
     *   - Higher rounds = more secure but slower (12 is a good balance)
     * 
     * Step 2: Hash the password with the salt
     *   - bcrypt.hash(password, saltRounds) does both steps
     *   - The resulting hash includes the salt, so we don't store it separately
     *   - Example output: $2a$12$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy
     *     └─ algorithm (2a) └─ cost (12) └─ salt+hash (53 chars)
     */
    const saltRounds = 12;
    this.password = await bcrypt.hash(this.password, saltRounds);
    next();
  } catch (error) {
    next(error);
  }
});

// ============================================================
// INSTANCE METHODS - available on every User document
// ============================================================

/**
 * comparePassword - Securely compares a plain text password with the stored hash
 * 
 * WHY NOT COMPARE DIRECTLY?
 * Because the stored password is a bcrypt hash, you cannot compare strings.
 * bcrypt.compare() re-hashes the candidate with the same salt and compares.
 * 
 * @param {string} candidatePassword - The plain text password from login form
 * @returns {Promise<boolean>} - True if passwords match, false otherwise
 */
userSchema.methods.comparePassword = async function (candidatePassword) {
  // bcrypt.compare handles the salt extraction and comparison
  return await bcrypt.compare(candidatePassword, this.password);
};

/**
 * isLocked - Check if the account is currently locked due to failed attempts
 * @returns {boolean}
 */
userSchema.methods.isLocked = function () {
  return this.lockUntil && this.lockUntil > Date.now();
};

/**
 * incrementLoginAttempts - Track failed logins and lock after 5 failures
 * BRUTE FORCE PROTECTION: Lock account for 2 hours after 5 failed attempts
 */
userSchema.methods.incrementLoginAttempts = async function () {
  // If there's a previous lock that has expired, reset the counter
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return await this.updateOne({
      $set: { loginAttempts: 1 },
      $unset: { lockUntil: 1 }
    });
  }

  const updates = { $inc: { loginAttempts: 1 } };

  // Lock account for 2 hours after 5 failed attempts
  if (this.loginAttempts + 1 >= 5 && !this.isLocked()) {
    updates.$set = { lockUntil: Date.now() + 2 * 60 * 60 * 1000 }; // 2 hours
  }

  return await this.updateOne(updates);
};

/**
 * toJSON - Override the default JSON serialization
 * Removes sensitive fields when sending user data in API responses
 */
userSchema.methods.toJSON = function () {
  const userObject = this.toObject();
  // Remove password from all API responses, even if it was selected
  delete userObject.password;
  // Remove internal tracking fields from API responses
  delete userObject.loginAttempts;
  delete userObject.lockUntil;
  delete userObject.__v; // MongoDB internal version key
  return userObject;
};

// Create and export the Model (compiled from the schema)
const User = mongoose.model('User', userSchema);
module.exports = User;
