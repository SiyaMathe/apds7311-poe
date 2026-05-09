/**
 * src/app/app.routes.ts
 * ============================================================
 * Angular Application Routes
 *
 * Defines the URL structure and which component loads per URL.
 *
 * LAZY LOADING (loadComponent):
 * Each route loads its component only when the user navigates
 * to that route. This speeds up the initial app load because
 * only the login page JS is downloaded at startup.
 *
 * ROUTE PROTECTION:
 * canActivate: [AuthGuard] on /dashboard means the AuthGuard
 * checks authentication before showing that page. Unauthenticated
 * users are redirected to /login automatically.
 * ============================================================
 */

import { Routes } from '@angular/router';
import { AuthGuard } from './guards/auth.guard';

export const routes: Routes = [
  // Default → redirect to login
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full'
  },

  // Login page — public
  {
    path: 'login',
    loadComponent: () =>
      import('./components/auth/login.component').then(m => m.LoginComponent),
    title: 'Login — Government Bulletin Board'
  },

  // Register page — public
  {
    path: 'register',
    loadComponent: () =>
      import('./components/auth/register.component').then(m => m.RegisterComponent),
    title: 'Register — Government Bulletin Board'
  },

  /**
   * Dashboard — PROTECTED
   * AuthGuard.canActivate() runs first.
   * → authenticated : component loads
   * → not authenticated : redirect to /login?returnUrl=/dashboard
   */
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./components/posts/posts.component').then(m => m.PostsComponent),
    canActivate: [AuthGuard],
    title: 'Dashboard — Government Bulletin Board'
  },

  // Catch-all: unknown URLs redirect to login
  {
    path: '**',
    redirectTo: 'login'
  }
];
