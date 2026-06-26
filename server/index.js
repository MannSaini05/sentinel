import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import { getDb, closeDb } from './db/schema.js';
import { startSimulator, stopSimulator } from './services/simulator.js';

// Route imports
import authRoutes from './routes/auth.js';
import usageRoutes from './routes/usage.js';
import analyticsRoutes from './routes/analytics.js';
import alertRoutes from './routes/alerts.js';
import settingsRoutes from './routes/settings.js';
import { streamRouter } from './sse/stream.js';
import dbViewerRoutes from './routes/dbViewer.js';
import trackRoutes from './routes/track.js';
import { startOnlineMonitor, stopOnlineMonitor } from './services/onlineMonitor.js';

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Middleware ──────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.CLIENT_ORIGIN || '*',
  credentials: true,
}));
app.use(express.json());

// ─── Health Check ───────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Sentinel API',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// ─── API Routes ─────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/usage', usageRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/stream', streamRouter);
app.use('/api/db', dbViewerRoutes);
app.use('/api/usage/track', trackRoutes);

// ─── 404 Handler ────────────────────────────────────────────────────────
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
});

// ─── Serve Frontend (Production) ────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath));

// SPA catch-all: serve index.html for all non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

// ─── Global Error Handler ───────────────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error('[Server] Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ─── Initialize and Start ───────────────────────────────────────────────
function start() {
  // Initialize database (creates tables if they don't exist)
  const db = getDb();
  console.log('[DB] Database initialized successfully');

  // Start the usage simulator
  startSimulator();

  // Start the online monitor (checks for offline children)
  startOnlineMonitor();

  // Start the HTTP server
  const server = app.listen(PORT, () => {
    console.log('');
    console.log('  ╔═══════════════════════════════════════════════╗');
    console.log('  ║                                               ║');
    console.log('  ║   🛡️  Sentinel API Server                     ║');
    console.log(`  ║   🌐 http://localhost:${PORT}                    ║`);
    console.log('  ║   📡 SSE: /api/stream                         ║');
    console.log('  ║                                               ║');
    console.log('  ╚═══════════════════════════════════════════════╝');
    console.log('');
  });

  // ─── Graceful Shutdown ──────────────────────────────────────────────
  function shutdown(signal) {
    console.log(`\n[Server] Received ${signal}. Shutting down gracefully...`);
    stopSimulator();
    stopOnlineMonitor();
    server.close(() => {
      closeDb();
      console.log('[Server] Server closed. Goodbye! 👋');
      process.exit(0);
    });

    // Force exit after 5 seconds
    setTimeout(() => {
      console.error('[Server] Forced shutdown after timeout.');
      process.exit(1);
    }, 5000);
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start();

export default app;
