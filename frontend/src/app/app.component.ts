/**
 * src/app/app.component.ts
 * ============================================================
 * Root Application Component
 *
 * The top-level shell component. Angular bootstraps this first.
 * <router-outlet> is the placeholder where Angular renders
 * whichever component matches the current URL.
 *
 * URL = /login     → LoginComponent renders inside router-outlet
 * URL = /register  → RegisterComponent renders inside router-outlet
 * URL = /dashboard → PostsComponent renders inside router-outlet
 * ============================================================
 */

import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `<router-outlet></router-outlet>`,
  styles: [`
    :host { display: block; min-height: 100vh; }
  `]
})
export class AppComponent {
  title = 'APDS7311 Government Bulletin Board';
}
