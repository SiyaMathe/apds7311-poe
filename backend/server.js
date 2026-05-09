/**
 * server.js
 * ============================================================
 * APDS7311 POE - Secure Government Inter-Departmental Bulletin Board
 * Main Server Entry Point
 * 
 * This file sets up the Express server with all security middleware
 * and starts either an HTTPS server (production) or HTTP (development).
 * 
 * SECURITY STACK (in order of application):
 * 1. helmet     - Sets secure HTTP headers
 * 2. morgan     - Logs all requests (audit trail)
 * 3. cors       - Controls which origins can access the API
 * 4. mongoSanitize - Prevents NoSQL injection via query operators
 * 5. express-brute - Rate limiting / brute force protection (on login route)
 * 6. JWT        - Stateless authentication (on protected routes)
 * 7. Input validation - Whitelist validation on all input
 * 
 * HOW TO RUN:
 * 1. npm install
 * 2. npm run generate-cert  (generates SSL certificate)
 * 3. Copy .env and fill in your MongoDB URI and JWT secret
 * 4. npm run dev            (development with auto-reload)
 * 5. npm start              (production)
 * ============================================================
 */

// Load environment variables FIRST before any other imports
// dotenv reads the .env file and adds variables to process.env
require('dotenv').config();

const express = require('express');
const https = require('https'); // Node.js built-in HTTPS module
const http = require('http');   // Node.js built-in HTTP module
const fs = require('fs');       // File system (to read SSL cert files)
const path = require('path');

// Security middleware imports
const helmet = require('helmet');       // Secure HTTP headers
const morgan = require('morgan');       // HTTP request logger
const cors = require('cors');           // Cross-Origin Resource Sharing
const mongoSanitize = require('express-mongo-sanitize'); // NoSQL injection prevention

// Database connection
const connectDB = require('./config/db');

// Route imports (separate files keep code organized)
const userRoutes = require('./routes/userRoutes');
const postRoutes = require('./routes/postRoutes');

// ============================================================
// DATABASE CONNECTION
// ============================================================
connectDB();

// ============================================================
// EXPRESS APP INITIALIZATION
// ============================================================
const app = express();

// ============================================================
// MIDDLEWARE CONFIGURATION (ORDER MATTERS!)
// ============================================================

/**
 * 1. HELMET - Security HTTP Headers
 * 
 * Helmet sets various HTTP headers that protect against common attacks:
 * 
 * - Content-Security-Policy: Restricts where resources can be loaded from
 *   (prevents XSS by blocking inline scripts from unknown sources)
 * - X-XSS-Protection: Enables browser's built-in XSS filter
 * - X-Frame-Options: Prevents clickjacking (embedding in iframes)
 * - X-Content-Type-Options: Prevents MIME type sniffing
 * - Strict-Transport-Security: Forces HTTPS (prevents protocol downgrade attacks)
 * - Referrer-Policy: Controls what's sent in the Referer header
 * 
 * Without helmet, Express sets no security headers by default.
 */
app.use(helmet({
  // Allow our Angular frontend to connect
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

/**
 * 2. MORGAN - HTTP Request Logger
 * 
 * Logs every incoming request with:
 * - HTTP method (GET, POST, etc.)
 * - URL path
 * - Response status code
 * - Response time
 * - Request size
 * 
 * WHY LOG REQUESTS?
 * - Security audit trail (who accessed what, when)
 * - Detect suspicious patterns (many failed logins, port scanning)
 * - Debug issues in production
 * 
 * 'combined' format: Apache combined log format (standard)
 * 'dev' format: Colorful, concise output for development
 */
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

/**
 * 3. CORS - Cross-Origin Resource Sharing
 * 
 * Browsers enforce the "Same-Origin Policy" - by default, JavaScript
 * on webpage A cannot make requests to server B (different origin).
 * CORS is the mechanism that ALLOWS certain cross-origin requests.
 * 
 * WHY DO WE NEED THIS?
 * Our Angular frontend runs on localhost:4200 but our API runs on
 * localhost:3000. These are different origins (different ports).
 * Without CORS configuration, the browser would block API calls.
 * 
 * SECURITY:
 * - We whitelist ONLY our frontend's origin
 * - We specify which HTTP methods are allowed
 * - We allow the Authorization header (needed for JWT)
 * - In production: replace localhost:4200 with your actual domain
 */
app.use(cors({
  origin: [
    'http://localhost:4200',  // Angular dev server
    'https://localhost:4200', // Angular dev server (HTTPS)
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  // Allow credentials (cookies) to be sent cross-origin
  credentials: true,
}));

/**
 * 4. BODY PARSERS - Parse incoming request bodies
 * 
 * express.json(): Parses JSON request bodies (Content-Type: application/json)
 * express.urlencoded(): Parses URL-encoded bodies (HTML form submissions)
 * 
 * The limit prevents DoS attacks via massive request bodies.
 */
app.use(express.json({ limit: '10kb' })); // Reject bodies larger than 10KB
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

/**
 * 5. MONGO SANITIZE - NoSQL Injection Prevention
 * 
 * WHAT IS NoSQL INJECTION?
 * MongoDB queries use JavaScript objects. An attacker could send:
 * { "username": { "$gt": "" } }  instead of a real username.
 * The $gt (greater than) operator would match ANY username!
 * 
 * HOW express-mongo-sanitize HELPS:
 * It strips out any keys that start with '$' or contain '.'
 * from req.body, req.query, and req.params.
 * 
 * EXAMPLE ATTACK PREVENTED:
 * POST /api/users/login
 * { "username": { "$gt": "" }, "password": "anything" }
 * → mongoSanitize removes the $gt operator → attack fails
 */
app.use(mongoSanitize());

// ============================================================
// ROUTES
// ============================================================

/**
 * API Routes:
 * /api/users  → User registration and login (some public, some protected)
 * /api/posts  → Bulletin board posts (all protected by JWT)
 * 
 * We prefix all routes with /api/ for clear API versioning
 * and to separate API routes from any frontend assets.
 */
app.use('/api/users', userRoutes);
app.use('/api/posts', postRoutes);

/**
 * Health check endpoint - useful for deployment monitoring
 * Does not require authentication - just confirms server is running
 */
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'APDS7311 Bulletin Board API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    ssl: process.env.NODE_ENV === 'production' ? 'enabled' : 'self-signed',
  });
});

