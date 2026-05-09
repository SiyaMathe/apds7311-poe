/**
 * routes/postRoutes.js
 * ============================================================
 * Bulletin Board Post Routes (All Protected)
 * 
 * Routes:
 * GET    /api/posts        - Get all active posts
 * POST   /api/posts        - Create a new post
 * DELETE /api/posts/:id    - Delete a post (author or admin only)
 * 
 * ALL routes are protected by JWT authentication middleware.
 * You must be logged in to read, create, or delete posts.
 * This enforces the "Only authorised users" requirement.
 * ============================================================
 */

const express = require('express');
const Post = require('../models/Post');
const { protect, restrictTo } = require('../middleware/auth');
const { validatePost } = require('../middleware/validate');

const router = express.Router();

/**
 * IMPORTANT: All routes in this file use the protect middleware.
 * We apply it globally to this router using router.use()
 * so we don't have to repeat it on every route.
 * 
 * This is called "route protection" - a user without a valid
 * JWT token cannot access ANY of these endpoints.
 */
router.use(protect);

// ============================================================
// ROUTE: GET /api/posts
// ============================================================
/**
 * Get all active bulletin board posts
 * 
 * - Sorted by most recent first
 * - Populates author details (name, department) from User collection
 * - Only returns active (non-deleted) posts
 * 
 * SECURITY: Protected by JWT - must be authenticated to read posts
 */
router.get('/', async (req, res) => {
  try {
    /**
     * Query options:
     * - { isActive: true }: Only return non-deleted posts
     * - .populate(): Joins the author's data from the User collection
     *   Instead of just storing the user's ID, we fetch their name/dept
     * - .sort({ createdAt: -1 }): Newest posts first (-1 = descending)
     * - .select('-__v'): Exclude MongoDB's internal version key
     */
    const posts = await Post.find({ isActive: true })
      .populate('author', 'fullName department username') // Get author details
      .sort({ createdAt: -1 }) // Newest first
      .select('-__v'); // Exclude version key

    res.status(200).json({
      status: 'success',
      results: posts.length,
      data: {
        posts,
      },
    });

  } catch (error) {
    console.error('Get posts error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Could not retrieve posts. Please try again.',
    });
  }
});

// ============================================================
// ROUTE: POST /api/posts
// ============================================================
/**
 * Create a new bulletin board post
 * 
 * Flow:
 * 1. protect middleware: verify JWT → sets req.user
 * 2. validatePost middleware: validate and sanitize input
 * 3. Create post with author set to the logged-in user
 * 
 * SECURITY:
 * - The author is set from req.user (the JWT), NOT from the request body
 * - This prevents a user from creating a post "as" another user
 * - Input is sanitized to prevent XSS attacks
 */
router.post('/', validatePost, async (req, res) => {
  try {
    const { title, content, category, priority, targetDepartments } = req.body;

    /**
     * Create the post.
     * 
     * SECURITY: We explicitly set author from req.user._id (verified JWT)
     * and not from the request body. This means a user cannot fake
     * who created the post.
     */
    const post = await Post.create({
      title,
      content,
      category,
      priority: priority || 'Medium',
      targetDepartments: targetDepartments || ['All'],
      author: req.user._id,           // From JWT - cannot be spoofed
      authorName: req.user.fullName,   // Denormalized for display
      authorDepartment: req.user.department,
    });

    // Populate author details in the response
    await post.populate('author', 'fullName department username');

    res.status(201).json({
      status: 'success',
      message: 'Post created successfully',
      data: {
        post,
      },
    });

  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(e => e.message);
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: messages,
      });
    }

    console.error('Create post error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Could not create post. Please try again.',
    });
  }
});

// ============================================================
// ROUTE: DELETE /api/posts/:id
// ============================================================
/**
 * Delete a bulletin board post
 * 
 * AUTHORIZATION RULES:
 * - A user can only delete their OWN posts
 * - An admin can delete ANY post
 * - Any other user gets a 403 Forbidden error
 * 
 * We use soft delete (isActive: false) instead of actually removing
 * the document from MongoDB. This preserves the audit trail.
 */
router.delete('/:id', async (req, res) => {
  try {
    /**
     * Validate that the ID is a valid MongoDB ObjectId format
     * This prevents invalid ID errors from crashing the server
     * and also prevents NoSQL injection via the ID parameter
     */
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid post ID format',
      });
    }

    // Find the post
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        status: 'error',
        message: 'Post not found',
      });
    }

    /**
     * AUTHORIZATION CHECK:
     * Convert both IDs to strings for comparison.
     * MongoDB ObjectIds are objects, not strings - direct comparison (===) won't work.
     * 
     * Allow deletion if:
     * 1. The logged-in user is the post's author, OR
     * 2. The logged-in user has the 'admin' role
     */
    const isAuthor = post.author.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isAuthor && !isAdmin) {
      return res.status(403).json({
        status: 'error',
        message: 'You are not authorized to delete this post.',
      });
    }

    /**
     * SOFT DELETE: Set isActive to false instead of removing the document.
     * 
     * Benefits:
     * - Preserves audit trail (who created what, when)
     * - Data can be recovered if deleted by mistake
     * - Compliance with data retention requirements
     */
    await Post.findByIdAndUpdate(req.params.id, { isActive: false });

    res.status(200).json({
      status: 'success',
      message: 'Post deleted successfully',
    });

  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Could not delete post. Please try again.',
    });
  }
});

module.exports = router;
