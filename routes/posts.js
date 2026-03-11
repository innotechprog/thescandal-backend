const express = require('express');
const router = express.Router();
const { fn, col, literal, Op } = require('sequelize');
const fs = require('fs');

const Post = require('../models/Post');
const Comment = require('../models/Comment');
const { generateUsername } = require('../utils/usernameGenerator');
const { processMedia } = require('../utils/mediaProcessor');
const { upload, handleUpload } = require('../utils/multerConfig');
const { containsBlockedContent } = require('../middleware/contentFilter');
const { extractPlaceMention } = require('../utils/placeExtractor');
const { extractKeywords } = require('../utils/keywordExtractor');
const { detectIncidentLocation } = require('../utils/locationDetector');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isValidId(id) {
  return UUID_RE.test(id);
}

function cleanupUploadedFiles(files = []) {
  for (const file of files) {
    try {
      if (file?.path && fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
    } catch (_) {
      /* ignore cleanup errors */
    }
  }
}

function parsePostSort(sort) {
  if (sort === 'liked') {
    return [['likes', 'DESC'], ['timestamp', 'DESC']];
  }
  if (sort === 'discussed') {
    return [
      [
        literal('(SELECT COUNT(*) FROM comments WHERE comments."postId" = "Post"."id")'),
        'DESC',
      ],
      ['timestamp', 'DESC'],
    ];
  }
  return [['timestamp', 'DESC']];
}

router.post(
  '/',
  handleUpload(upload.array('media', 5)),
  async (req, res) => {
    try {
      const { content, country } = req.body;

      if (!content || content.trim().length === 0) {
        return res.status(400).json({ error: 'Content is required' });
      }
      if (content.length > 5000) {
        return res.status(400).json({ error: 'Content must be 5000 characters or fewer' });
      }
      if (containsBlockedContent(content)) {
        return res.status(400).json({ error: 'Content contains prohibited terms' });
      }

      const mediaUrls = [];
      if (req.files && req.files.length > 0) {
        try {
          for (const file of req.files) {
            await processMedia(file.path, file.mimetype);
            mediaUrls.push(`/uploads/${file.filename}`);
          }
        } catch (mediaErr) {
          cleanupUploadedFiles(req.files);
          console.error('[posts] Media sanitization failed:', mediaErr.message);
          return res.status(400).json({ error: 'Media upload rejected because metadata sanitization failed.' });
        }
      }

      let normalizedCountry = (country || '').trim().slice(0, 100) || null;
      let placeMentioned = extractPlaceMention(content);
      if (!placeMentioned) {
        const aiLocation = await detectIncidentLocation(content);
        if (aiLocation?.displayName) {
          placeMentioned = String(aiLocation.displayName).slice(0, 200);
        }
        if (!normalizedCountry && aiLocation?.country) {
          normalizedCountry = String(aiLocation.country).slice(0, 100);
        }
      }
      const topicKeywords = extractKeywords(content);

      const post = await Post.create({
        username: generateUsername(),
        content: content.trim(),
        media: mediaUrls,
        country: normalizedCountry,
        placeMentioned,
        topicKeywords,
      });

      return res.status(201).json(post);
    } catch (err) {
      console.error('[posts] POST /posts error:', err.message);
      return res.status(500).json({ error: 'Failed to create post' });
    }
  }
);

router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;
    const sort = req.query.sort || 'latest';
    const country = (req.query.country || '').trim();
    const place = (req.query.place || '').trim();

    const where = { flagged: false };
    if (country) {
      where.country = country;
    }
    if (place) {
      where.placeMentioned = { [Op.iLike]: `%${place}%` };
    }

    const { count, rows: posts } = await Post.findAndCountAll({
      where,
      order: parsePostSort(sort),
      offset,
      limit,
    });

    const postIds = posts.map((p) => p.id);
    let countsByPost = new Map();

    if (postIds.length > 0) {
      const commentCounts = await Comment.findAll({
        attributes: ['postId', [fn('COUNT', col('id')), 'count']],
        where: { postId: postIds },
        group: ['postId'],
        raw: true,
      });

      countsByPost = new Map(commentCounts.map((row) => [row.postId, Number(row.count) || 0]));
    }

    const postsWithCounts = posts.map((post) => {
      const json = post.toJSON();
      json.commentsCount = countsByPost.get(post.id) || 0;
      return json;
    });

    return res.json({
      posts: postsWithCounts,
      page,
      total: count,
      totalPages: Math.ceil(count / limit),
      sort,
      country,
      place,
    });
  } catch (err) {
    console.error('[posts] GET /posts error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

router.post('/:id/comments', handleUpload(upload.array('media', 5)), async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid post ID' });
    }

    const { content, country } = req.body;
    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Content is required' });
    }
    if (content.length > 2000) {
      return res.status(400).json({ error: 'Comment must be 2000 characters or fewer' });
    }
    if (containsBlockedContent(content)) {
      return res.status(400).json({ error: 'Content contains prohibited terms' });
    }

    const post = await Post.findByPk(req.params.id);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }
    if (post.flagged) {
      return res.status(403).json({ error: 'Post is unavailable' });
    }

    const mediaUrls = [];
    if (req.files && req.files.length > 0) {
      try {
        for (const file of req.files) {
          await processMedia(file.path, file.mimetype);
          mediaUrls.push(`/uploads/${file.filename}`);
        }
      } catch (mediaErr) {
        cleanupUploadedFiles(req.files);
        console.error('[posts] Comment media sanitization failed:', mediaErr.message);
        return res.status(400).json({ error: 'Media upload rejected because metadata sanitization failed.' });
      }
    }

    let normalizedCountry = (country || '').trim().slice(0, 100) || post.country || null;
    let placeMentioned = extractPlaceMention(content);
    if (!placeMentioned) {
      const aiLocation = await detectIncidentLocation(content);
      if (aiLocation?.displayName) {
        placeMentioned = String(aiLocation.displayName).slice(0, 200);
      }
      if (!normalizedCountry && aiLocation?.country) {
        normalizedCountry = String(aiLocation.country).slice(0, 100);
      }
    }
    const topicKeywords = extractKeywords(content);

    const comment = await Comment.create({
      postId: post.id,
      username: generateUsername(),
      content: content.trim(),
      country: normalizedCountry,
      placeMentioned,
      topicKeywords,
      media: mediaUrls,
    });

    if (placeMentioned && !post.placeMentioned) {
      await post.update({ placeMentioned });
    }

    return res.status(201).json(comment);
  } catch (err) {
    console.error('[posts] POST /posts/:id/comments error:', err.message);
    return res.status(500).json({ error: 'Failed to create comment' });
  }
});

router.post('/:id/like', async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid post ID' });
    }

    const post = await Post.findByPk(req.params.id);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }
    if (post.flagged) {
      return res.status(403).json({ error: 'Post is unavailable' });
    }

    const [, updatedRows] = await Post.update(
      { likes: literal('likes + 1') },
      { where: { id: post.id }, returning: true }
    );

    return res.json({ likes: updatedRows[0].likes });
  } catch (err) {
    console.error('[posts] POST /posts/:id/like error:', err.message);
    return res.status(500).json({ error: 'Failed to like post' });
  }
});

router.get('/:id/comments', async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid post ID' });
    }

    const post = await Post.findByPk(req.params.id);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const sort = req.query.sort === 'newest' ? 'newest' : 'oldest';
    const comments = await Comment.findAll({
      where: { postId: req.params.id },
      order: [['timestamp', sort === 'newest' ? 'DESC' : 'ASC']],
    });

    return res.json(comments);
  } catch (err) {
    console.error('[posts] GET /posts/:id/comments error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

module.exports = router;
