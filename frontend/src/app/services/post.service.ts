/**
 * src/app/services/post.service.ts
 * ============================================================
 * Posts Service
 * 
 * This service handles all bulletin board post operations:
 * - Fetching all posts
 * - Creating a new post
 * - Deleting a post
 * 
 * IMPORTANT: All API calls made by this service automatically
 * include the JWT token in the Authorization header.
 * This happens via the HTTP Interceptor (jwt.interceptor.ts),
 * not here. The service just makes normal HTTP calls.
 * 
 * WHY A SEPARATE SERVICE?
 * - Separation of concerns: components handle display, services handle data
 * - Reusable: multiple components can use the same service
 * - Testable: services can be unit tested independently
 * - Single responsibility: one service = one domain of data
 * ============================================================
 */

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

// TypeScript interface for a Post object (matches the MongoDB schema)
export interface Post {
  _id: string;
  title: string;
  content: string;
  category: string;
  priority: string;
  author: {
    _id: string;
    fullName: string;
    department: string;
    username: string;
  };
  authorName: string;
  authorDepartment: string;
  targetDepartments: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Interface for creating a new post (subset of Post fields)
export interface CreatePostData {
  title: string;
  content: string;
  category: string;
  priority?: string;
  targetDepartments?: string[];
}

// Generic API response wrapper
export interface ApiResponse<T = any> {
  status: string;
  message?: string;
  results?: number;
  data?: T;
  errors?: string[];
}

@Injectable({
  providedIn: 'root'
})
export class PostService {

  private apiUrl = `${environment.apiUrl}/posts`;

  constructor(private http: HttpClient) {}

  // ============================================================
  // GET ALL POSTS
  // ============================================================
  /**
   * getAllPosts - Fetches all active bulletin board posts
   * 
   * Returns an Observable that emits the API response.
   * Components subscribe to this to receive the posts.
   * 
   * The JWT token is automatically added to the request
   * by the HTTP Interceptor.
   */
  getAllPosts(): Observable<ApiResponse<{ posts: Post[] }>> {
    return this.http.get<ApiResponse<{ posts: Post[] }>>(this.apiUrl);
  }

  // ============================================================
  // CREATE POST
  // ============================================================
  /**
   * createPost - Sends a new post to the API
   * 
   * @param postData - The post data from the form
   * @returns Observable with the created post
   * 
   * The author is NOT included here - the server determines
   * the author from the JWT token. This prevents spoofing.
   */
  createPost(postData: CreatePostData): Observable<ApiResponse<{ post: Post }>> {
    return this.http.post<ApiResponse<{ post: Post }>>(this.apiUrl, postData);
  }

  // ============================================================
  // DELETE POST
  // ============================================================
  /**
   * deletePost - Deletes a post by ID
   * 
   * @param postId - The MongoDB ObjectId of the post
   * @returns Observable with the deletion result
   * 
   * Server checks if the logged-in user is the author or admin.
   * If not, returns 403 Forbidden.
   */
  deletePost(postId: string): Observable<ApiResponse> {
    return this.http.delete<ApiResponse>(`${this.apiUrl}/${postId}`);
  }
}
