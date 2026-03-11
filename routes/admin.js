const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

const Admin = require('../models/Admin');
const Post = require('../models/Post');
const Comment = require('../models/Comment');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidId(id) {
  return UUID_RE.test(id);
}

function deleteUploadFile(relativeUrl) {
  if (!relativeUrl || !relativeUrl.startsWith('/uploads/')) return;
  const filename = path.basename(relativeUrl);
  const filePath = path.join(__dirname, '../uploads', filename);
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (_) {
    // Non-fatal: deletion failure should not block moderation action.
  }
}

router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }
  if (typeof username !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Invalid input' });
  }

  try {
    const admin = await Admin.findOne({ where: { username: username.trim() } });

    const dummyHash = '$2a$12$invalidhashforenumerationprevention000000000000000000000';
    const storedHash = admin ? admin.get('password') : dummyHash;
    const match = await bcrypt.compare(password, storedHash);

    if (!admin || !match) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { adminId: admin.id, username: admin.username },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    return res.json({ token });
  } catch (err) {
    console.error('[admin] POST /admin/login error:', err.message);
    return res.status(500).json({ error: 'Login failed' });
  }
});

router.post('/setup', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }
  if (password.length < 12) {
    return res.status(400).json({ error: 'Password must be at least 12 characters' });
  }

  try {
    const count = await Admin.count();
    if (count > 0) {
      return res.status(403).json({ error: 'Admin already exists. Use the CLI script to add more admins.' });
    }

    const hashed = await bcrypt.hash(password, 12);
    await Admin.create({ username: username.trim(), password: hashed });

    return res.status(201).json({ message: 'Admin account created successfully' });
  } catch (err) {
    console.error('[admin] POST /admin/setup error:', err.message);
    return res.status(500).json({ error: 'Setup failed' });
  }
});

router.get('/posts', requireAuth, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const offset = (page - 1) * limit;

    const { count, rows: posts } = await Post.findAndCountAll({
      order: [['timestamp', 'DESC']],
      offset,
      limit,
    });

    return res.json({ posts, page, total: count, totalPages: Math.ceil(count / limit) });
  } catch (err) {
    console.error('[admin] GET /admin/posts error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

router.delete('/posts/:id', requireAuth, async (req, res) => {
  if (!isValidId(req.params.id)) {
    return res.status(400).json({ error: 'Invalid post ID' });
  }

  try {
    const post = await Post.findByPk(req.params.id);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    for (const url of post.media || []) {
      deleteUploadFile(url);
    }

    await Promise.all([
      post.destroy(),
      Comment.destroy({ where: { postId: req.params.id } }),
    ]);

    return res.json({ message: 'Post and its comments deleted' });
  } catch (err) {
    console.error('[admin] DELETE /admin/posts/:id error:', err.message);
    return res.status(500).json({ error: 'Failed to delete post' });
  }
});

router.delete('/comments/:id', requireAuth, async (req, res) => {
  if (!isValidId(req.params.id)) {
    return res.status(400).json({ error: 'Invalid comment ID' });
  }

  try {
    const comment = await Comment.findByPk(req.params.id);
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    await comment.destroy();
    return res.json({ message: 'Comment deleted' });
  } catch (err) {
    console.error('[admin] DELETE /admin/comments/:id error:', err.message);
    return res.status(500).json({ error: 'Failed to delete comment' });
  }
});

router.put('/posts/:id/flag', requireAuth, async (req, res) => {
  if (!isValidId(req.params.id)) {
    return res.status(400).json({ error: 'Invalid post ID' });
  }

  try {
    const post = await Post.findByPk(req.params.id);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    post.flagged = !post.flagged;
    await post.save();

    return res.json({
      message: `Post ${post.flagged ? 'flagged' : 'unflagged'} successfully`,
      flagged: post.flagged,
    });
  } catch (err) {
    console.error('[admin] PUT /admin/posts/:id/flag error:', err.message);
    return res.status(500).json({ error: 'Failed to update flag status' });
  }
});

router.get('/posts/:id/comments', requireAuth, async (req, res) => {
  if (!isValidId(req.params.id)) {
    return res.status(400).json({ error: 'Invalid post ID' });
  }

  try {
    const comments = await Comment.findAll({
      where: { postId: req.params.id },
      order: [['timestamp', 'ASC']],
    });

    return res.json(comments);
  } catch (err) {
    console.error('[admin] GET /admin/posts/:id/comments error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

module.exports = router;
