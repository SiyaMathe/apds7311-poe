/**
 * src/app/components/posts/posts.component.ts
 * Dashboard — display, create, and delete bulletin board posts.
 */

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { PostService, Post } from '../../services/post.service';
import { AuthService, User } from '../../services/auth.service';
import { ErrorMessageComponent } from '../shared/error-message.component';

@Component({
  selector: 'app-posts',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ErrorMessageComponent],
  template: `
    <div class="dashboard">
      <nav class="navbar">
        <div class="nav-left">
          <span class="nav-logo">🏛️</span>
          <div>
            <span class="nav-title">Government Bulletin Board</span>
            <span class="nav-subtitle">CLASSIFIED — AUTHORISED PERSONNEL ONLY</span>
          </div>
        </div>
        <div class="nav-right">
          <span class="nav-user" *ngIf="currentUser">{{ currentUser.fullName }} | {{ currentUser.department }}</span>
          <button class="btn-logout" (click)="logout()">Sign Out</button>
        </div>
      </nav>

      <div class="content">
        <aside class="sidebar">
          <div class="card">
            <h2 class="card-title">📝 New Post</h2>
            <app-error-message [message]="createError" [errors]="createErrors"
              [type]="'error'" (dismissed)="createError = ''">
            </app-error-message>
            <app-error-message [message]="createSuccess" [type]="'success'"
              [autoDismissMs]="3000" (dismissed)="createSuccess = ''">
            </app-error-message>

            <form [formGroup]="postForm" (ngSubmit)="createPost()" novalidate>
              <div class="form-group">
                <label>Title</label>
                <input type="text" formControlName="title" placeholder="Post title..."
                  [class.input-error]="isFieldInvalid('title')">
                <div class="field-error" *ngIf="isFieldInvalid('title')">
                  <span *ngIf="postForm.get('title')?.errors?.['required']">Title is required</span>
                  <span *ngIf="postForm.get('title')?.errors?.['minlength']">At least 3 characters</span>
                </div>
              </div>

              <div class="form-group">
                <label>Category</label>
                <select formControlName="category" [class.input-error]="isFieldInvalid('category')">
                  <option value="">-- Select --</option>
                  <option *ngFor="let cat of categories" [value]="cat">{{ cat }}</option>
                </select>
                <div class="field-error" *ngIf="isFieldInvalid('category')">Category is required</div>
              </div>

              <div class="form-group">
                <label>Priority</label>
                <select formControlName="priority">
                  <option *ngFor="let p of priorities" [value]="p">{{ p }}</option>
                </select>
              </div>

              <div class="form-group">
                <label>Content</label>
                <textarea formControlName="content"
                  placeholder="Describe the inter-departmental issue..."
                  rows="5" [class.input-error]="isFieldInvalid('content')"></textarea>
                <div class="char-count">{{ postForm.get('content')?.value?.length || 0 }}/5000</div>
                <div class="field-error" *ngIf="isFieldInvalid('content')">
                  <span *ngIf="postForm.get('content')?.errors?.['required']">Content is required</span>
                  <span *ngIf="postForm.get('content')?.errors?.['minlength']">At least 10 characters</span>
                </div>
              </div>

              <button type="submit" class="btn-primary" [disabled]="isCreating || postForm.invalid">
                {{ isCreating ? '⟳ Posting...' : '📤 Publish Post' }}
              </button>
            </form>
          </div>
        </aside>

        <main class="main-content">
          <app-error-message [message]="loadError" [type]="'error'" (dismissed)="loadError = ''">
          </app-error-message>

          <div class="posts-header">
            <h2>📋 Bulletin Board <span class="post-count">({{ posts.length }} posts)</span></h2>
            <button class="btn-refresh" (click)="loadPosts()" [disabled]="isLoading">
              {{ isLoading ? '⟳' : '🔄' }} Refresh
            </button>
          </div>

          <div class="loading-state" *ngIf="isLoading">
            <div class="spinner"></div>
            <p>Loading classified posts...</p>
          </div>

          <div class="empty-state" *ngIf="!isLoading && posts.length === 0">
            <p>📭 No posts yet. Be the first to post an issue!</p>
          </div>

          <div class="posts-grid" *ngIf="!isLoading && posts.length > 0">
            <div class="post-card" *ngFor="let post of posts"
              [class]="'post-card priority-' + post.priority.toLowerCase()">

              <div class="post-header">
                <div class="post-meta">
                  <span class="priority-badge" [class]="'badge-' + post.priority.toLowerCase()">
                    {{ getPriorityIcon(post.priority) }} {{ post.priority }}
                  </span>
                  <span class="category-badge">{{ post.category }}</span>
                </div>
                <button class="btn-delete" *ngIf="canDelete(post)"
                  (click)="deletePost(post)" [disabled]="deletingId === post._id" title="Delete post">
                  {{ deletingId === post._id ? '⟳' : '🗑️' }}
                </button>
              </div>

              <h3 class="post-title">{{ post.title }}</h3>
              <p class="post-content">{{ post.content }}</p>

              <div class="post-footer">
                <div class="post-author">
                  <span class="author-avatar">{{ getInitials(post.authorName) }}</span>
                  <div>
                    <span class="author-name">{{ post.authorName }}</span>
                    <span class="author-dept">{{ post.authorDepartment }}</span>
                  </div>
                </div>
                <span class="post-date">{{ formatDate(post.createdAt) }}</span>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  `,
  styles: [`
    * { box-sizing: border-box; }
    .dashboard { min-height: 100vh; background: #f1f5f9; font-family: 'Georgia', serif; }
    .navbar {
      background: #0f172a; color: white; padding: 14px 24px;
      display: flex; justify-content: space-between; align-items: center;
      position: sticky; top: 0; z-index: 100; box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    }
    .nav-left { display: flex; align-items: center; gap: 12px; }
    .nav-logo  { font-size: 24px; }
    .nav-title    { display: block; font-size: 16px; font-weight: 700; }
    .nav-subtitle { display: block; font-size: 9px; letter-spacing: 2px; color: #fbbf24; }
    .nav-right { display: flex; align-items: center; gap: 16px; }
    .nav-user  { font-size: 12px; color: #94a3b8; }
    .btn-logout {
      background: transparent; border: 1px solid #475569; color: #94a3b8;
      padding: 6px 14px; border-radius: 6px; cursor: pointer; font-size: 12px; transition: all 0.2s;
    }
    .btn-logout:hover { background: #1e293b; color: white; }
    .content { display: flex; gap: 24px; padding: 24px; max-width: 1200px; margin: 0 auto; }
    .sidebar { width: 340px; flex-shrink: 0; }
    .main-content { flex: 1; }
    .card { background: white; border-radius: 12px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .card-title { font-size: 16px; font-weight: 700; color: #0f172a; margin: 0 0 20px; }
    .form-group { margin-bottom: 16px; }
    label { display: block; font-size: 12px; font-weight: 600; color: #374151; margin-bottom: 5px; text-transform: uppercase; letter-spacing: 0.5px; }
    input, select, textarea {
      width: 100%; padding: 9px 12px; border: 1.5px solid #e2e8f0;
      border-radius: 7px; font-size: 13px; font-family: inherit;
      transition: border-color 0.2s; resize: vertical; background: #f8fafc;
    }
    input:focus, select:focus, textarea:focus { outline: none; border-color: #1e3a5f; background: white; }
    .input-error { border-color: #ef4444 !important; }
    .field-error { font-size: 11px; color: #ef4444; margin-top: 3px; }
    .char-count  { font-size: 11px; color: #9ca3af; text-align: right; margin-top: 3px; }
    .btn-primary {
      width: 100%; padding: 11px; background: #1e3a5f; color: white;
      border: none; border-radius: 8px; font-size: 14px; font-weight: 600;
      cursor: pointer; transition: all 0.2s;
    }
    .btn-primary:hover:not(:disabled) { background: #0f2744; }
    .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
    .posts-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
    .posts-header h2 { font-size: 18px; color: #0f172a; margin: 0; }
    .post-count  { font-size: 14px; color: #64748b; font-weight: 400; }
    .btn-refresh {
      background: white; border: 1px solid #e2e8f0; padding: 7px 14px;
      border-radius: 7px; cursor: pointer; font-size: 13px; transition: all 0.2s;
    }
    .btn-refresh:hover { background: #f1f5f9; }
    .loading-state, .empty-state {
      text-align: center; padding: 48px; color: #64748b;
      background: white; border-radius: 12px;
    }
    .spinner {
      width: 40px; height: 40px; border: 3px solid #e2e8f0;
      border-top-color: #1e3a5f; border-radius: 50%;
      animation: spin 0.8s linear infinite; margin: 0 auto 16px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .posts-grid { display: flex; flex-direction: column; gap: 16px; }
    .post-card {
      background: white; border-radius: 12px; padding: 20px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.08); border-left: 4px solid #e2e8f0;
      transition: transform 0.2s, box-shadow 0.2s;
      animation: fadeIn 0.3s ease-out;
    }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
    .post-card:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.12); }
    .priority-critical { border-left-color: #ef4444; }
    .priority-high     { border-left-color: #f97316; }
    .priority-medium   { border-left-color: #3b82f6; }
    .priority-low      { border-left-color: #22c55e; }
    .post-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
    .post-meta   { display: flex; gap: 8px; flex-wrap: wrap; }
    .priority-badge, .category-badge {
      font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 4px;
    }
    .badge-critical { background: #fee2e2; color: #991b1b; }
    .badge-high     { background: #ffedd5; color: #9a3412; }
    .badge-medium   { background: #dbeafe; color: #1e40af; }
    .badge-low      { background: #dcfce7; color: #166534; }
    .category-badge { background: #f1f5f9; color: #475569; }
    .btn-delete {
      background: none; border: none; cursor: pointer; font-size: 16px;
      padding: 4px 6px; border-radius: 4px; transition: background 0.2s; opacity: 0.6;
    }
    .btn-delete:hover:not(:disabled) { background: #fee2e2; opacity: 1; }
    .post-title   { font-size: 16px; font-weight: 700; color: #0f172a; margin: 0 0 8px; }
    .post-content { font-size: 14px; color: #4b5563; margin: 0 0 16px; line-height: 1.6; }
    .post-footer  {
      display: flex; justify-content: space-between; align-items: center;
      border-top: 1px solid #f1f5f9; padding-top: 12px;
    }
    .post-author { display: flex; align-items: center; gap: 10px; }
    .author-avatar {
      width: 32px; height: 32px; background: #1e3a5f; color: white;
      border-radius: 50%; display: flex; align-items: center; justify-content: center;
      font-size: 12px; font-weight: 700; flex-shrink: 0;
    }
    .author-name { display: block; font-size: 13px; font-weight: 600; color: #374151; }
    .author-dept { display: block; font-size: 11px; color: #9ca3af; }
    .post-date   { font-size: 11px; color: #9ca3af; }
    @media (max-width: 768px) {
      .content { flex-direction: column; padding: 16px; }
      .sidebar { width: 100%; }
    }
  `]
})
export class PostsComponent implements OnInit {

