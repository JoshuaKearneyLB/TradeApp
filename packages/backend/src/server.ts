import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { testConnection } from './config/database.js';
import authRoutes from './routes/auth.routes.js';
import jobsRoutes from './routes/jobs.routes.js';
import categoriesRoutes from './routes/categories.routes.js';
import profileRoutes from './routes/profile.routes.js';
import ratingsRoutes from './routes/ratings.routes.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import type { ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData } from '@tradeapp/shared';

// Load environment variables
dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new SocketIOServer<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
});
app.use('/api', limiter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/jobs', jobsRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/ratings', ratingsRoutes);

// Geocoding endpoint — proxies to Nominatim so frontend avoids CORS
app.get('/api/geocode', async (req, res) => {
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
app.get('/api/geocode/suggest', async (req, res) => {
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

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  socket.on('authenticate', (token: string) => {
    // TODO: Verify JWT token and join user-specific room
    console.log('Socket authentication requested');
  });

  socket.on('disconnect', () => {
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

startServer();

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  httpServer.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

export { app, io };
