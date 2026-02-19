import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { initializeDatabase } from './db/database';
import { setupSocketHandlers } from './socket/index';

import authRoutes from './routes/auth';
import athleteRoutes from './routes/athletes';
import eventRoutes from './routes/events';
import matchRoutes from './routes/matches';
import certificateRoutes from './routes/certificates';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: ['http://localhost:5173', 'http://localhost:3000'],
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
    },
});

// Middleware
app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: false // Disable CSP for simplicity in this demo, strictly check later
}));
app.use(cors({
    origin: ['http://localhost:5173', 'http://localhost:3000'],
    credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// Make io accessible to routes
app.set('io', io);

// Health check - BEFORE routes
app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/athletes', athleteRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/matches', matchRoutes);
app.use('/api/certificates', certificateRoutes);

// Serve Frontend Static Files
import path from 'path';
app.use(express.static(path.join(__dirname, '../../frontend/dist')));

// Global error handler — catches errors forwarded by asyncHandler
app.use((err: any, _req: any, res: any, _next: any) => {
    console.error('❌ Unhandled error:', err.message || err);
    const status = err.status || err.statusCode || 500;
    res.status(status).json({
        error: err.message || 'Internal server error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
});

// Catch-all route for SPA - AFTER API routes and error handler (wait, no error handler should be last middleware, but SPA route is a normal route handler)
// We need to place this BEFORE error handler if we want to handle 404s as index.html, OR simply as a route.
// Express executes in order.
app.get('*', (_req, res) => {
    res.sendFile(path.join(__dirname, '../../frontend/dist/index.html'));
});

// Dashboard stats
app.get('/api/stats', (_req, res) => {
    try {
        const { default: db } = require('./db/database');
        const totalAthletes = (db.prepare('SELECT COUNT(*) as count FROM athletes').get() as any).count;
        const validAthletes = (db.prepare("SELECT COUNT(*) as count FROM athletes WHERE status = 'VALID'").get() as any).count;
        const pendingAthletes = (db.prepare("SELECT COUNT(*) as count FROM athletes WHERE status = 'PENDING'").get() as any).count;
        const totalEvents = (db.prepare('SELECT COUNT(*) as count FROM events').get() as any).count;
        const ongoingEvents = (db.prepare("SELECT COUNT(*) as count FROM events WHERE status = 'ONGOING'").get() as any).count;
        const totalMatches = (db.prepare('SELECT COUNT(*) as count FROM matches').get() as any).count;
        const completedMatches = (db.prepare("SELECT COUNT(*) as count FROM matches WHERE status = 'COMPLETED'").get() as any).count;
        const totalCertificates = (db.prepare('SELECT COUNT(*) as count FROM certificates').get() as any).count;

        res.json({
            athletes: { total: totalAthletes, valid: validAthletes, pending: pendingAthletes },
            events: { total: totalEvents, ongoing: ongoingEvents },
            matches: { total: totalMatches, completed: completedMatches },
            certificates: totalCertificates,
        });
    } catch (err) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Setup Socket.io handlers
setupSocketHandlers(io);

// Initialize DB and start
initializeDatabase();

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
    console.log(`
  ╔═══════════════════════════════════════════════╗
  ║  🥋 Karate Tournament Management System 🥋   ║
  ║                                               ║
  ║  Server running on http://localhost:${PORT}      ║
  ║  WebSocket enabled                            ║
  ║  Database: SQLite (WAL mode)                  ║
  ╚═══════════════════════════════════════════════╝
  `);
});

export { app, io };
