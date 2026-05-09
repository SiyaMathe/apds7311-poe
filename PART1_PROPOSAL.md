# APDS7311 — Part 1: Secure Login Proposal
## National Government Inter-Departmental Bulletin Board

**Student:** Siyabulela Mathe  
**Module:** Application Development Security (APDS7311)  
**Assessment:** Portfolio of Evidence (POE) — 2022  

---

## 1. Registration and Login Process

### 1a. HTTP Requests and Traffic Security

All communication between the Angular client and the Express backend is encrypted using **HTTPS (HTTP over TLS/SSL)**. A 2048-bit RSA private key and self-signed X.509 certificate are generated via OpenSSL and loaded into Node's built-in `https` module at server startup. This creates an encrypted tunnel, preventing man-in-the-middle (MITM) attacks where an attacker on the same network intercepts login credentials in transit.

The MongoDB Atlas connection string uses the `mongodb+srv://` URI scheme, which enforces TLS on the database layer automatically — data flowing between the Node server and the cloud database is also encrypted.

All login and registration calls use the **POST** HTTP method. GET is deliberately avoided because GET parameters appear in browser history, server access logs, and proxy caches. POST bodies are enclosed in the TLS tunnel and never appear in logs.

The **Helmet** middleware sets the following secure HTTP response headers on every response:

| Header | Purpose |
|---|---|
| `Strict-Transport-Security` | Forces browsers to always use HTTPS for this origin |
| `Content-Security-Policy` | Restricts which origins may load scripts, preventing XSS |
| `X-Frame-Options: DENY` | Prevents the app from being embedded in iframes (clickjacking) |
| `X-Content-Type-Options: nosniff` | Prevents MIME-type sniffing attacks |
| `Referrer-Policy` | Controls what URL data is sent in the Referer header |

---

### 1b. Input Validation

All input validation follows the **whitelist (allow-list)** principle: only explicitly permitted characters and formats are accepted; everything else is rejected with a `400 Bad Request`. This is implemented in `middleware/validate.js` on the server (the true security layer) and mirrored in Angular's `ReactiveFormsModule` on the client (UX only — client-side validation can be bypassed using tools like Postman).

**Whitelist patterns applied at registration:**

| Field | RegEx Pattern | Rationale |
|---|---|---|
| Username | `/^[a-zA-Z0-9_-]{3,30}$/` | Prevents special character injection |
| Account Number | `/^[A-Z0-9]{6,12}$/` | Uppercase alphanumeric only |
| SA ID Number | `/^\d{13}$/` | Exactly 13 digits (SA ID format) |
| Full Name | `/^[a-zA-Z\s'-]{2,100}$/` | Letters, spaces, hyphens, apostrophes |
| Password | `(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])` | Enforces strength requirements |

Empty fields are rejected before any database interaction occurs. All string inputs are passed through `validator.escape()` (via the `validator` npm package) to convert HTML special characters to their entity equivalents (e.g., `<` becomes `&lt;`), preventing stored XSS attacks.

The `express-mongo-sanitize` middleware removes any request body, query, or parameter keys that begin with `$` or contain `.`. This prevents **NoSQL injection** attacks such as `{ "username": { "$gt": "" } }` which — without sanitization — would match every document in MongoDB.

Request bodies are capped at **10 KB** via `express.json({ limit: '10kb' })` to prevent denial-of-service attacks through oversized payloads.

---

### 1c. Storing and Hashing of Passwords

Passwords are **never stored or compared in plain text**. The `bcryptjs` library implements the bcrypt algorithm, chosen because it is specifically designed for password hashing:

- **Adaptive cost factor:** Salt rounds = 12 means bcrypt performs 2^12 = 4,096 iterations. On modern hardware this takes ~100–250ms per hash — fast enough for legitimate logins but computationally infeasible for large-scale brute force.
- **Random salt:** A 16-byte cryptographically random salt is generated for each password. Two users with the same password will have different hashes. This defeats rainbow table attacks (pre-computed hash lookup tables).
- **Salt embedded in hash:** The resulting hash string (e.g., `$2a$12$N9qo8uLOick...`) encodes the algorithm version, cost factor, salt, and hash together. No separate salt column is needed.

The hashing is implemented as a Mongoose `pre('save')` hook on the User model, so it runs automatically before any user document is written to MongoDB:

```javascript
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next(); // don't re-hash on other updates
  const saltRounds = 12;
  this.password = await bcrypt.hash(this.password, saltRounds);
  next();
});
```

The `password` field is marked `select: false` in the Mongoose schema, meaning it is **excluded from all database query results by default** and can never appear in an API response accidentally. The `toJSON()` method also explicitly deletes the password field before serialization.

Password verification at login uses `bcrypt.compare(candidatePassword, storedHash)`, which performs a constant-time comparison — immune to timing-based side-channel attacks.

---

### 1d. Maintaining Authentication State

