const express = require('express');
const https = require('https');
const http = require('http');
const { URL } = require('url');

const router = express.Router();

// ─── SSRF protection ──────────────────────────────────────────────────────────
// Block requests to private / loopback / link-local ranges
const BLOCKED_HOSTS = /^(localhost$|127\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.|0\.0\.0\.0|::1$|fe80:)/i;

function isSafeUrl(urlStr) {
  try {
    const u = new URL(urlStr);
    if (!['http:', 'https:'].includes(u.protocol)) return false;
    if (BLOCKED_HOSTS.test(u.hostname)) return false;
    return true;
  } catch {
    return false;
  }
}

// ─── HTML fetcher (follows up to 3 redirects, reads max 512 KB, 5 s timeout) ─
function fetchHtml(urlStr, redirectsLeft = 3) {
  return new Promise((resolve, reject) => {
    let parsed;
    try { parsed = new URL(urlStr); } catch { return reject(new Error('Invalid URL')); }

    const lib = parsed.protocol === 'https:' ? https : http;

    const req = lib.get(urlStr, {
      timeout: 5000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; LinkPreviewBot/1.0; +https://thescandal.local)',
        Accept: 'text/html,application/xhtml+xml',
      },
    }, (res) => {
      // Follow redirects
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && redirectsLeft > 0) {
        const next = new URL(res.headers.location, urlStr).toString();
        if (!isSafeUrl(next)) { res.destroy(); return reject(new Error('Redirect to unsafe URL')); }
        res.destroy();
        return resolve(fetchHtml(next, redirectsLeft - 1));
      }

      if (res.statusCode < 200 || res.statusCode >= 300) {
        res.destroy();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }

      const ct = res.headers['content-type'] || '';
      if (!ct.includes('text/html') && !ct.includes('application/xhtml')) {
        res.destroy();
        return reject(new Error('Not an HTML page'));
      }

      let body = '';
      let size = 0;
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        size += chunk.length;
        if (size > 512_000) { res.destroy(); return; }
        body += chunk;
        // Stop reading once we've passed <head>; no need for the rest
        if (body.includes('</head>') || body.includes('<body')) { res.destroy(); }
      });
      res.on('end', () => resolve(body));
      res.on('close', () => resolve(body));
      res.on('error', reject);
    });

    req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')); });
    req.on('error', reject);
  });
}

// ─── OG / meta tag extractor ─────────────────────────────────────────────────
function extractOg(html, pageUrl) {
  function getMeta(...names) {
    for (const name of names) {
      // property="og:xxx" content="..." or content="..." property="og:xxx"
      const r1 = new RegExp(
        `<meta[^>]+(?:property|name)=["']${name}["'][^>]+content=["']([^"'<>]{1,1000})["']`,
        'i'
      );
      const r2 = new RegExp(
        `<meta[^>]+content=["']([^"'<>]{1,1000})["'][^>]+(?:property|name)=["']${name}["']`,
        'i'
      );
      const m = r1.exec(html) || r2.exec(html);
      if (m) return m[1].trim();
    }
    return null;
  }

  const titleTag = /<title[^>]*>([^<]{1,300})<\/title>/i.exec(html);
  const faviconTag = /<link[^>]+rel=["'](?:shortcut )?icon["'][^>]+href=["']([^"'<>]+)["']/i.exec(html)
                  || /<link[^>]+href=["']([^"'<>]+)["'][^>]+rel=["'](?:shortcut )?icon["']/i.exec(html);

  let favicon = faviconTag ? faviconTag[1].trim() : null;
  if (favicon && !favicon.startsWith('http')) {
    try { favicon = new URL(favicon, pageUrl).toString(); } catch { favicon = null; }
  }

  let image = getMeta('og:image', 'twitter:image');
  if (image && !image.startsWith('http')) {
    try { image = new URL(image, pageUrl).toString(); } catch { image = null; }
  }

  return {
    title: getMeta('og:title', 'twitter:title') || (titleTag ? titleTag[1].trim() : null),
    description: getMeta('og:description', 'twitter:description', 'description'),
    image,
    siteName: getMeta('og:site_name'),
    favicon,
    url: getMeta('og:url') || pageUrl,
  };
}

// ─── Simple in-process cache (url → {data, expiresAt}) ────────────────────────
const cache = new Map();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour
const MAX_CACHE  = 1000;

function cacheGet(url) {
  const entry = cache.get(url);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) { cache.delete(url); return null; }
  return entry.data;
}

function cacheSet(url, data) {
  if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value); // evict oldest
  cache.set(url, { data, expiresAt: Date.now() + CACHE_TTL });
}

// ─── GET /og?url=https://... ─────────────────────────────────────────────────
router.get('/', async (req, res) => {
  const { url } = req.query;

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'url query parameter is required' });
  }

  if (!isSafeUrl(url)) {
    return res.status(400).json({ error: 'Invalid or disallowed URL' });
  }

  const hit = cacheGet(url);
  if (hit) return res.json(hit);

  try {
    const html = await fetchHtml(url);
    const data = extractOg(html, url);
    cacheSet(url, data);
    return res.json(data);
  } catch (err) {
    return res.status(422).json({ error: `Could not fetch URL: ${err.message}` });
  }
});

module.exports = router;
