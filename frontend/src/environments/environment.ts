/**
 * src/environments/environment.ts
 * ============================================================
 * Development Environment Configuration
 * 
 * This file contains environment-specific settings.
 * Angular replaces this with environment.prod.ts during
 * production builds (ng build --configuration production).
 * 
 * HOW ANGULAR ENVIRONMENTS WORK:
 * - environment.ts    → used when running 'ng serve' (development)
 * - environment.prod.ts → used when running 'ng build' (production)
 * - The angular.json file maps these automatically
 * ============================================================
 */

export const environment = {
  production: true,
  
  /**
   * API Base URL - points to our Express backend
   * 
   * In development: localhost:3000 (Express server)
   * In production: Replace with your actual domain
   * 
   * We use HTTPS even in dev (with self-signed cert).
   * The browser will warn about the self-signed cert -
   * you need to visit https://localhost:3000 and accept it once.
   */
  apiUrl: 'https://localhost:3000/api',
  // For HTTP development (if SSL not set up yet):
  // apiUrl: 'http://localhost:3000/api',
};
