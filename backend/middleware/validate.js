/**
 * middleware/validate.js
 * ============================================================
 * Input Validation Middleware
 * 
 * This middleware validates and sanitizes all incoming data BEFORE
 * it reaches the route handlers or database.
 * 
 * TWO TYPES OF VALIDATION:
 * 
 * 1. WHITELIST VALIDATION (Allow-list):
 *    - Define exactly what IS allowed (specific characters, formats)
 *    - Reject anything that doesn't match the pattern
 *    - Uses RegEx (Regular Expressions) to enforce patterns
 *    - Example: username must match /^[a-zA-Z0-9_-]+$/
 * 
 * 2. SANITIZATION:
 *    - Clean input to remove potentially dangerous content
 *    - Strip HTML tags (prevent XSS attacks)
 *    - Trim whitespace
 *    - Normalize data format
 * 
 * WHY VALIDATE ON THE SERVER?
 * Frontend validation can be bypassed by anyone using tools like
 * Postman or curl. Server-side validation is the true security layer.
 * ============================================================
 */

const validator = require('validator');

// ============================================================
// VALIDATION HELPER FUNCTIONS
// ============================================================

/**
 * validatePassword - Enforces strong password policy
 * 
 * Requirements:
 * - At least 8 characters long
 * - At least one uppercase letter (A-Z)
 * - At least one lowercase letter (a-z)
 * - At least one number (0-9)
 * - At least one special character (!@#$%^&*)
 * 
 * WHY STRONG PASSWORDS?
 * Weak passwords are the #1 cause of account breaches.
 * Strong passwords resist both dictionary attacks and brute force.
 * 
 * @param {string} password
 * @returns {Object} { isValid: boolean, message: string }
 */
const validatePassword = (password) => {
  if (!password) {
    return { isValid: false, message: 'Password is required' };
  }

  if (password.length < 8) {
    return { isValid: false, message: 'Password must be at least 8 characters long' };
  }

  // Check for uppercase letter
  if (!/[A-Z]/.test(password)) {
    return { isValid: false, message: 'Password must contain at least one uppercase letter' };
  }

  // Check for lowercase letter
  if (!/[a-z]/.test(password)) {
    return { isValid: false, message: 'Password must contain at least one lowercase letter' };
  }

  // Check for number
  if (!/[0-9]/.test(password)) {
    return { isValid: false, message: 'Password must contain at least one number' };
  }

  // Check for special character - WHITELIST of allowed special chars
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    return { isValid: false, message: 'Password must contain at least one special character' };
  }

  return { isValid: true, message: 'Password is valid' };
};

/**
 * sanitizeString - Removes dangerous characters from string input
 * 
 * Prevents:
 * - XSS (Cross-Site Scripting): removes HTML/script tags
 * - NoSQL injection: removes MongoDB operators
 * 
 * @param {string} str - Input string to sanitize
 * @returns {string} - Cleaned string
 */
const sanitizeString = (str) => {
  if (typeof str !== 'string') return '';
  // Remove HTML tags to prevent XSS
  return validator.escape(str.trim());
};

// ============================================================
// REGISTRATION VALIDATION MIDDLEWARE
// ============================================================

/**
 * validateRegister - Validates user registration input
 * 
 * Checks all fields against whitelist patterns and business rules.
 * Returns a 400 Bad Request if any validation fails.
 */