Authentication state is maintained using **JSON Web Tokens (JWT)**, a stateless mechanism standardised in RFC 7519. Upon successful login, the server issues a signed JWT:

```javascript
jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '1d' })
```

A JWT has three base64-encoded parts: `Header.Payload.Signature`. The header declares the algorithm (HS256), the payload contains the user's `_id` and expiry timestamp, and the signature is an HMAC computed with the server's secret key. If any part is altered, the signature check fails.

The token is returned to the Angular client, stored in `localStorage`, and then attached to every subsequent API request via an HTTP Interceptor (`jwt.interceptor.ts`), using the standard Bearer scheme:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiJ9...
```

The backend `protect` middleware verifies the signature and expiry on every protected request. The server never stores session state — it is entirely stateless. This means the system scales horizontally (multiple servers) without requiring a shared session store.

**Persistence across refreshes:** Because the token and user object are stored in `localStorage`, the Angular `BehaviorSubject` is initialized with the stored user on app startup. The user remains authenticated across page refreshes until the token expires (24 hours) or they explicitly log out.

**Logout:** On logout, `localStorage` is cleared and the `BehaviorSubject` is set to `null`, causing all subscribing components to update reactively. The Angular router then redirects to `/login`.

---

### 1e. Credential Security

- **Password storage:** bcrypt hash (cost factor 12) — never plain text, never reversible.
- **Password comparison:** `bcrypt.compare()` — constant-time, never string equality.
- **Transport:** All traffic encrypted via TLS — credentials never travel in plain text.
- **Token secret:** The JWT signing secret is stored only in the server's `.env` file which is added to `.gitignore` and never committed to version control.
- **SSL private key:** Generated locally, stored in `config/ssl/` which is also in `.gitignore`.
- **Account lockout:** After 5 consecutive failed login attempts, the `lockUntil` field is set to 2 hours in the future. All further login attempts return `423 Locked` regardless of the provided password.
- **Response sanitization:** The `toJSON()` method on the User model removes `password`, `loginAttempts`, and `lockUntil` from all API responses, even if a developer forgets to exclude them in a query.

---

### 1f. Overall Flow of the Login Process

```
User enters username + password in Angular form
        ↓
[FRONTEND] ReactiveForm validators check whitelist patterns (UX only)
        ↓
[FRONTEND] HTTP POST to /api/users/login  (over HTTPS/TLS)
        ↓
[SERVER] express-brute middleware: checks IP attempt count
         → Exceeded (>5 attempts)? Return 429 Too Many Requests
        ↓
[SERVER] express-mongo-sanitize: strips any $ or . operators from body
        ↓
[SERVER] validateLogin middleware: checks fields are non-empty, max length
        ↓
[SERVER] Query MongoDB: User.findOne({ username }).select('+password')
         → Not found? Run dummy bcrypt.compare() to equalise timing
                      Return 401 (same generic message as wrong password)
        ↓
[SERVER] user.isLocked(): check if lockUntil > Date.now()
         → Locked? Return 423 with unlock time
        ↓
[SERVER] bcrypt.compare(candidatePassword, user.password)
         → Mismatch? user.incrementLoginAttempts() → Return 401 (generic)
        ↓
[SERVER] Reset loginAttempts to 0, reset brute-force IP counter
        ↓
[SERVER] jwt.sign({ userId }, JWT_SECRET, { expiresIn: '1d' })
        ↓
[SERVER] Return 200 with { token, user } — user object has no password
        ↓
[FRONTEND] Store token + user in localStorage
        ↓
[FRONTEND] BehaviorSubject.next(user) — components reactively update
        ↓
