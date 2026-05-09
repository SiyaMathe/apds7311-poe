/**
 * src/app/app.config.ts
 * ============================================================
 * Angular Application Configuration (Angular 17+ Standalone API)
 *
 * Replaces the old NgModule-based AppModule.
 * Registers all app-wide providers: router, HTTP client,
 * interceptors, and animations.
 *
 * withInterceptors([jwtInterceptorFn]) registers our JWT interceptor
 * so it automatically runs on EVERY outgoing HTTP request —
 * no need to manually add the Authorization header in each service.
 * ============================================================
 */

import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import {
  provideHttpClient,
  withInterceptors,
  withFetch
} from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';

import { routes } from './app.routes';
import { jwtInterceptorFn } from './interceptors/jwt.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    // Register all application routes
    provideRouter(routes),

    /**
     * HttpClient with our JWT interceptor pipeline.
     *
     * Every HttpClient call (get, post, delete, etc.) automatically
     * passes through jwtInterceptorFn, which adds:
     *   Authorization: Bearer <token>
     *
     * withFetch() uses the browser's native Fetch API (faster
     * than the legacy XmlHttpRequest in modern browsers).
     */
    provideHttpClient(
      withInterceptors([jwtInterceptorFn]),
      withFetch()
    ),

    // Enable Angular animations
    provideAnimations(),
  ]
};
