/**
 * config/generateCert.js
 * ============================================================
 * SSL Certificate Generator
 * 
 * This script generates a self-signed SSL certificate and private key
 * for development use. In production, you would use a certificate from
 * a trusted Certificate Authority (CA) like Let's Encrypt.
 * 
 * HOW SSL WORKS (simplified):
 * 1. The server has a private key (kept secret) and a certificate (public)
 * 2. When a client connects, they exchange keys to encrypt all traffic
 * 3. This prevents "man-in-the-middle" attacks where someone intercepts data
 * 
 * HOW TO RUN: npm run generate-cert
 * ============================================================
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Directory where SSL files will be stored
const sslDir = path.join(__dirname, 'ssl');

// Create the ssl directory if it doesn't exist
if (!fs.existsSync(sslDir)) {
  fs.mkdirSync(sslDir, { recursive: true });
  console.log('✅ Created ssl directory');
}

console.log('🔐 Generating SSL certificate and private key...');
console.log('   This creates a self-signed certificate for DEVELOPMENT only.\n');

try {
  /**
   * OpenSSL command breakdown:
   * req          - Certificate request and certificate generating utility
   * -x509        - Output a self-signed certificate instead of a certificate request
   * -newkey rsa:2048 - Create a new RSA key with 2048 bits (secure enough for dev)
   * -keyout      - Where to save the private key
   * -out         - Where to save the certificate
   * -days 365    - Certificate validity period
   * -nodes       - Don't encrypt the private key (no passphrase, easier for dev)
   * -subj        - Subject information embedded in the certificate
   */
  execSync(
    `openssl req -x509 -newkey rsa:2048 \
    -keyout "${sslDir}/privatekey.pem" \
    -out "${sslDir}/certificate.pem" \
    -days 365 -nodes \
    -subj "/C=ZA/ST=Gauteng/L=Pretoria/O=Government/OU=IT/CN=localhost"`,
    { stdio: 'inherit' }
  );

  console.log('\n✅ SSL files generated successfully:');
  console.log(`   Private Key: ${sslDir}/privatekey.pem`);
  console.log(`   Certificate: ${sslDir}/certificate.pem`);
  console.log('\n⚠️  IMPORTANT: These files are for development only.');
  console.log('   For production, obtain a certificate from a trusted CA.');
  console.log('   Add config/ssl/ to your .gitignore file!\n');

} catch (error) {
  console.error('❌ Error generating SSL certificate:', error.message);
  console.error('\n   Make sure OpenSSL is installed on your system:');
  console.error('   - Windows: Install Git Bash (includes OpenSSL)');
  console.error('   - Mac: brew install openssl');
  console.error('   - Linux: sudo apt-get install openssl\n');
  process.exit(1);
}