  posts: Post[] = [];
  currentUser: User | null = null;
  isLoading = false;
  isCreating = false;
  deletingId: string | null = null;
  loadError = '';
  createError = '';
  createErrors: string[] = [];
  createSuccess = '';
  postForm!: FormGroup;

  categories = ['Policy','Infrastructure','Security','Finance','Health','Emergency','General'];
  priorities = ['Low','Medium','High','Critical'];

  constructor(
    private postService: PostService,
    private authService: AuthService,
    private fb: FormBuilder,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.currentUser = this.authService.getCurrentUser();
    this.postForm = this.fb.group({
      title:    ['', [Validators.required, Validators.minLength(3), Validators.maxLength(150)]],
      category: ['', Validators.required],
      priority: ['Medium'],
      content:  ['', [Validators.required, Validators.minLength(10), Validators.maxLength(5000)]]
    });
    this.loadPosts();
  }

  loadPosts(): void {
    this.isLoading = true;
    this.loadError = '';
    this.postService.getAllPosts().subscribe({
      next: (response) => {
        this.isLoading = false;
        this.posts = response.data?.posts || [];
      },
      error: (error: { error?: { message?: string } }) => {
        this.isLoading = false;
        this.loadError = error.error?.message || 'Failed to load posts. Please refresh.';
      }
    });
  }

