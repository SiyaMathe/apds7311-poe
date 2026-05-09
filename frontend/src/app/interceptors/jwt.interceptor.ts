/**
 * src/app/interceptors/jwt.interceptor.ts
 * Functional interceptor (Angular 17 withInterceptors API)
 * Attaches JWT Bearer token to every outgoing HTTP request.
 */

import { inject } from '@angular/core';
import {
  HttpRequest,
  HttpHandlerFn,
  HttpEvent,
  HttpErrorResponse,
  HttpInterceptorFn
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const jwtInterceptorFn: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
): Observable<HttpEvent<unknown>> => {

  const authService = inject(AuthService);
  const router = inject(Router);
  const token = authService.getToken();

  // Clone the request and add Authorization header if token exists
  if (token) {
    req = req.clone({
      setHeaders: { Authorization: `Bearer ${token}` }
    });
  }

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      // Auto-logout on 401 (expired/invalid token)
      if (error.status === 401 && authService.isAuthenticated()) {
        authService.logout();
        router.navigate(['/login'], { queryParams: { expired: 'true' } });
      }
      return throwError(() => error);
    })
  );
};
