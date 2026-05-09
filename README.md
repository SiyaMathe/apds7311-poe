# APDS7311 POE — Secure Government Bulletin Board
**Student:** Siyabulela Mathe  
**Module:** Application Development Security (APDS7311)

---

## Project Structure

```
apds7311-poe/
├── backend/                        ← Express.js REST API
│   ├── config/
│   │   ├── db.js                   ← MongoDB connection
│   │   ├── generateCert.js         ← SSL cert generator
│   │   └── ssl/                    ← Generated SSL files (gitignored)
│   ├── middleware/
│   │   ├── auth.js                 ← JWT protect + restrictTo middleware
│   │   └── validate.js             ← Whitelist input validation
│   ├── models/
│   │   ├── User.js                 ← User schema + bcrypt hashing
│   │   └── Post.js                 ← Post schema
│   ├── routes/
│   │   ├── userRoutes.js           ← Register / Login / Profile
│   │   └── postRoutes.js           ← Get / Create / Delete posts
│   ├── server.js                   ← App entry point, HTTPS server
│   ├── api-tests.http              ← VSCode REST Client tests
│   ├── package.json
│   └── .env                        ← Environment variables (fill in!)
│
├── frontend/                       ← Angular 17 SPA
│   ├── src/
│   │   ├── app/
│   │   │   ├── components/
│   │   │   │   ├── auth/
│   │   │   │   │   ├── login.component.ts
│   │   │   │   │   └── register.component.ts
│   │   │   │   ├── posts/
│   │   │   │   │   └── posts.component.ts
│   │   │   │   └── shared/
│   │   │   │       └── error-message.component.ts
│   │   │   ├── guards/
│   │   │   │   └── auth.guard.ts   ← Protects /dashboard route
│   │   │   ├── interceptors/
│   │   │   │   └── jwt.interceptor.ts ← Adds Bearer token to requests
│   │   │   ├── services/
│   │   │   │   ├── auth.service.ts ← Login / Register / Logout / JWT
│   │   │   │   └── post.service.ts ← Get / Create / Delete posts
│   │   │   ├── app.component.ts
│   │   │   ├── app.config.ts       ← Providers + interceptors
│   │   │   └── app.routes.ts       ← Route definitions + guards
│   │   ├── environments/
│   │   │   └── environment.ts      ← API base URL
│   │   ├── index.html
│   │   ├── main.ts
│   │   └── styles.css
│   ├── angular.json
│   ├── package.json
│   └── tsconfig.json
│
└── PART1_PROPOSAL.md               ← Part 1 written proposal
```

---

## Prerequisites

Install these before starting:

| Tool | Version | Download |
|---|---|---|
| Node.js | 18+ | https://nodejs.org |
| npm | 9+ | (comes with Node) |
| Angular CLI | 17+ | `npm install -g @angular/cli` |
| OpenSSL | any | https://www.openssl.org (Git Bash on Windows includes it) |
| VSCode | any | https://code.visualstudio.com |
| REST Client (VSCode ext) | any | Search "REST Client" by Huachao Mao |

---

## Setup: MongoDB Atlas (Cloud Database)

1. Go to https://www.mongodb.com/cloud/atlas and create a free account
2. Create a **free M0 cluster** (any region)
3. Click **Connect** → **Connect your application**
4. Copy the connection string — it looks like:
   `mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/`
5. Replace `<password>` with your actual password
6. Add `/apds7311` before the `?` to set the database name:
   `mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/apds7311?retryWrites=true&w=majority`
7. In **Network Access**, click **Add IP Address** → **Allow access from anywhere** (for dev)

---

## Setup: Backend

```bash
# 1. Navigate to backend
cd apds7311-poe/backend

# 2. Install dependencies
npm install

# 3. Generate SSL certificate (required for HTTPS)
npm run generate-cert
# → Creates config/ssl/privatekey.pem and config/ssl/certificate.pem

# 4. Configure environment variables
# Edit the .env file:
# - Set MONGO_URI to your MongoDB Atlas connection string
# - Set JWT_SECRET to a long random string (min 32 characters)
# Example JWT_SECRET: openssl rand -base64 32

# 5. Start the development server
npm run dev
# → Server starts on https://localhost:3000 (or http if no SSL)
```

**Expected output:**
```
✅ MongoDB Connected: cluster0.xxxxx.mongodb.net
🔐 APDS7311 Government Bulletin Board API
==========================================
✅ HTTPS Server running on port 3000
   URL: https://localhost:3000
   SSL: Enabled
==========================================
```

> **IMPORTANT — Self-signed certificate warning:**
> The first time you use HTTPS with the self-signed cert, visit
> `https://localhost:3000/api/health` in your browser and click
> "Advanced" → "Proceed to localhost". This tells the browser to
> trust the cert. The REST Client also needs:
> Add `"rest-client.ssl.verify": false` to VSCode settings.json

