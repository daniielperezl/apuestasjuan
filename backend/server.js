require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');

const { apiLimiter } = require('./middleware/rateLimiter');
const { logger } = require('./middleware/logger');
const { setSocketIO } = require('./services/notificationService');
const { startCronJobs, setSocketIO: setSyncIO } = require('./services/matchSyncService');
const routes = require('./routes');

// Ensure logs directory exists
if (!fs.existsSync('logs')) fs.mkdirSync('logs');

const app = express();
const server = http.createServer(app);

// WebSocket setup
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
  }
});

setSocketIO(io);
setSyncIO(io);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'wss:', 'ws:'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com']
    }
  }
}));

app.use(cors({
  origin: (process.env.CORS_ORIGINS || 'http://localhost:3000').split(','),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(compression());
app.use(morgan('combined', { stream: { write: (msg) => logger.info(msg.trim()) } }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// API routes
app.use('/api/v1', apiLimiter, routes);

// Serve static frontend in production
if (process.env.NODE_ENV === 'production') {
  const frontendBuild = path.join(__dirname, '../frontend/build');
  if (fs.existsSync(frontendBuild)) {
    app.use(express.static(frontendBuild));
    app.get('*', (req, res) => {
      res.sendFile(path.join(frontendBuild, 'index.html'));
    });
  }
}

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint no encontrado' });
});

// Error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', { message: err.message, stack: err.stack });
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' ? 'Error interno del servidor' : err.message
  });
});

// WebSocket auth and events
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('No autorizado'));
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.userId;
    next();
  } catch (err) {
    next(new Error('Token inválido'));
  }
});

io.on('connection', (socket) => {
  logger.info(`Socket connected: ${socket.userId}`);
  socket.join(`user:${socket.userId}`);

  socket.on('subscribe:match', (matchId) => {
    socket.join(`match:${matchId}`);
  });

  socket.on('unsubscribe:match', (matchId) => {
    socket.leave(`match:${matchId}`);
  });

  socket.on('disconnect', () => {
    logger.info(`Socket disconnected: ${socket.userId}`);
  });
});

// Expose io for use in other modules
app.set('io', io);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  logger.info(`🚀 SportBets API running on port ${PORT}`);
  logger.info(`📅 Bogotá time: ${new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' })}`);
  logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);

  // Start cron jobs
  if (process.env.ENABLE_CRON !== 'false') {
    startCronJobs();
  }
});

module.exports = { app, server, io };