const validateRegister = (req, res, next) => {
  const { fullName, username, accountNumber, idNumber, password, department } = req.body;
  const errors = [];

  // --- Full Name Validation ---
  if (!fullName || fullName.trim().length < 2) {
    errors.push('Full name must be at least 2 characters');
  }
  // Whitelist: only letters, spaces, hyphens, apostrophes (for names like O'Brien)
  if (fullName && !/^[a-zA-Z\s'-]{2,100}$/.test(fullName.trim())) {
    errors.push('Full name contains invalid characters');
  }

  // --- Username Validation ---
  if (!username || username.trim().length < 3) {
    errors.push('Username must be at least 3 characters');
  }
  // Whitelist: only alphanumeric, underscore, hyphen
  if (username && !/^[a-zA-Z0-9_-]{3,30}$/.test(username.trim())) {
    errors.push('Username can only contain letters, numbers, underscores, and hyphens (3-30 chars)');
  }

  // --- Account Number Validation ---
  if (!accountNumber) {
    errors.push('Account number is required');
  }
  // Whitelist: 6-12 uppercase alphanumeric characters
  if (accountNumber && !/^[A-Z0-9]{6,12}$/.test(accountNumber.trim())) {
    errors.push('Account number must be 6-12 uppercase letters and numbers (e.g., GOV123456)');
  }

  // --- ID Number Validation ---
  if (!idNumber) {
    errors.push('ID number is required');
  }
  // South African ID numbers: exactly 13 digits
  if (idNumber && !/^\d{13}$/.test(idNumber.trim())) {
    errors.push('ID number must be exactly 13 digits');
  }

  // --- Password Validation ---
  const passwordCheck = validatePassword(password);
  if (!passwordCheck.isValid) {
    errors.push(passwordCheck.message);
  }

  // --- Department Validation ---
  const validDepartments = [
    'Finance', 'Health', 'Education', 'Defence', 'Justice',
    'Home Affairs', 'Transport', 'Agriculture', 'Energy', 'IT Administration'
  ];
  if (!department || !validDepartments.includes(department)) {
    errors.push('Please select a valid government department');
  }

  // If there are validation errors, return them all at once
  if (errors.length > 0) {
    return res.status(400).json({
      status: 'error',
      message: 'Validation failed',
      errors: errors, // Return all errors so user can fix them all at once
    });
  }

  // Sanitize inputs before passing to next middleware
  req.body.fullName = sanitizeString(fullName);
  req.body.username = sanitizeString(username).toLowerCase();
  req.body.accountNumber = sanitizeString(accountNumber).toUpperCase();
  req.body.idNumber = sanitizeString(idNumber);
  // NOTE: Do NOT sanitize password - it will be hashed as-is

  next(); // All validation passed, proceed to route handler
};

// ============================================================
// LOGIN VALIDATION MIDDLEWARE
// ============================================================

/**
 * validateLogin - Validates login input
 * 
 * Deliberately keeps validation minimal for login:
 * - We don't want to reveal what specific format we expect
 * - This helps protect against username harvesting
 * - We just ensure fields are not empty
 */
const validateLogin = (req, res, next) => {
  const { username, password } = req.body;

  // Empty field check only - don't reveal format requirements
  // (that information is only needed at registration)
  if (!username || !username.trim()) {
    return res.status(400).json({
      status: 'error',
      /**
       * ANTI-HARVESTING: Use the same generic message for both
       * missing username AND missing password. This prevents an
       * attacker from determining which field is wrong.
       */
      message: 'Invalid credentials. Please check your username and password.',
    });
  }

  if (!password) {
    return res.status(400).json({
      status: 'error',
      message: 'Invalid credentials. Please check your username and password.',
    });
  }

  // Basic length check to prevent absurdly long inputs (DoS protection)
  if (username.length > 100 || password.length > 200) {
    return res.status(400).json({
      status: 'error',
      message: 'Invalid credentials. Please check your username and password.',
    });
  }

  // Sanitize username (but NOT password - it needs to be compared as-is)
  req.body.username = sanitizeString(username).toLowerCase();

  next();
};

// ============================================================
// POST VALIDATION MIDDLEWARE
// ============================================================

/**
 * validatePost - Validates bulletin board post creation input
 */
const validatePost = (req, res, next) => {
  const { title, content, category, priority } = req.body;
  const errors = [];

  // Title validation
  if (!title || title.trim().length < 3) {
    errors.push('Post title must be at least 3 characters');
  }
  if (title && title.trim().length > 150) {
    errors.push('Post title cannot exceed 150 characters');
  }

  // Content validation
  if (!content || content.trim().length < 10) {
    errors.push('Post content must be at least 10 characters');
  }
  if (content && content.trim().length > 5000) {
    errors.push('Post content cannot exceed 5000 characters');
  }

  // Category validation (whitelist)
  const validCategories = ['Policy', 'Infrastructure', 'Security', 'Finance', 'Health', 'Emergency', 'General'];
  if (!category || !validCategories.includes(category)) {
    errors.push('Please select a valid category');
  }

  // Priority validation (whitelist)
  const validPriorities = ['Low', 'Medium', 'High', 'Critical'];
  if (priority && !validPriorities.includes(priority)) {
    errors.push('Please select a valid priority level');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      status: 'error',
      message: 'Validation failed',
      errors,
    });
  }

  // Sanitize inputs - strip any HTML tags to prevent XSS
  req.body.title = sanitizeString(title);
  req.body.content = sanitizeString(content);

  next();
};

module.exports = { validateRegister, validateLogin, validatePost, validatePassword };