---

## Setup: Frontend

```bash
# 1. Navigate to frontend
cd apds7311-poe/frontend

# 2. Install Angular dependencies
npm install

# 3. Start the Angular development server
ng serve
# → App available at http://localhost:4200

# Or if you want HTTPS on the frontend too:
# ng serve --ssl
```

> **Note:** If the backend is running HTTP (no SSL cert yet), change
> `apiUrl` in `src/environments/environment.ts` from `https://` to `http://`

---

## Running the Application

1. Start backend: `npm run dev` in `/backend`
2. Start frontend: `ng serve` in `/frontend`
3. Open browser: http://localhost:4200
4. Register a new account → Log in → Use the bulletin board

---

## API Testing (REST Client)

1. Open `backend/api-tests.http` in VSCode
2. Make sure the backend is running
3. Run tests in order:
   - **Test 1:** Health check
   - **Test 2:** Register a user
   - **Test 5:** Login → copy the `token` from the response
   - Paste token into the `@authToken` variable at the top of the file
   - Run Tests 8–19 to test all protected routes and security features

---

## Security Features Implemented

### Backend
| Feature | Implementation | File |
|---|---|---|
| SSL/HTTPS | `https.createServer()` with OpenSSL cert | `server.js` |
| Secure HTTP Headers | `helmet()` middleware | `server.js` |
| Request Logging | `morgan()` middleware | `server.js` |
| CORS | `cors()` with whitelist origins | `server.js` |
| NoSQL Injection Prevention | `express-mongo-sanitize` | `server.js` |
| Brute Force Protection | `express-brute` with exponential backoff | `routes/userRoutes.js` |
| Input Validation (Whitelist) | RegEx via `validateRegister`, `validateLogin` | `middleware/validate.js` |
| Password Hashing | bcrypt (salt rounds: 12) via pre-save hook | `models/User.js` |
| Account Lockout | 5 failed attempts → 2hr lock | `models/User.js` |
| JWT Authentication | `jsonwebtoken` with 24hr expiry | `routes/userRoutes.js` |
| Route Protection | `protect` middleware on all post routes | `middleware/auth.js` |
| Anti-Harvesting | Generic error messages, timing equalisation | `routes/userRoutes.js` |
| Soft Delete | `isActive: false` instead of hard delete | `routes/postRoutes.js` |

### Frontend
| Feature | Implementation | File |
|---|---|---|
| Whitelist Validation | `Validators.pattern()` with RegEx | `register.component.ts` |
| Password Obscuring | Toggle input type password/text | `login.component.ts`, `register.component.ts` |
| Password Strength Meter | Live strength calculation | `register.component.ts` |
| Custom Error Component | `<app-error-message>` | `error-message.component.ts` |
| JWT Persistence | `localStorage` + `BehaviorSubject` | `auth.service.ts` |
| Auto Token Attachment | HTTP Interceptor adds Bearer header | `jwt.interceptor.ts` |
| Route Protection | `AuthGuard` on `/dashboard` | `auth.guard.ts` |
| Session Expiry Handling | 401 → auto logout → redirect | `jwt.interceptor.ts` |

---

## Submission Checklist

### Part 1
- [x] HTTP requests and traffic security (HTTPS, Helmet, POST method)
- [x] Input validation (whitelist RegEx, empty field checks, sanitization)
- [x] Storing and hashing of passwords (bcrypt, salt, select: false)
- [x] Maintaining authentication state (JWT, localStorage, BehaviorSubject)
- [x] Credential security (lockout, secret in env, SSL in gitignore)
- [x] Overall login flow diagram
- [x] Username harvesting protection (generic messages, timing)
- [x] Brute force protection (express-brute, bcrypt cost, account lockout)
- [x] Session jacking protection (TLS, JWT signature, XSS prevention)
- [x] Session fixation protection (stateless JWT, server-generated tokens)

### Part 2 — Backend
- [x] MongoDB Atlas setup
- [x] SSL certificate and private key generated
- [x] GET all posts
- [x] POST create post
- [x] DELETE post
- [x] POST register user
- [x] POST login user
- [x] SSL on all API and DB calls
- [x] CORS configured
- [x] Passwords hashed (not stored in plain text)
- [x] Separate protected routes for posts and users
- [x] JWT authentication persisted

### POE — Frontend
- [x] Display posts with delete button
- [x] Create post form
- [x] Posts service
- [x] Register component
- [x] Login component
- [x] Auth service
- [x] Input validation, password obscuring, sanitization
- [x] Custom error message component
- [x] Login state persisted after authentication
- [x] express-brute, helmet, morgan implemented
