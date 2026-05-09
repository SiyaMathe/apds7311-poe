/**
 * src/main.ts
 * ============================================================
 * Application Bootstrap Entry Point
 *
 * The very first file Angular executes. It bootstraps the app
 * by attaching AppComponent to the <app-root> element in index.html,
 * using the providers registered in appConfig.
 * ============================================================
 */

import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

bootstrapApplication(AppComponent, appConfig)
  .catch(err => console.error('Bootstrap error:', err));