[FRONTEND] Angular Router navigates to /dashboard
```

---

## 2. Attack Protections

### 2a. Username Harvesting

**Definition:** Username harvesting is an attack where an adversary sends many login requests and infers valid usernames from the server's differing responses. If the server returns `"Username not found"` for invalid users but `"Wrong password"` for valid ones, the attacker can compile a list of real usernames to target later.

**Protections implemented:**

1. **Identical error messages:** Both `"username not found"` and `"wrong password"` scenarios return the same `401` response body: *"Invalid credentials. Please check your username and password."* An attacker learns nothing about which field was incorrect.

2. **Timing attack prevention:** If a username does not exist in the database, a dummy `bcrypt.compare()` call is made against a pre-computed hash before responding. Without this, an attacker could detect valid usernames by measuring response time — bcrypt takes ~100–250ms, so an immediate response would reveal the user doesn't exist. By consuming the same time either way, this timing side-channel is eliminated.

3. **Generic registration conflict message:** When a duplicate username, account number, or ID number is detected during registration, the API returns: *"Registration failed. Please verify your details and try again."* — never which specific field is taken.

4. **Rate limiting:** `express-brute` applies exponential delays after failed attempts from the same IP, slowing any automated enumeration tool.

---

### 2b. Brute Force Attacks

**Definition:** A brute force attack systematically tries every possible password (or a dictionary of common/leaked passwords) against a login endpoint until the correct one is found. Given enough time and requests, a weak authentication system will eventually be compromised.

**Protections implemented:**

1. **bcrypt cost factor 12:** Each password check takes ~100–250ms on modern server hardware. Attempting 1,000,000 passwords per account would take approximately 27+ hours from a single machine. For offline attacks (against a leaked hash database), cost factor 12 makes GPU-based cracking impractical.

2. **express-brute rate limiting:** The `loginBrute` instance in `routes/userRoutes.js` tracks failed attempts per IP address. After 5 free retries, increasing delays are applied (starting at 5 seconds, up to 15 minutes maximum wait). This is configured with `MemoryStore` for development; in production it should use `MongooseStore` to persist across server restarts.

3. **Account lockout:** After 5 failed login attempts against a *specific account* (tracked in the `loginAttempts` field of the User document), the account's `lockUntil` is set to 2 hours in the future. Subsequent requests return `423 Locked`. This protects against distributed brute force attacks originating from multiple IPs that would bypass IP-based rate limiting.

4. **Strong password enforcement at registration:** The whitelist password regex requires at least one uppercase letter, one lowercase letter, one digit, and one special character. This dramatically increases the search space an attacker must cover, making dictionary attacks and simple brute force much harder.

---

### 2c. Session Jacking

**Definition:** Session jacking (session hijacking) is an attack where an adversary steals a user's active session token and uses it to impersonate them. In traditional server-side session systems, this involves stealing a session cookie. In JWT-based systems, the attacker targets the token stored in `localStorage` or intercepted in transit.

**Protections implemented:**

1. **TLS encryption in transit:** All API communication uses HTTPS. An attacker performing a packet capture on the network cannot read the JWT because all traffic is encrypted.

2. **JWT signature verification:** Every request to a protected route passes through the `protect` middleware, which calls `jwt.verify(token, JWT_SECRET)`. If an attacker obtains a token and modifies the payload (e.g., changes the `userId` to gain admin privileges), the HMAC signature check fails and a `401` is returned. A valid token can only be produced by someone who knows the server's secret key.

3. **Short expiry:** Tokens expire after 24 hours (`expiresIn: '1d'`). A stolen token has a limited window of usefulness before it becomes invalid automatically.

4. **XSS prevention:** The primary attack vector for stealing `localStorage` tokens is Cross-Site Scripting (XSS). The `Content-Security-Policy` header, `X-XSS-Protection` header (via Helmet), `validator.escape()` sanitization on stored content, and `express-mongo-sanitize` collectively prevent attackers from injecting malicious JavaScript into the application.

5. **User re-validation on each request:** The `protect` middleware queries the database on every request to confirm the user still exists. If an admin account is deleted after a token was issued, the token immediately stops working.

---

### 2d. Session Fixation

**Definition:** Session fixation is an attack where the adversary establishes a known session identifier before the victim authenticates, then uses that pre-known ID after the victim logs in. This primarily affects server-side session systems where the session ID can be set by the client via a cookie or URL parameter before authentication occurs.

**Protections implemented:**

1. **Stateless JWT — no pre-existing sessions:** The application uses JWTs rather than server-side session stores. There is no concept of a "session" that can be established before authentication. A session only comes into existence when the server generates and signs a new JWT upon successful login.

2. **Server-generated tokens only:** The client cannot supply or influence the JWT it receives. The token is always freshly generated server-side by `jwt.sign()` with a cryptographic signature. Any token a client submits that it did not receive from the server will fail signature verification.

3. **New token on every login:** Every successful login produces a new `jwt.sign()` call with a fresh `iat` (issued-at) timestamp. Even if a previous token exists in `localStorage`, logging in replaces it with a completely new, independently signed token.

4. **No URL-based token transmission:** Tokens are transmitted only in the response body (JSON) and subsequently in the `Authorization: Bearer` header. They are never placed in URL parameters, which would make them susceptible to referrer leakage or log capture that could be exploited for fixation.

---

## References

- OWASP Foundation. (2021). *OWASP Top Ten*. https://owasp.org/www-project-top-ten/
- Provos, N., & Mazières, D. (1999). *A Future-Adaptable Password Scheme*. USENIX Annual Technical Conference. https://www.usenix.org/legacy/events/usenix99/provos/provos.pdf
- Auth0. (2023). *JSON Web Tokens Introduction*. https://jwt.io/introduction
- Mozilla Developer Network. (2023). *HTTP Strict Transport Security*. https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Strict-Transport-Security
- Express.js. (2023). *Production Best Practices: Security*. https://expressjs.com/en/advanced/best-practice-security.html
- Helmet.js. (2023). *Helmet Documentation*. https://helmetjs.github.io/
- NIST. (2017). *Digital Identity Guidelines: Authentication and Lifecycle Management* (SP 800-63B). https://pages.nist.gov/800-63-3/sp800-63b.html
