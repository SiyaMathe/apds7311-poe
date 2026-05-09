/**
 * src/app/services/auth.service.ts
 * ============================================================
 * Authentication Service
 * 
 * This service handles all authentication logic:
 * - User registration
 * - User login / logout
 * - JWT token storage and retrieval
 * - Authentication state management (BehaviorSubject)
 * - Persisting login state across page refreshes
 * 
 * ANGULAR SERVICES:
 * Services are singleton classes (one instance for the whole app).
 * providedIn: 'root' means Angular creates one instance and injects
 * it wherever it's needed. Components don't need to create instances.
 * 
 * RXJS OBSERVABLES:
 * Angular uses RxJS for async operations. Observables are streams
 * of data over time. HttpClient.post() returns an Observable that
 * emits the response when the server replies.
 * 
 * BehaviorSubject:
 * A special Observable that:
 * - Holds a current value
 * - Emits the current value immediately to new subscribers
 * - Allows updating the value with .next()
 * Used here to track if the user is currently logged in.
 * ============================================================
 */

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';

// TypeScript interfaces define the shape of our data objects
export interface User {
  _id: string;
  fullName: string;
  username: string;
  accountNumber: string;
  department: string;
  role: string;
  createdAt: string;
}

export interface AuthResponse {
  status: string;
  message: string;
  data: {
    token?: string;
    user: User;
  };
}

export interface LoginData {
  username: string;
  password: string;
}

export interface RegisterData {
  fullName: string;
  username: string;
  accountNumber: string;
  idNumber: string;
  password: string;
  department: string;
}

@Injectable({
  providedIn: 'root' // Singleton - one instance shared across the entire app
})
export class AuthService {

  // Base URL from environment configuration
  private apiUrl = `${environment.apiUrl}/users`;

  /**
   * LOCAL STORAGE KEYS
   * 
   * We store the JWT token and user data in localStorage so the
   * user stays logged in when they close and reopen the browser.
   * 
   * SECURITY CONSIDERATION:
   * localStorage is accessible to JavaScript on the same origin.
   * This is acceptable for SPAs but for very high-security apps,
   * httpOnly cookies (not accessible via JS) are preferred.
   * For this POE, localStorage is the standard approach taught.
   */
  private readonly TOKEN_KEY = 'apds7311_token';
  private readonly USER_KEY = 'apds7311_user';

  /**
   * BehaviorSubject to track authentication state.
   * 
   * - Initialized with the stored user (from localStorage) if one exists.
   *   This means if the user had previously logged in, they appear logged
   *   in immediately when the app loads (persisted authentication state).
   * - When user logs in: emit the user object
   * - When user logs out: emit null
   * 
   * currentUser$ (the Observable) is what components subscribe to.
   * They automatically update when the auth state changes.
   */
  private currentUserSubject = new BehaviorSubject<User | null>(
    this.getStoredUser()
  );

  // Public Observable that components can subscribe to
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(
    private http: HttpClient,  // Angular's HTTP client for API calls
    private router: Router     // For navigating after login/logout
  ) {}

  // ============================================================
  // REGISTRATION
  // ============================================================

  /**
   * register - Sends registration data to the API
   * 
   * @param data - User registration form data
   * @returns Observable<AuthResponse>
   * 
   * The .pipe(tap()) operator lets us "tap into" the response
   * stream to perform side effects (like storing data) without
   * modifying the response itself.
   */
  register(data: RegisterData): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/register`, data);
    // Note: We don't auto-login on register. User must login separately.
  }

  // ============================================================
  // LOGIN
  // ============================================================

  /**
   * login - Authenticates user and stores JWT token
   * 
   * On success:
   * 1. Store the JWT token in localStorage
   * 2. Store the user object in localStorage
   * 3. Update the BehaviorSubject (triggers UI updates)
   * 
   * @param data - { username, password }
   * @returns Observable<AuthResponse>
   */
  login(data: LoginData): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/login`, data).pipe(
      tap((response) => {
        if (response.status === 'success' && response.data.token) {
          // Store JWT token for use in HTTP interceptor
          this.storeToken(response.data.token);
          // Store user data for display in the UI
          this.storeUser(response.data.user);
          // Update the reactive state (all subscribers notified)
          this.currentUserSubject.next(response.data.user);
        }
      })
    );
  }

  // ============================================================
  // LOGOUT
  // ============================================================

  /**
   * logout - Clears all auth data and redirects to login
   * 
   * WHAT HAPPENS TO THE JWT?
   * JWTs are stateless - the server doesn't store them.
   * "Logging out" on the client just means deleting the token
   * from localStorage. The token technically remains valid until
   * it expires, but without it in storage, it can't be used.
   * 
   * For high-security apps: implement a token blacklist on the server.
   */
  logout(): void {
    // Clear all stored auth data
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    
    // Update reactive state - all subscribers notified
    this.currentUserSubject.next(null);
    
    // Redirect to login page
    this.router.navigate(['/login']);
  }

  // ============================================================
  // GETTERS
  // ============================================================

  /**
   * getToken - Retrieve the stored JWT token
   * 
   * Used by the HTTP Interceptor to attach the token to every
   * outgoing API request in the Authorization header.
   */
  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  /**
   * isAuthenticated - Check if user is currently logged in
   * 
   * A user is authenticated if:
   * 1. A token exists in localStorage
   * 2. The BehaviorSubject has a user value
   * 
   * Note: This is a client-side check. The server always
   * verifies the JWT independently on every request.
   */
  isAuthenticated(): boolean {
    const token = this.getToken();
    const user = this.currentUserSubject.value;
    return !!(token && user);
  }

  /**
   * getCurrentUser - Get the currently logged-in user synchronously
   */
  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  // ============================================================
  // PRIVATE HELPERS
  // ============================================================

  /**
   * storeToken - Save JWT to localStorage
   */
  private storeToken(token: string): void {
    localStorage.setItem(this.TOKEN_KEY, token);
  }

  /**
   * storeUser - Save user data to localStorage
   * 
   * JSON.stringify converts the User object to a string
   * (localStorage only stores strings).
   */
  private storeUser(user: User): void {
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
  }

  /**
   * getStoredUser - Retrieve user from localStorage
   * 
   * Used to initialize the BehaviorSubject when the app loads.
   * This is how we "persist login state" - reloading the page
   * still shows the user as logged in.
   * 
   * JSON.parse converts the stored string back to a User object.
   */
  private getStoredUser(): User | null {
    try {
      const userStr = localStorage.getItem(this.USER_KEY);
      return userStr ? JSON.parse(userStr) : null;
    } catch {
      // If parsing fails (corrupted data), clear storage and return null
      localStorage.removeItem(this.USER_KEY);
      return null;
    }
  }
}
