/**
 * models/Post.js
 * ============================================================
 * Bulletin Board Post Schema & Model
 * 
 * This defines the structure for posts on the inter-departmental
 * bulletin board. Posts are confidential government communications
 * that require authentication to view, create, or delete.
 * ============================================================
 */

const mongoose = require('mongoose');

const postSchema = new mongoose.Schema(
  {
    // Post title
    title: {
      type: String,
      required: [true, 'Post title is required'],
      trim: true,
      minlength: [3, 'Title must be at least 3 characters'],
      maxlength: [150, 'Title cannot exceed 150 characters'],
    },

    // Post content/body
    content: {
      type: String,
      required: [true, 'Post content is required'],
      trim: true,
      minlength: [10, 'Content must be at least 10 characters'],
      maxlength: [5000, 'Content cannot exceed 5000 characters'],
    },

    // Category of the inter-departmental issue
    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: {
        values: [
          'Policy',
          'Infrastructure',
          'Security',
          'Finance',
          'Health',
          'Emergency',
          'General'
        ],
        message: 'Please select a valid category'
      }
    },

    // Priority level
    priority: {
      type: String,
      enum: ['Low', 'Medium', 'High', 'Critical'],
      default: 'Medium',
    },

    // Reference to the User who created this post
    // This creates a relationship between Post and User collections
    author: {
      type: mongoose.Schema.Types.ObjectId, // MongoDB ObjectId reference
      ref: 'User', // References the 'User' model
      required: true,
    },

    // Author's name (denormalized for quick display without joins)
    authorName: {
      type: String,
      required: true,
      trim: true,
    },

    // Author's department
    authorDepartment: {
      type: String,
      required: true,
    },

    // Departments this post is relevant to
    targetDepartments: {
      type: [String],
      default: ['All'],
    },

    // Whether the post is still active
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    // Automatically manage createdAt and updatedAt fields
    timestamps: true,
  }
);

// Index for faster queries - most common query is sorting by date
postSchema.index({ createdAt: -1 });
// Index for filtering by author
postSchema.index({ author: 1 });

const Post = mongoose.model('Post', postSchema);
module.exports = Post;
