/**
 * src/app/guards/auth.guard.ts
 * ============================================================
 * Authentication Route Guard
 * 
 * A Route Guard controls whether a user can navigate to a route.
 * 
 * HOW IT WORKS:
 * 1. User tries to navigate to a protected route (e.g., /dashboard)
 * 2. Angular's router calls the guard's canActivate() method
 * 3. If it returns true: navigation proceeds
 * 4. If it returns false: navigation is blocked (redirected to /login)
 * 
 * WHY DO WE NEED THIS?
 * The backend protects data via JWT middleware.
 * But without a guard, an unauthenticated user could navigate to
 * /dashboard and see the component (just with no data loading).
 * The guard ensures the UI also reflects the auth state properly.
 * 
 * SECURITY NOTE:
 * Frontend guards are a UX improvement, NOT a security measure.
 * Real security is on the backend (JWT verification).
 * A determined attacker could bypass frontend guards by modifying
 * JavaScript. That's why backend auth is essential.
 * ============================================================
 */

import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  /**
   * canActivate - Called by Angular router before activating a route
   * 
   * @param route - The route being navigated to
   * @param state - The router state (contains the target URL)
   * @returns boolean - true to allow, false to block navigation
   */
  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): boolean {
    
    // Check if user has a valid session
    if (this.authService.isAuthenticated()) {
      return true; // ✅ Allow navigation
    }

    /**
     * ❌ Not authenticated - redirect to login
     * 
     * We store the attempted URL as a query parameter.
     * After successful login, we can redirect the user
     * back to where they were trying to go.
     * 
     * Example: User tries to go to /dashboard
     * → Redirected to /login?returnUrl=/dashboard
     * → After login, redirected back to /dashboard
     */
    this.router.navigate(['/login'], {
      queryParams: { returnUrl: state.url }
    });
    
    return false; // Block navigation
  }
}
