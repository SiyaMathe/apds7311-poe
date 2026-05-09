/**
 * src/app/components/auth/register.component.ts
 * User Registration Component — whitelist validation, password strength, obscuring.
 */

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule, FormBuilder, FormGroup,
  Validators, AbstractControl
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ErrorMessageComponent } from '../shared/error-message.component';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, ErrorMessageComponent],
  template: `
    <div class="auth-page">
      <div class="auth-card">
        <div class="auth-header">
          <div class="gov-badge">🏛️ CLASSIFIED</div>
          <h1>Create Account</h1>
          <p>Inter-Departmental Bulletin Board</p>
        </div>

        <app-error-message [message]="errorMessage" [errors]="errorList"
          [type]="'error'" (dismissed)="clearError()">
        </app-error-message>
        <app-error-message [message]="successMessage" [type]="'success'" [autoDismissMs]="3000">
        </app-error-message>

        <form [formGroup]="registerForm" (ngSubmit)="onSubmit()" novalidate>

          <div class="form-group">
            <label for="fullName">Full Name</label>
            <input id="fullName" type="text" formControlName="fullName"
              placeholder="e.g. John Smith"
              [class.input-error]="isFieldInvalid('fullName')" autocomplete="name">
            <div class="field-error" *ngIf="isFieldInvalid('fullName')">
              <span *ngIf="getField('fullName')?.errors?.['required']">Full name is required</span>
              <span *ngIf="getField('fullName')?.errors?.['pattern']">Only letters, spaces, hyphens allowed</span>
            </div>
          </div>

          <div class="form-group">
            <label for="username">Username</label>
            <input id="username" type="text" formControlName="username"
              placeholder="e.g. jsmith_gov"
              [class.input-error]="isFieldInvalid('username')" autocomplete="username">
            <div class="field-hint">Letters, numbers, underscores, hyphens only (3–30 chars)</div>
            <div class="field-error" *ngIf="isFieldInvalid('username')">
              <span *ngIf="getField('username')?.errors?.['required']">Username is required</span>
              <span *ngIf="getField('username')?.errors?.['pattern']">Only letters, numbers, _ and - allowed</span>
            </div>
          </div>

          <div class="form-group">
            <label for="accountNumber">Account Number</label>
            <input id="accountNumber" type="text" formControlName="accountNumber"
              placeholder="e.g. GOV123456"
              [class.input-error]="isFieldInvalid('accountNumber')" autocomplete="off">
            <div class="field-hint">6–12 uppercase letters and numbers</div>
            <div class="field-error" *ngIf="isFieldInvalid('accountNumber')">
              <span *ngIf="getField('accountNumber')?.errors?.['required']">Account number is required</span>
              <span *ngIf="getField('accountNumber')?.errors?.['pattern']">Format: GOV123456 (6–12 uppercase letters/numbers)</span>
            </div>
          </div>

          <div class="form-group">
            <label for="idNumber">SA ID Number</label>
            <input id="idNumber" type="text" formControlName="idNumber"
              placeholder="13-digit ID number"
              [class.input-error]="isFieldInvalid('idNumber')" autocomplete="off" maxlength="13">
            <div class="field-error" *ngIf="isFieldInvalid('idNumber')">
              <span *ngIf="getField('idNumber')?.errors?.['required']">ID number is required</span>
              <span *ngIf="getField('idNumber')?.errors?.['pattern']">Must be exactly 13 digits</span>
            </div>
          </div>

          <div class="form-group">
            <label for="department">Department</label>
            <select id="department" formControlName="department"
              [class.input-error]="isFieldInvalid('department')">
              <option value="">-- Select Department --</option>
              <option *ngFor="let dept of departments" [value]="dept">{{ dept }}</option>
            </select>
            <div class="field-error" *ngIf="isFieldInvalid('department')">Department is required</div>
          </div>

          <div class="form-group">
            <label for="password">Password</label>
            <div class="password-wrapper">
              <input id="password"
                [type]="showPassword ? 'text' : 'password'"
                formControlName="password" placeholder="Create a strong password"
                [class.input-error]="isFieldInvalid('password')" autocomplete="new-password">
              <button type="button" class="toggle-password" (click)="togglePassword()"
                [attr.aria-label]="showPassword ? 'Hide password' : 'Show password'">
                {{ showPassword ? '🙈' : '👁️' }}
              </button>
            </div>
            <div class="password-strength" *ngIf="getField('password')?.value">
              <div class="strength-bar">
                <div class="strength-fill" [style.width]="passwordStrength + '%'"
                  [class.weak]="passwordStrength < 40"
                  [class.medium]="passwordStrength >= 40 && passwordStrength < 80"
                  [class.strong]="passwordStrength >= 80"></div>
              </div>
              <span class="strength-label">{{ passwordStrengthLabel }}</span>
            </div>
            <div>Min 8 chars: uppercase, lowercase, number, special char (!&#64;#$%)</div>
            <div class="field-error" *ngIf="isFieldInvalid('password')">
              <span *ngIf="getField('password')?.errors?.['required']">Password is required</span>
              <span *ngIf="getField('password')?.errors?.['minlength']">At least 8 characters required</span>
              <span *ngIf="getField('password')?.errors?.['pattern']">Must include uppercase, lowercase, number and special character</span>
            </div>
          </div>

          <div class="form-group">
            <label for="confirmPassword">Confirm Password</label>
            <div class="password-wrapper">
              <input id="confirmPassword"
                [type]="showConfirmPassword ? 'text' : 'password'"
                formControlName="confirmPassword" placeholder="Repeat your password"
                [class.input-error]="registerForm.errors?.['passwordMismatch'] && getField('confirmPassword')?.touched"
                autocomplete="new-password">
              <button type="button" class="toggle-password" (click)="toggleConfirmPassword()"
                [attr.aria-label]="showConfirmPassword ? 'Hide password' : 'Show password'">
                {{ showConfirmPassword ? '🙈' : '👁️' }}
              </button>
            </div>
            <div class="field-error" *ngIf="registerForm.errors?.['passwordMismatch'] && getField('confirmPassword')?.touched">
              Passwords do not match
            </div>
          </div>

          <button type="submit" class="btn-primary" [disabled]="isLoading || registerForm.invalid">
            <span *ngIf="!isLoading">Create Account</span>
            <span *ngIf="isLoading">⟳ Creating account...</span>
          </button>
        </form>

        <div class="auth-footer">
          Already have an account? <a routerLink="/login">Sign in</a>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .auth-page {
      min-height: 100vh; display: flex; align-items: center; justify-content: center;
      background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%);
      padding: 24px 16px; font-family: 'Georgia', serif;
    }
    .auth-card {
      background: white; border-radius: 12px; padding: 40px;
      width: 100%; max-width: 520px; box-shadow: 0 25px 50px rgba(0,0,0,0.4);
    }
    .auth-header { text-align: center; margin-bottom: 28px; }
    .gov-badge {
      display: inline-block; background: #1e3a5f; color: #fbbf24;
      font-size: 11px; font-weight: bold; letter-spacing: 2px;
      padding: 4px 12px; border-radius: 4px; margin-bottom: 12px;
    }
    .auth-header h1 { font-size: 24px; color: #0f172a; margin: 0 0 4px; }
    .auth-header p  { color: #64748b; font-size: 13px; margin: 0; }
    .form-group { margin-bottom: 18px; }
    label { display: block; font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 6px; }
    input, select {
      width: 100%; padding: 10px 14px; border: 1.5px solid #d1d5db;
      border-radius: 7px; font-size: 14px; transition: border-color 0.2s;
      box-sizing: border-box; background: #f9fafb;
    }
    input:focus, select:focus { outline: none; border-color: #1e3a5f; background: white; }
    .input-error { border-color: #ef4444 !important; }
    .field-error { font-size: 12px; color: #ef4444; margin-top: 4px; }
    .field-hint  { font-size: 11px; color: #9ca3af; margin-top: 4px; }
    .password-wrapper { position: relative; }
    .password-wrapper input { padding-right: 44px; }
    .toggle-password {
      position: absolute; right: 10px; top: 50%; transform: translateY(-50%);
      background: none; border: none; cursor: pointer; font-size: 16px; padding: 4px;
    }
    .password-strength { margin-top: 8px; }
    .strength-bar { height: 4px; background: #e5e7eb; border-radius: 2px; margin-bottom: 4px; }
    .strength-fill { height: 100%; border-radius: 2px; transition: width 0.3s, background 0.3s; }
    .strength-fill.weak   { background: #ef4444; }
    .strength-fill.medium { background: #f59e0b; }
    .strength-fill.strong { background: #22c55e; }
    .strength-label { font-size: 11px; color: #6b7280; }
    .btn-primary {
      width: 100%; padding: 13px; background: #1e3a5f; color: white;
      border: none; border-radius: 8px; font-size: 15px; font-weight: 600;
      cursor: pointer; transition: background 0.2s; margin-top: 8px;
    }
    .btn-primary:hover:not(:disabled) { background: #0f2744; }
    .btn-primary:disabled { opacity: 0.7; cursor: not-allowed; }
    .auth-footer { text-align: center; margin-top: 20px; font-size: 13px; color: #6b7280; }
    .auth-footer a { color: #1e3a5f; font-weight: 600; text-decoration: none; }
  `]
})
export class RegisterComponent implements OnInit {