// ============================================================
// 404 HANDLER - Unmatched routes
// ============================================================
/**
 * If no route above matched, return 404.
 * 
 * ANTI-HARVESTING: We return the same 404 for all unmatched routes.
 * We never confirm or deny that a specific endpoint exists.
 */
app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    message: 'The requested resource was not found.',
  });
});

// ============================================================
// GLOBAL ERROR HANDLER
// ============================================================
/**
 * Express recognizes this as an error handler because it has 4 params (err, req, res, next).
 * Any error passed to next(error) lands here.
 * 
 * SECURITY: We never expose stack traces or internal error details
 * to the client in production. Internal errors are logged server-side.
 */
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  
  console.error(`❌ Error [${statusCode}]:`, err.message);
  if (process.env.NODE_ENV === 'development') {
    console.error(err.stack);
  }

  res.status(statusCode).json({
    status: 'error',
    message: process.env.NODE_ENV === 'production'
      ? 'An internal server error occurred.'
      : err.message, // Show detailed errors in development only
  });
});

// ============================================================
// SERVER STARTUP
// ============================================================
const PORT = process.env.PORT || 3000;

/**
 * HTTPS vs HTTP:
 * - In production (NODE_ENV=production): Start HTTPS server using SSL certificates
 * - In development: Can use HTTP for simplicity, but HTTPS is recommended
 * 
 * SSL CERTIFICATES:
 * - Generated by: npm run generate-cert
 * - Located at: ./config/ssl/
 * - In production: Use Let's Encrypt or a trusted CA instead of self-signed certs
 */
const startServer = () => {
  const sslKeyPath = process.env.SSL_KEY_PATH || './config/ssl/privatekey.pem';
  const sslCertPath = process.env.SSL_CERT_PATH || './config/ssl/certificate.pem';
  const sslExists = fs.existsSync(sslKeyPath) && fs.existsSync(sslCertPath);

  if (sslExists) {
    /**
     * HTTPS Server Setup:
     * 
     * We read the SSL private key and certificate from files.
     * Node's https.createServer() uses these to:
     * 1. Prove the server's identity to clients (via certificate)
     * 2. Establish an encrypted connection (via private key)
     * 3. All data transmitted is encrypted - cannot be intercepted
     */
    const sslOptions = {
      key: fs.readFileSync(path.resolve(sslKeyPath)),
      cert: fs.readFileSync(path.resolve(sslCertPath)),
    };

    https.createServer(sslOptions, app).listen(PORT, () => {
      console.log('\n🔐 APDS7311 Government Bulletin Board API');
      console.log('==========================================');
      console.log(`✅ HTTPS Server running on port ${PORT}`);
      console.log(`   URL: https://localhost:${PORT}`);
      console.log(`   SSL: Enabled`);
      console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log('==========================================\n');
    });
  } else {
    /**
     * HTTP Fallback (Development Only):
     * If SSL certificates don't exist yet, start HTTP server.
     * Run 'npm run generate-cert' to create SSL certificates.
     */
    console.warn('⚠️  SSL certificates not found. Starting HTTP server (development only).');
    console.warn('   Run: npm run generate-cert\n');

    http.createServer(app).listen(PORT, () => {
      console.log('\n🚀 APDS7311 Government Bulletin Board API (HTTP)');
      console.log('=================================================');
      console.log(`⚠️  HTTP Server running on port ${PORT}`);
      console.log(`   URL: http://localhost:${PORT}`);
      console.log(`   SSL: NOT enabled - run 'npm run generate-cert'`);
      console.log('=================================================\n');
    });
  }
};

startServer();

module.exports = app; // Export for testing
