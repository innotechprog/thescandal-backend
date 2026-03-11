const express = require('express');
const { Op } = require('sequelize');
const router = express.Router();
const Ad = require('../models/Ad');
const Post = require('../models/Post');
const Comment = require('../models/Comment');
const { requireAuth } = require('../middleware/auth');
const { extractKeywords } = require('../utils/keywordExtractor');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isValidId(id) {
  return UUID_RE.test(id);
}

function normalizeKeywords(input) {
  if (!input) return [];
  if (Array.isArray(input)) {
    return Array.from(new Set(input.map((k) => String(k).trim().toLowerCase()).filter(Boolean))).slice(0, 25);
  }
  return Array.from(
    new Set(
      String(input)
        .split(',')
        .map((k) => k.trim().toLowerCase())
        .filter(Boolean)
    )
  ).slice(0, 25);
}

function relevanceScore(adKeywords = [], targetKeywords = []) {
  if (!adKeywords.length || !targetKeywords.length) return 0;
  const adSet = new Set(adKeywords);
  let score = 0;
  for (const k of targetKeywords) {
    if (adSet.has(k)) score += 1;
  }
  return score;
}

// Public: one random approved ad for generic insertion points.
router.get('/random', async (req, res) => {
  try {
    const ads = await Ad.findAll({ where: { active: true, status: 'approved' } });
    if (!ads.length) return res.json(null);
    const ad = ads[Math.floor(Math.random() * ads.length)];
    return res.json(ad);
  } catch (err) {
    console.error('[ads] GET /ads/random error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch ad' });
  }
});

// Public: advertiser request form submission.
router.post('/request', async (req, res) => {
  const { businessName, email, adType, description, keywords } = req.body;

  if (!businessName || !String(businessName).trim()) {
    return res.status(400).json({ error: 'businessName is required' });
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) {
    return res.status(400).json({ error: 'Valid email is required' });
  }
  if (!adType || !['banner', 'sponsoredPost'].includes(adType)) {
    return res.status(400).json({ error: 'adType must be banner or sponsoredPost' });
  }
  if (!description || !String(description).trim()) {
    return res.status(400).json({ error: 'description is required' });
  }

  try {
    const ad = await Ad.create({
      businessName: String(businessName).trim().slice(0, 200),
      email: String(email).trim().slice(0, 200),
      adType,
      description: String(description).trim().slice(0, 2500),
      tagline: String(description).trim().slice(0, 300),
      keywords: normalizeKeywords(keywords),
      status: 'pending',
      active: false,
      imageUrl: null,
      linkUrl: '#',
    });

    return res.status(201).json({
      message: 'Ad request submitted for review',
      requestId: ad.id,
    });
  } catch (err) {
    console.error('[ads] POST /ads/request error:', err.message);
    return res.status(500).json({ error: 'Failed to submit ad request' });
  }
});

