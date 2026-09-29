const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const connectDB = require('./config/db');
const { connectRedis } = require('./config/redis');
const errorHandler = require('./middleware/error');

// Route imports
const authRoutes = require('./routes/auth');
const spacesRoutes = require('./routes/spaces');
const notificationRoutes = require('./routes/notifications');
const searchRoutes = require('./routes/search');

// Initialize Express
const app = express();

// --------------- Middleware ---------------
const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map(s => s.trim());

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    // Allow any localhost or LAN IP origin in development
    if (
      process.env.NODE_ENV !== 'production' &&
      (origin.match(/^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/) ||
       allowedOrigins.includes(origin))
    ) {
      return callback(null, true);
    }
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Uploaded resources. `Cross-Origin-Resource-Policy` lets the client render them
// from its own origin; `X-Content-Type-Options` stops a browser sniffing an
// uploaded file into something executable.
app.use(
  '/uploads',
  (req, res, next) => {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    next();
  },
  express.static(path.join(__dirname, 'uploads'), {
    // Never run an upload as a page in the user's origin
    setHeaders: (res) => res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'"),
    index: false,
    dotfiles: 'deny',
  })
);

// --------------- Routes ---------------
app.use('/api/auth', authRoutes);
app.use('/api/spaces', spacesRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/search', searchRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'StudySync API is running',
    timestamp: new Date().toISOString(),
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});

// Global error handler (must be last)
app.use(errorHandler);

// --------------- Start Server ---------------
const PORT = process.env.PORT || 5000;
const http = require('http');
const { initSocket } = require('./config/socket');

const startServer = async () => {
  // Connect to MongoDB
  await connectDB();

  // Connect to Redis (optional — works without it)
  connectRedis();

  // Create HTTP server
  const server = http.createServer(app);

  // Initialize Socket.IO
  initSocket(server);
  const { initYjs } = require('./config/yjs');
  initYjs(server);

  server.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
  });
};

startServer();
