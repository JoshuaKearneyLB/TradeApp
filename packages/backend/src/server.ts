import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { testConnection, pool } from './config/database.js';
import { isTokenRevoked } from './services/tokenBlacklist.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import bcrypt from 'bcrypt';
import authRoutes from './routes/auth.routes.js';
import jobsRoutes from './routes/jobs.routes.js';
import categoriesRoutes from './routes/categories.routes.js';
import profileRoutes from './routes/profile.routes.js';
import ratingsRoutes from './routes/ratings.routes.js';
import notificationsRoutes from './routes/notifications.routes.js';
import paymentsRoutes from './routes/payments.routes.js';
import messagesRoutes from './routes/messages.routes.js';
import uploadsRoutes from './routes/uploads.routes.js';
import adminRoutes from './routes/admin.routes.js';
import { handleWebhook } from './controllers/payments.controller.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { initIO } from './socket/index.js';
import { sendNewMessageEmail } from './services/email.service.js';
import type { ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData } from '@tradeapp/shared';
import { NotificationType } from '@tradeapp/shared';

// Load environment variables
dotenv.config();

// Default NODE_ENV to production for safety — never expose stack traces unless explicitly set to development
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'production';
}

// Validate critical environment variables at startup
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret || jwtSecret.length < 32) {
  console.error('FATAL: JWT_SECRET must be at least 32 characters. Generate one with: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"');
  process.exit(1);
}

const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';
if (corsOrigin === '*') {
  console.warn('WARNING: CORS_ORIGIN is set to *, this is insecure. Set a specific origin.');
}

const app = express();
// RATE-06: 'trust proxy: 1' is correct when deployed behind a single nginx/ALB/reverse proxy.
// If running directly on the internet without a proxy, set TRUST_PROXY=false in .env.
// Incorrect setting allows X-Forwarded-For spoofing to bypass rate limits.
const trustProxy = process.env.TRUST_PROXY === 'false' ? false : 1;
app.set('trust proxy', trustProxy);
const httpServer = createServer(app);
const io = new SocketIOServer<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>(httpServer, {
  cors: {
    origin: corsOrigin,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Register io before any routes load (breaks circular dependency)
initIO(io);

const PORT = process.env.PORT || 3000;

// Middleware
// CORS-03: Explicit Content Security Policy
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", 'https://fonts.googleapis.com', "'unsafe-inline'"],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'blob:'],
      connectSrc: ["'self'", 'ws:', 'wss:'],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
    },
  },
}));
app.use(cors({
  origin: corsOrigin,
  credentials: true,
}));

// Stripe webhook must receive raw body — register before express.json()
app.use('/api/webhooks/stripe', express.raw({ type: 'application/json' }));
app.post('/api/webhooks/stripe', handleWebhook);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// AUTHZ-07: Photos are served via authenticated /api/uploads/photos/:filename endpoint.
// express.static is intentionally NOT used here — all photo access requires a valid JWT
// and participant verification in uploads.controller.ts servePhoto().

// General rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api', limiter);

// Strict rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: { error: 'Too many login attempts, please try again in 15 minutes.' },
});

// Rate limiting for geocoding proxy endpoints
const geocodeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30,
  message: { error: 'Too many geocoding requests, please try again later.' },
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth', authRoutes);
app.use('/api/jobs', jobsRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/ratings', ratingsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/uploads', uploadsRoutes);
app.use('/api/admin', adminRoutes);