// Public: privacy-friendly contextual ad selection by content/post/comment context.
router.get('/contextual', async (req, res) => {
  try {
    const { postId, commentId, text, adType } = req.query;

    let targetKeywords = [];

    if (postId && isValidId(postId)) {
      const post = await Post.findByPk(postId);
      if (post) targetKeywords = post.topicKeywords || [];
    }

    if (targetKeywords.length === 0 && commentId && isValidId(commentId)) {
      const comment = await Comment.findByPk(commentId);
      if (comment) targetKeywords = comment.topicKeywords || [];
    }

    if (targetKeywords.length === 0 && text) {
      targetKeywords = extractKeywords(String(text));
    }

    if (targetKeywords.length === 0) return res.json([]);

    const where = {
      active: true,
      status: 'approved',
    };
    if (adType && ['banner', 'sponsoredPost'].includes(adType)) {
      where.adType = adType;
    }

    const ads = await Ad.findAll({ where, limit: 80 });

    const ranked = ads
      .map((ad) => ({ ad, score: relevanceScore(ad.keywords || [], targetKeywords) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((x) => x.ad);

    return res.json(ranked);
  } catch (err) {
    console.error('[ads] GET /ads/contextual error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch contextual ads' });
  }
});

// Admin: list approved/rejected/pending ads.
router.get('/', requireAuth, async (req, res) => {
  try {
    const status = (req.query.status || '').trim();
    const where = status && ['pending', 'approved', 'rejected'].includes(status)
      ? { status }
      : {};

    const ads = await Ad.findAll({ where, order: [['createdAt', 'DESC']] });
    return res.json(ads);
  } catch (err) {
    console.error('[ads] GET /ads error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch ads' });
  }
});

// Admin: create direct approved ad (existing flow).
router.post('/', requireAuth, async (req, res) => {
  const { businessName, tagline, imageUrl, linkUrl, adType, description, keywords } = req.body;

  if (!businessName || typeof businessName !== 'string' || !businessName.trim()) {
    return res.status(400).json({ error: 'businessName is required' });
  }
  if (!tagline || typeof tagline !== 'string' || !tagline.trim()) {
    return res.status(400).json({ error: 'tagline is required' });
  }
  if (!linkUrl || typeof linkUrl !== 'string' || !linkUrl.trim()) {
    return res.status(400).json({ error: 'linkUrl is required' });
  }

  const sanitizedLink = linkUrl.trim();
  if (!/^https?:\/\//i.test(sanitizedLink)) {
    return res.status(400).json({ error: 'linkUrl must start with http:// or https://' });
  }

  try {
    const ad = await Ad.create({
      businessName: businessName.trim().slice(0, 200),
      adType: ['banner', 'sponsoredPost'].includes(adType) ? adType : 'banner',
      tagline: tagline.trim().slice(0, 300),
      description: description ? String(description).trim().slice(0, 2500) : null,
      keywords: normalizeKeywords(keywords),
      imageUrl: imageUrl ? imageUrl.trim().slice(0, 2000) : null,
      linkUrl: sanitizedLink.slice(0, 2000),
      status: 'approved',
      active: true,
    });
    return res.status(201).json(ad);
  } catch (err) {
    console.error('[ads] POST /ads error:', err.message);
    return res.status(500).json({ error: 'Failed to create ad' });
  }
});

// Admin: review request and approve/reject.
router.put('/:id/review', requireAuth, async (req, res) => {
  if (!isValidId(req.params.id)) {
    return res.status(400).json({ error: 'Invalid ad ID' });
  }

  const { action, reviewNote, tagline, imageUrl, linkUrl, keywords, adType } = req.body;
  if (!['approve', 'reject'].includes(action)) {
    return res.status(400).json({ error: 'action must be approve or reject' });
  }

  try {
    const ad = await Ad.findByPk(req.params.id);
    if (!ad) return res.status(404).json({ error: 'Ad request not found' });

    if (action === 'approve') {
      if (!linkUrl || !/^https?:\/\//i.test(String(linkUrl).trim())) {
        return res.status(400).json({ error: 'linkUrl is required and must start with http:// or https://' });
      }
      ad.status = 'approved';
      ad.active = true;
      ad.adType = ['banner', 'sponsoredPost'].includes(adType) ? adType : ad.adType;
      ad.tagline = tagline ? String(tagline).trim().slice(0, 300) : ad.tagline;
      ad.imageUrl = imageUrl ? String(imageUrl).trim().slice(0, 2000) : ad.imageUrl;
      ad.linkUrl = String(linkUrl).trim().slice(0, 2000);
      ad.keywords = normalizeKeywords(keywords && keywords.length ? keywords : ad.keywords);
      ad.reviewNote = reviewNote ? String(reviewNote).trim().slice(0, 400) : null;
    } else {
      ad.status = 'rejected';
      ad.active = false;
      ad.reviewNote = reviewNote ? String(reviewNote).trim().slice(0, 400) : 'Rejected by admin';
    }

    await ad.save();
    return res.json(ad);
  } catch (err) {
    console.error('[ads] PUT /ads/:id/review error:', err.message);
    return res.status(500).json({ error: 'Failed to review ad request' });
  }
});

// Admin: toggle active state for approved ads.
router.put('/:id/toggle', requireAuth, async (req, res) => {
  if (!isValidId(req.params.id)) {
    return res.status(400).json({ error: 'Invalid ad ID' });
  }
  try {
    const ad = await Ad.findByPk(req.params.id);
    if (!ad) return res.status(404).json({ error: 'Ad not found' });
    if (ad.status !== 'approved') {
      return res.status(400).json({ error: 'Only approved ads can be activated' });
    }
    ad.active = !ad.active;
    await ad.save();
    return res.json({ active: ad.active });
  } catch (err) {
    console.error('[ads] PUT /ads/:id/toggle error:', err.message);
    return res.status(500).json({ error: 'Failed to update ad' });
  }
});

router.delete('/:id', requireAuth, async (req, res) => {
  if (!isValidId(req.params.id)) {
    return res.status(400).json({ error: 'Invalid ad ID' });
  }
  try {
    const ad = await Ad.findByPk(req.params.id);
    if (!ad) return res.status(404).json({ error: 'Ad not found' });
    await ad.destroy();
    return res.json({ message: 'Ad deleted' });
  } catch (err) {
    console.error('[ads] DELETE /ads/:id error:', err.message);
    return res.status(500).json({ error: 'Failed to delete ad' });
  }
});

module.exports = router;