  registerForm!: FormGroup;
  isLoading = false;
  errorMessage = '';
  errorList: string[] = [];
  successMessage = '';
  showPassword = false;
  showConfirmPassword = false;

  departments = [
    'Finance','Health','Education','Defence','Justice',
    'Home Affairs','Transport','Agriculture','Energy','IT Administration'
  ];

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    if (this.authService.isAuthenticated()) {
      this.router.navigate(['/dashboard']);
      return;
    }
    this.registerForm = this.fb.group({
      fullName:        ['', [Validators.required, Validators.minLength(2), Validators.pattern(/^[a-zA-Z\s'-]{2,100}$/)]],
      username:        ['', [Validators.required, Validators.minLength(3), Validators.pattern(/^[a-zA-Z0-9_-]{3,30}$/)]],
      accountNumber:   ['', [Validators.required, Validators.pattern(/^[A-Z0-9]{6,12}$/)]],
      idNumber:        ['', [Validators.required, Validators.pattern(/^\d{13}$/)]],
      department:      ['', Validators.required],
      password:        ['', [Validators.required, Validators.minLength(8),
                             Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()\-_=+\[\]{};':"\\|,.<>/?]).{8,}$/)]],
      confirmPassword: ['', Validators.required],
    }, { validators: this.passwordMatchValidator });
  }

  passwordMatchValidator(control: AbstractControl): { [key: string]: boolean } | null {
    const pw  = control.get('password');
    const cpw = control.get('confirmPassword');
    if (pw && cpw && pw.value !== cpw.value) return { passwordMismatch: true };
    return null;
  }

  get passwordStrength(): number {
    const p = (this.getField('password')?.value as string) || '';
    let s = 0;
    if (p.length >= 8)        s += 25;
    if (/[A-Z]/.test(p))      s += 25;
    if (/[0-9]/.test(p))      s += 25;
    if (/[!@#$%^&*]/.test(p)) s += 25;
    return s;
  }
  get passwordStrengthLabel(): string {
    const s = this.passwordStrength;
    if (s < 40) return 'Weak';
    if (s < 80) return 'Medium';
    return 'Strong';
  }

  onSubmit(): void {
    this.registerForm.markAllAsTouched();
    if (this.registerForm.invalid) return;
    this.isLoading = true;
    this.clearError();

    const v = this.registerForm.value as {
      fullName: string; username: string; accountNumber: string;
      idNumber: string; password: string; department: string;
    };

    this.authService.register({
      ...v,
      username:      v.username.toLowerCase(),
      accountNumber: v.accountNumber.toUpperCase()
    }).subscribe({
      next: (_response: unknown) => {
        this.isLoading = false;
        this.successMessage = 'Account created! Redirecting to login...';
        setTimeout(() => this.router.navigate(['/login']), 2000);
      },
      error: (error: { error?: { message?: string; errors?: string[] } }) => {
        this.isLoading = false;
        this.errorMessage = error.error?.message || 'Registration failed. Please try again.';
        this.errorList    = error.error?.errors  || [];
      }
    });
  }

  isFieldInvalid(name: string): boolean {
    const f = this.getField(name);
    return !!(f && f.invalid && (f.dirty || f.touched));
  }
  getField(name: string) { return this.registerForm.get(name); }
  togglePassword():        void { this.showPassword        = !this.showPassword; }
  toggleConfirmPassword(): void { this.showConfirmPassword = !this.showConfirmPassword; }
  clearError():            void { this.errorMessage = ''; this.errorList = []; }
}
