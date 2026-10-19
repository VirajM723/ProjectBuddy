import express from 'express';
import path from 'path';
import fs from 'fs';
import mongoose from 'mongoose';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
// Must be imported before anything that reads process.env
import { isProduction, PORT, MONGODB_URI } from './src/server/config.js';
import { setupSocket } from './src/server/socket.js';
import { apiLimiter } from './src/server/middleware/rateLimiter.js';

// Routes
import authRoutes from './src/server/routes/auth.js';
import projectRoutes from './src/server/routes/projects.js';
import userRoutes from './src/server/routes/users.js';
import collaborationRoutes from './src/server/routes/collaborations.js';
import endorsementRoutes from './src/server/routes/endorsements.js';
import logRoutes from './src/server/routes/logs.js';
import adminRoutes from './src/server/routes/admin.js';

async function startServer() {
  const app = express();
  
  // Trust proxy for rate limiter to identify client IP addresses correctly on Render
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  
  // Create HTTP server and initialize socket.io
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    },
    maxHttpBufferSize: 64 * 1024,
  });

  app.set('io', io);

  // Setup WebSocket handlers
  setupSocket(io);

  // MongoDB Connection
  mongoose.connect(MONGODB_URI)
    .then(() => console.log('Connected to MongoDB'))
    .catch(error => console.error('MongoDB connection error:', error));

  app.use(cors());
  // Profile pictures are sent as base64 data URLs, so allow bodies larger than the 100kb default
  app.use(express.json({ limit: '2mb' }));

  // Health check for Render
  app.get('/api/health', (_req, res) => {
    const dbConnected = mongoose.connection.readyState === 1;
    res.status(dbConnected ? 200 : 503).json({ status: dbConnected ? 'ok' : 'degraded', db: dbConnected });
  });

  // API Routes
  app.use('/api', apiLimiter);
  app.use('/api/auth', authRoutes);
  app.use('/api/projects', projectRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/collaborations', collaborationRoutes);
  app.use('/api/endorsements', endorsementRoutes);
  app.use('/api/logs', logRoutes);
  app.use('/api/admin', adminRoutes);

  // Unknown API routes should return JSON, not the SPA's index.html
  app.use('/api', (_req, res) => {
    res.status(404).json({ message: 'Not found' });
  });

  // JSON error handler (malformed JSON, payload too large, uncaught route errors)
  app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (res.headersSent) return next(err);
    const status = err.status || err.statusCode || 500;
    if (status >= 500) console.error('Unhandled error:', err);
    const message =
      err.type === 'entity.too.large' ? 'Request is too large' :
      err.type === 'entity.parse.failed' ? 'Malformed JSON body' :
      status >= 500 ? 'Server error' : err.message;
    res.status(status).json({ message });
  });

  if (!isProduction) {
    // Vite middleware for development (loaded lazily so production never needs it)
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    const indexHtml = path.join(distPath, 'index.html');
    if (!fs.existsSync(indexHtml)) {
      console.error(`Frontend build not found at ${indexHtml}. Did you run "npm run build"?`);
    }

    // Never serve the bundled server code or its source map
    app.use(/^\/server\.cjs(\.map)?$/, (_req, res) => {
      res.status(404).end();
    });
    app.use('/assets', express.static(path.join(distPath, 'assets'), { immutable: true, maxAge: '1y' }));
    app.use(express.static(distPath, { index: false }));
    app.get('*', (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(indexHtml);
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT} (${isProduction ? 'production' : 'development'})`);
  });

  const shutdown = () => {
    console.log('Shutting down...');
    io.close();
    httpServer.close(() => {
      mongoose.connection.close().finally(() => process.exit(0));
    });
    setTimeout(() => process.exit(0), 10_000).unref();
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

startServer().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