  createPost(): void {
    this.postForm.markAllAsTouched();
    if (this.postForm.invalid) return;
    this.isCreating = true;
    this.createError = '';
    this.createErrors = [];

    this.postService.createPost(this.postForm.value as {
      title: string; category: string; priority: string; content: string;
    }).subscribe({
      next: (response) => {
        this.isCreating = false;
        this.createSuccess = 'Post published successfully!';
        this.postForm.reset({ priority: 'Medium' });
        if (response.data?.post) {
          this.posts.unshift(response.data.post);
        } else {
          this.loadPosts();
        }
      },
      error: (error: { error?: { message?: string; errors?: string[] } }) => {
        this.isCreating = false;
        this.createError  = error.error?.message || 'Failed to create post.';
        this.createErrors = error.error?.errors  || [];
      }
    });
  }

  deletePost(post: Post): void {
    if (!confirm(`Delete "${post.title}"? This cannot be undone.`)) return;
    this.deletingId = post._id;
    this.postService.deletePost(post._id).subscribe({
      next: () => {
        this.posts = this.posts.filter(p => p._id !== post._id);
        this.deletingId = null;
      },
      error: (error: { error?: { message?: string } }) => {
        this.deletingId = null;
        this.loadError = error.error?.message || 'Failed to delete post.';
      }
    });
  }

  canDelete(post: Post): boolean {
    if (!this.currentUser) return false;
    return post.author?._id === this.currentUser._id || this.currentUser.role === 'admin';
  }

  logout(): void { this.authService.logout(); }

  getPriorityIcon(priority: string): string {
    const icons: Record<string, string> = { Critical:'🔴', High:'🟠', Medium:'🔵', Low:'🟢' };
    return icons[priority] || '⚪';
  }
  getInitials(name: string): string {
    return (name || '?').split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase();
  }
  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-ZA', { day:'2-digit', month:'short', year:'numeric' });
  }
  isFieldInvalid(name: string): boolean {
    const f = this.postForm.get(name);
    return !!(f && f.invalid && (f.dirty || f.touched));
  }
}
