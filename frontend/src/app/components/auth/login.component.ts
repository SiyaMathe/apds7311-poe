/**
 * src/app/components/auth/login.component.ts
 * User Login Component — password obscuring, anti-harvesting errors, JWT persistence.
 */

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ErrorMessageComponent } from '../shared/error-message.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, ErrorMessageComponent],
  template: `
    <div class="auth-page">
      <div class="auth-card">
        <div class="auth-header">
          <div class="gov-badge">🏛️ SECURE ACCESS</div>
          <h1>Government Portal</h1>
          <p>Inter-Departmental Bulletin Board</p>
        </div>

        <app-error-message
          [message]="errorMessage"
          [type]="'error'"
          (dismissed)="errorMessage = ''">
        </app-error-message>

        <app-error-message
          *ngIf="sessionExpired"
          message="Your session has expired. Please log in again."
          [type]="'warning'"
          (dismissed)="sessionExpired = false">
        </app-error-message>

        <form [formGroup]="loginForm" (ngSubmit)="onSubmit()" novalidate>

          <div class="form-group">
            <label for="username">Username</label>
            <input id="username" type="text" formControlName="username"
              placeholder="Enter your username"
              [class.input-error]="isFieldInvalid('username')"
              autocomplete="username" autofocus>
            <div class="field-error" *ngIf="isFieldInvalid('username')">
              Please enter your username
            </div>
          </div>

          <div class="form-group">
            <label for="password">Password</label>
            <div class="password-wrapper">
              <input id="password"
                [type]="showPassword ? 'text' : 'password'"
                formControlName="password"
                placeholder="Enter your password"
                [class.input-error]="isFieldInvalid('password')"
                autocomplete="current-password">
              <button type="button" class="toggle-password"
                (click)="togglePasswordVisibility()"
                [attr.aria-label]="showPassword ? 'Hide password' : 'Show password'">
                {{ showPassword ? '🙈' : '👁️' }}
              </button>
            </div>
            <div class="field-error" *ngIf="isFieldInvalid('password')">
              Please enter your password
            </div>
          </div>

          <button type="submit" class="btn-primary"
            [disabled]="isLoading || loginForm.invalid">
            <span *ngIf="!isLoading">Sign In</span>
            <span *ngIf="isLoading">⟳ Authenticating...</span>
          </button>
        </form>

        <div class="auth-footer">
          <p>Don't have an account? <a routerLink="/register">Register</a></p>
          <p class="security-notice">🔒 Authorised personnel only. All access is logged.</p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .auth-page {
      min-height: 100vh; display: flex; align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%);
      padding: 24px 16px; font-family: 'Georgia', serif;
    }
    .auth-card {
      background: white; border-radius: 12px; padding: 44px 40px;
      width: 100%; max-width: 420px;
      box-shadow: 0 25px 50px rgba(0,0,0,0.5);
      animation: fadeUp 0.4s ease-out;
    }
    @keyframes fadeUp {
      from { opacity: 0; transform: translateY(20px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .auth-header { text-align: center; margin-bottom: 32px; }
    .gov-badge {
      display: inline-block; background: #0f172a; color: #fbbf24;
      font-size: 10px; font-weight: bold; letter-spacing: 3px;
      padding: 5px 14px; border-radius: 4px; margin-bottom: 14px;
      border: 1px solid #fbbf24;
    }
    .auth-header h1 { font-size: 26px; color: #0f172a; margin: 0 0 6px; font-weight: 700; }
    .auth-header p  { color: #64748b; font-size: 13px; margin: 0; }
    .form-group { margin-bottom: 20px; }
    label { display: block; font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 7px; }
    input {
      width: 100%; padding: 11px 14px; border: 1.5px solid #d1d5db;
      border-radius: 8px; font-size: 14px; transition: all 0.2s;
      box-sizing: border-box; background: #f9fafb; color: #111827;
    }
    input:focus { outline: none; border-color: #1e3a5f; background: white; }
    .input-error { border-color: #ef4444 !important; }
    .field-error { font-size: 12px; color: #ef4444; margin-top: 5px; }
    .password-wrapper { position: relative; }
    .password-wrapper input { padding-right: 46px; }
    .toggle-password {
      position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
      background: none; border: none; cursor: pointer; font-size: 18px; padding: 2px;
    }
    .btn-primary {
      width: 100%; padding: 13px; background: #1e3a5f; color: white;
      border: none; border-radius: 8px; font-size: 15px; font-weight: 600;
      cursor: pointer; transition: all 0.2s; margin-top: 4px;
    }
    .btn-primary:hover:not(:disabled) { background: #0f2744; transform: translateY(-1px); }
    .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
    .auth-footer { text-align: center; margin-top: 24px; }
    .auth-footer p { font-size: 13px; color: #6b7280; margin: 8px 0; }
    .auth-footer a { color: #1e3a5f; font-weight: 600; text-decoration: none; }
    .security-notice { font-size: 11px !important; color: #9ca3af !important; }
  `]
})
export class LoginComponent implements OnInit {

  loginForm!: FormGroup;
  isLoading = false;
  errorMessage = '';
  showPassword = false;
  sessionExpired = false;
  private returnUrl = '/dashboard';

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    if (this.authService.isAuthenticated()) {
      this.router.navigate(['/dashboard']);
      return;
    }
    this.returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/dashboard';
    this.sessionExpired = this.route.snapshot.queryParams['expired'] === 'true';
    this.loginForm = this.fb.group({
      username: ['', [Validators.required, Validators.maxLength(100)]],
      password: ['', [Validators.required, Validators.maxLength(200)]]
    });
  }

  onSubmit(): void {
    this.loginForm.markAllAsTouched();
    if (this.loginForm.invalid) return;
    this.isLoading = true;
    this.errorMessage = '';

    const { username, password } = this.loginForm.value as { username: string; password: string };

    this.authService.login({ username: username.toLowerCase(), password }).subscribe({
      next: (_response: unknown) => {
        this.isLoading = false;
        this.router.navigate([this.returnUrl]);
      },
      error: (error: { status: number; error?: { message?: string } }) => {
        this.isLoading = false;
        if (error.status === 429) {
          this.errorMessage = error.error?.message || 'Too many attempts. Please wait.';
        } else if (error.status === 423) {
          this.errorMessage = error.error?.message || 'Account temporarily locked.';
        } else {
          this.errorMessage = error.error?.message || 'Invalid credentials. Please check your username and password.';
        }
      }
    });
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.loginForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  togglePasswordVisibility(): void { this.showPassword = !this.showPassword; }
}
