require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');
const rateLimit = require('express-rate-limit');

const sequelize = require('./db');
const { runMigrations } = require('./migrations/migrator');
// Import models so Sequelize registers them before sync()
require('./models/Post');
require('./models/Comment');
require('./models/Admin');
require('./models/Ad');

const postRoutes = require('./routes/posts');
const adminRoutes = require('./routes/admin');
const adRoutes = require('./routes/ads');
const ogRoutes = require('./routes/og');

// ─── Ensure uploads directory exists ──────────────────────────────────────────
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const app = express();

// ─── Security headers ──────────────────────────────────────────────────────────
app.use(
  helmet({
    // Allow cross-origin loading of /uploads/* from the frontend
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// ─── CORS ──────────────────────────────────────────────────────────────────────
// No credentials (no cookies) — only allow configured frontend origin(s)
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000')
  .split(',')
  .map((o) => o.trim());

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. same-origin, curl, Postman)
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: false, // No cookies or session tokens on public routes
  })
);

// ─── Body parsing ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── Rate limiting ─────────────────────────────────────────────────────────────
// Global buckets (not per-IP) to avoid storing any user-identifying information.
const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: () => 'public_global',
  message: { error: 'Too many requests — please try again later.' },
  skip: (req) => req.method === 'GET', // reads are not rate-limited
});

const writeLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: () => 'write_global',
  message: { error: 'Submission limit reached — please try again later.' },
});

const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  keyGenerator: () => 'admin_global',
  message: { error: 'Too many requests — please try again later.' },
});

// ─── Static file serving (uploads) ────────────────────────────────────────────
app.use('/uploads', express.static(uploadsDir));

// ─── Routes ────────────────────────────────────────────────────────────────────
// Apply write limiter only to POST methods, then run the route handlers.
app.use(
  '/posts',
  publicLimiter,
  (req, res, next) => {
    if (req.method === 'POST') return writeLimiter(req, res, next);
    next();
  },
  postRoutes
);
app.use('/admin', adminLimiter, adminRoutes);
app.use('/ads', publicLimiter, adRoutes);
app.use('/og', publicLimiter, ogRoutes);

// ─── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// ─── 404 handler ──────────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: 'Route not found' }));

// ─── Global error handler ──────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  // Do not leak internal details — log server-side only
  console.error('[server] Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// ─── Connect to PostgreSQL and start ──────────────────────────────────────────
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error('[server] FATAL: JWT_SECRET is missing or too short. Set a strong secret in .env');
  process.exit(1);
}

sequelize
  .authenticate()
  .then(() => {
    console.log('[server] Connected to PostgreSQL');
    // Apply pending schema migrations before serving traffic.
    return runMigrations();
  })
  .then(() => {
    const PORT = parseInt(process.env.PORT, 10) || 5001;
    const server = app.listen(PORT, () => {
      console.log(`[server] Running on http://localhost:${PORT}`);
    });

    server.on('error', (err) => {
      if (err && err.code === 'EADDRINUSE') {
        console.error(`[server] Port ${PORT} is already in use.`);
        console.error('[server] Stop the existing process or run: npm run start:clean');
        process.exit(1);
      }

      console.error('[server] Failed to start HTTP server:', err.message);
      process.exit(1);
    });
  })
  .catch((err) => {
    console.error('[server] PostgreSQL connection failed:', err.message);
    process.exit(1);
  });