// Geocoding endpoint — proxies to Nominatim so frontend avoids CORS
app.get('/api/geocode', geocodeLimiter, async (req, res) => {
  const { address } = req.query;
  if (!address || typeof address !== 'string') {
    res.status(400).json({ error: 'address query parameter is required' });
    return;
  }
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`;
    const response = await fetch(url, { headers: { 'User-Agent': 'TradeApp/1.0 (dev)' } });
    const data = await response.json() as any[];
    if (!data.length) {
      res.status(404).json({ error: 'Address not found' });
      return;
    }
    res.json({
      latitude: parseFloat(data[0].lat),
      longitude: parseFloat(data[0].lon),
      displayName: data[0].display_name,
    });
  } catch (error) {
    console.error('Geocoding error:', error);
    res.status(500).json({ error: 'Geocoding failed' });
  }
});

// Geocoding autocomplete endpoint — UK only, returns up to 5 suggestions
app.get('/api/geocode/suggest', geocodeLimiter, async (req, res) => {
  const { query } = req.query;
  if (!query || typeof query !== 'string' || query.trim().length < 3) {
    res.json({ suggestions: [] });
    return;
  }
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query.trim())}&countrycodes=gb&format=json&limit=5&addressdetails=1`;
    const response = await fetch(url, { headers: { 'User-Agent': 'TradeApp/1.0 (dev)' } });
    const data = await response.json() as any[];
    const suggestions = data.map((item: any) => {
      const a = item.address || {};
      const parts = [
        a.house_number && a.road ? `${a.house_number} ${a.road}` : a.road,
        a.town || a.city || a.village || a.suburb,
        a.postcode,
      ].filter(Boolean);
      return {
        displayName: item.display_name,
        shortName: parts.join(', ') || item.display_name,
        latitude: parseFloat(item.lat),
        longitude: parseFloat(item.lon),
      };
    });
    res.json({ suggestions });
  } catch (error) {
    console.error('Geocode suggest error:', error);
    res.json({ suggestions: [] });
  }
});

const SOCKET_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Global socket connection limit
const MAX_SOCKET_CONNECTIONS = 10_000;
let activeSocketConnections = 0;

// DOS-04: Per-user connection limit (prevents one account exhausting all slots)
const MAX_CONNECTIONS_PER_USER = 5;
const userSocketCounts = new Map<string, number>();

// Socket event rate limiting — in-memory per-socket counters
const socketEventCounts = new Map<string, { count: number; resetAt: number }>();
const SOCKET_RATE_WINDOW_MS = 60 * 1000; // 1 minute
const SOCKET_RATE_MAX = 60; // max events per socket per minute

function checkSocketRateLimit(socketId: string): boolean {
  const now = Date.now();
  const entry = socketEventCounts.get(socketId);
  if (!entry || now > entry.resetAt) {
    socketEventCounts.set(socketId, { count: 1, resetAt: now + SOCKET_RATE_WINDOW_MS });
    return true;
  }
  entry.count += 1;
  return entry.count <= SOCKET_RATE_MAX;
}

