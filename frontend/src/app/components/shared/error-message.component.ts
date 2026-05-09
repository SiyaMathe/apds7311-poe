/**
 * src/app/components/shared/error-message/error-message.component.ts
 * ============================================================
 * Custom Error Message Component
 * 
 * A reusable component for displaying error and success messages
 * consistently across the application.
 * 
 * WHY A CUSTOM ERROR COMPONENT?
 * The POE requirement states: "Error messages are displayed using
 * a custom component." This allows us to:
 * 1. Display errors consistently (same styling everywhere)
 * 2. Handle multiple error messages from the API
 * 3. Auto-dismiss messages after a timeout
 * 4. Differentiate between error and success states
 * 
 * SECURITY BENEFIT:
 * Centralizing error display prevents developers from accidentally
 * displaying raw error objects (which might expose stack traces or
 * sensitive system information to users).
 * 
 * USAGE:
 * <app-error-message 
 *   [message]="errorMessage" 
 *   [errors]="errorList"
 *   [type]="'error'"
 *   (dismissed)="onDismiss()">
 * </app-error-message>
 * ============================================================
 */

import { Component, Input, Output, EventEmitter, OnInit, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-error-message',
  standalone: true,
  imports: [CommonModule],
  template: `
    <!-- Only show if there's a message to display -->
    <div *ngIf="message || (errors && errors.length > 0)" 
         class="alert-container"
         [class.alert-error]="type === 'error'"
         [class.alert-success]="type === 'success'"
         [class.alert-warning]="type === 'warning'"
         role="alert"
         aria-live="polite">
      
      <!-- Alert icon -->
      <div class="alert-icon">
        <span *ngIf="type === 'error'">⚠️</span>
        <span *ngIf="type === 'success'">✅</span>
        <span *ngIf="type === 'warning'">⚡</span>
      </div>
      
      <!-- Main message -->
      <div class="alert-content">
        <p class="alert-message" *ngIf="message">{{ message }}</p>
        
        <!-- List of validation errors (when API returns multiple) -->
        <ul class="alert-errors" *ngIf="errors && errors.length > 0">
          <li *ngFor="let error of errors">{{ error }}</li>
        </ul>
      </div>
      
      <!-- Dismiss button -->
      <button class="alert-dismiss" 
              (click)="dismiss()" 
              aria-label="Close alert"
              type="button">✕</button>
    </div>
  `,
  styles: [`
    .alert-container {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 14px 16px;
      border-radius: 8px;
      margin-bottom: 16px;
      border-left: 4px solid;
      animation: slideIn 0.3s ease-out;
    }

    @keyframes slideIn {
      from { opacity: 0; transform: translateY(-8px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    .alert-error {
      background: #fef2f2;
      border-color: #ef4444;
      color: #991b1b;
    }

    .alert-success {
      background: #f0fdf4;
      border-color: #22c55e;
      color: #166534;
    }

    .alert-warning {
      background: #fffbeb;
      border-color: #f59e0b;
      color: #92400e;
    }

    .alert-icon {
      font-size: 16px;
      flex-shrink: 0;
      margin-top: 1px;
    }

    .alert-content {
      flex: 1;
    }

    .alert-message {
      margin: 0;
      font-size: 14px;
      font-weight: 500;
      line-height: 1.4;
    }

    .alert-errors {
      margin: 6px 0 0;
      padding-left: 18px;
      font-size: 13px;
    }

    .alert-errors li {
      margin-bottom: 2px;
    }

    .alert-dismiss {
      background: none;
      border: none;
      cursor: pointer;
      font-size: 14px;
      color: inherit;
      opacity: 0.7;
      padding: 0;
      line-height: 1;
      flex-shrink: 0;
      margin-top: 1px;
      transition: opacity 0.2s;
    }

    .alert-dismiss:hover {
      opacity: 1;
    }
  `]
})
export class ErrorMessageComponent implements OnChanges {
  
  /** The main message to display */
  @Input() message: string = '';
  
  /** Array of validation errors (from API response) */
  @Input() errors: string[] = [];
  
  /** Alert type: 'error' | 'success' | 'warning' */
  @Input() type: 'error' | 'success' | 'warning' = 'error';
  
  /** Auto-dismiss after this many milliseconds (0 = don't auto-dismiss) */
  @Input() autoDismissMs: number = 0;
  
  /** Emit event when the alert is dismissed */
  @Output() dismissed = new EventEmitter<void>();

  private dismissTimer: any;

  ngOnChanges(): void {
    // When message changes, set up auto-dismiss if configured
    if (this.autoDismissMs > 0 && (this.message || this.errors?.length > 0)) {
      clearTimeout(this.dismissTimer);
      this.dismissTimer = setTimeout(() => this.dismiss(), this.autoDismissMs);
    }
  }

  /**
   * dismiss - Clear the message and emit the dismissed event
   */
  dismiss(): void {
    this.message = '';
    this.errors = [];
    this.dismissed.emit();
    clearTimeout(this.dismissTimer);
  }
}