// Apply rate limiting to ALL socket events via middleware
io.use((socket, next) => {
  if (!checkSocketRateLimit(socket.id)) {
    next(new Error('Rate limit exceeded'));
    return;
  }
  next();
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  // Enforce global connection limit
  activeSocketConnections += 1;
  if (activeSocketConnections > MAX_SOCKET_CONNECTIONS) {
    socket.disconnect();
    activeSocketConnections -= 1;
    return;
  }
  console.log(`Socket connected: ${socket.id}`);

  // Auto-disconnect unauthenticated sockets after 10 seconds
  const authTimeout = setTimeout(() => {
    if (!socket.data.userId) {
      socket.disconnect();
    }
  }, 10_000);

  socket.on('authenticate', async (token: string) => {
    try {
      if (typeof token !== 'string' || token.length > 2048) {
        socket.emit('authenticated', { success: false });
        socket.disconnect();
        return;
      }
      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) throw new Error('JWT_SECRET not configured');
      const payload = jwt.verify(token, jwtSecret, { algorithms: ['HS256'] }) as { userId: string; jti?: string };

      // Reject revoked tokens (logout blacklist)
      if (payload.jti && await isTokenRevoked(payload.jti)) {
        socket.emit('authenticated', { success: false });
        socket.disconnect();
        return;
      }

      // Verify account is still active before granting socket access
      const result = await pool.query(
        'SELECT account_status FROM users WHERE id = $1',
        [payload.userId]
      );
      if (result.rows.length === 0 || result.rows[0].account_status !== 'active') {
        socket.emit('authenticated', { success: false });
        socket.disconnect();
        return;
      }

      // DOS-04: Enforce per-user connection limit
      const userCount = userSocketCounts.get(payload.userId) ?? 0;
      if (userCount >= MAX_CONNECTIONS_PER_USER) {
        socket.emit('authenticated', { success: false });
        socket.disconnect();
        return;
      }
      userSocketCounts.set(payload.userId, userCount + 1);

      clearTimeout(authTimeout);
      socket.data.userId = payload.userId;
      socket.join(`user:${payload.userId}`);
      socket.emit('authenticated', { success: true, userId: payload.userId });
      console.log(`Socket authenticated for user: ${payload.userId}`);
    } catch {
      socket.emit('authenticated', { success: false });
      socket.disconnect();
    }
  });

  socket.on('join_job_room', async (jobId: string) => {
    if (!socket.data.userId || !checkSocketRateLimit(socket.id)) return;
    if (typeof jobId !== 'string' || !SOCKET_UUID_RE.test(jobId)) return;
    try {
      const result = await pool.query(
        'SELECT customer_id, professional_id FROM jobs WHERE id = $1',
        [jobId],
      );
      if (!result.rows.length) return;
      const job = result.rows[0];
      if (job.customer_id !== socket.data.userId && job.professional_id !== socket.data.userId) return;
      socket.join(`job:${jobId}`);
    } catch (err) {
      console.error('join_job_room error:', err);
    }
  });

  socket.on('leave_job_room', (jobId: string) => {
    if (!socket.data.userId || !checkSocketRateLimit(socket.id)) return;
    if (typeof jobId === 'string') socket.leave(`job:${jobId}`);
  });

  socket.on('send_message', async (data) => {
    if (!socket.data.userId) return;
    if (!checkSocketRateLimit(socket.id)) return;
    try {
      const { jobId, receiverId, content } = data as { jobId: string; receiverId: string; content: string };
      if (!SOCKET_UUID_RE.test(jobId) || !SOCKET_UUID_RE.test(receiverId)) return;
      if (!content || typeof content !== 'string' || content.trim().length === 0 || content.length > 2000) return;

      const jobResult = await pool.query(
        'SELECT customer_id, professional_id, title, status FROM jobs WHERE id = $1',
        [jobId],
      );
      if (!jobResult.rows.length) return;
      const job = jobResult.rows[0];
      if (job.customer_id !== socket.data.userId && job.professional_id !== socket.data.userId) return;
      if (receiverId !== job.customer_id && receiverId !== job.professional_id) return;
      if (receiverId === socket.data.userId) return;
      if (!['accepted', 'in_progress', 'completed'].includes(job.status)) return;

      const trimmed = content.trim();

      const msgResult = await pool.query(
        `INSERT INTO messages (job_id, sender_id, receiver_id, content) VALUES ($1, $2, $3, $4) RETURNING id, created_at`,
        [jobId, socket.data.userId, receiverId, trimmed],
      );
      const msg = msgResult.rows[0];

      const senderResult = await pool.query(
        'SELECT first_name, last_name FROM users WHERE id = $1',
        [socket.data.userId],
      );
      const sender = senderResult.rows[0];
      const senderName = sender ? `${sender.first_name} ${sender.last_name}` : 'User';

      io.to(`job:${jobId}`).emit('new_message', {
        messageId: msg.id,
        jobId,
        senderId: socket.data.userId,
        senderName,
        content: trimmed,
        timestamp: msg.created_at.toISOString(),
      });

      const notifResult = await pool.query(
        `INSERT INTO notifications (user_id, type, title, content, related_job_id)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, created_at`,
        [receiverId, NotificationType.MESSAGE, 'New message', `${senderName}: ${trimmed.substring(0, 100)}`, jobId],
      );
      const notif = notifResult.rows[0];
      io.to(`user:${receiverId}`).emit('new_notification', {
        notificationId: notif.id,
        type: NotificationType.MESSAGE,
        title: 'New message',
        content: `${senderName}: ${trimmed.substring(0, 100)}`,
        relatedJobId: jobId,
        createdAt: notif.created_at.toISOString(),
      });

      const receiverResult = await pool.query(
        'SELECT email, first_name, last_name FROM users WHERE id = $1',
        [receiverId],
      );
      if (receiverResult.rows.length) {
        const receiver = receiverResult.rows[0];
        sendNewMessageEmail(
          receiverId,
          jobId,
          receiver.email,
          `${receiver.first_name} ${receiver.last_name}`,
          senderName,
          job.title,
          trimmed.substring(0, 120),
        );
      }
    } catch (err) {
      console.error('send_message socket error:', err);
    }
  });

  socket.on('disconnect', () => {
    clearTimeout(authTimeout);
    socketEventCounts.delete(socket.id);
    activeSocketConnections = Math.max(0, activeSocketConnections - 1);
    // DOS-04: Decrement per-user count on disconnect
    if (socket.data.userId) {
      const prev = userSocketCounts.get(socket.data.userId) ?? 1;
      const next = prev - 1;
      if (next <= 0) {
        userSocketCounts.delete(socket.data.userId);
      } else {
        userSocketCounts.set(socket.data.userId, next);
      }
    }
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

// Error handlers (must be last)
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
async function startServer() {
  try {
    // Test database connection
    const dbConnected = await testConnection();
    if (!dbConnected) {
      console.error('Failed to connect to database. Please ensure PostgreSQL is running.');
      console.log('\nTo start PostgreSQL with Docker:');
      console.log('  docker-compose up -d');
      console.log('\nOr update DATABASE_URL in .env to point to your PostgreSQL instance');
      process.exit(1);
    }

    // Run pending migrations — each file is attempted independently so a
    // previously-applied migration doesn't block later ones from running.
    const migrationsDir = join(__dirname, 'db', 'migrations');
    const migrations = ['001_initial_schema.sql', '002_add_location_display.sql', '003_add_job_started_notification_type.sql', '004_add_revoked_tokens.sql', '005_add_payments.sql', '006_add_stripe_to_profiles.sql', '007_add_job_photos.sql', '008_add_admin_role.sql', '009_seed_admin.sql'];
    for (const file of migrations) {
      try {
        const sql = readFileSync(join(migrationsDir, file), 'utf8');
        await pool.query(sql);
      } catch {
        // Already applied or no-op — safe to ignore
      }
    }
    console.log('✓ Migrations checked');

    // INFO-01: Seed admin from environment variables — no hardcoded credentials in code/migrations
    await seedAdmin();

    // Start HTTP server
    httpServer.listen(PORT, () => {
      console.log(`
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║   🚀 TradeApp Backend Server                         ║
║                                                       ║
║   Server:     http://localhost:${PORT}                   ║
║   Health:     http://localhost:${PORT}/health            ║
║   Socket.IO:  Connected and ready                    ║
║                                                       ║
║   Environment: ${process.env.NODE_ENV || 'development'}                           ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

/**
 * INFO-01 fix: seeds the admin account from env vars so no credentials are stored
 * in source control. Only runs if ADMIN_EMAIL and ADMIN_INITIAL_PASSWORD are set
 * and the account does not already exist.
 */
async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_INITIAL_PASSWORD;
  if (!email || !password) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('⚠  ADMIN_EMAIL / ADMIN_INITIAL_PASSWORD not set — admin account not seeded');
    }
    return;
  }
  const existing = await pool.query('SELECT id FROM users WHERE LOWER(email) = $1', [email.toLowerCase()]);
  if (existing.rows.length > 0) return; // already exists
  const hash = await bcrypt.hash(password, 10);
  await pool.query(
    `INSERT INTO users (email, password_hash, role, first_name, last_name)
     VALUES ($1, $2, 'admin', 'Platform', 'Admin')`,
    [email.toLowerCase(), hash],
  );
  console.log(`✓ Admin account seeded for ${email}`);
}

startServer();

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  httpServer.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

export { app };
