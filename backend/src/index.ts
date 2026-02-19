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

const allowedOrigins = process.env.NODE_ENV === 'production'
    ? ['https://karate-tournament.onrender.com']
    : ['http://localhost:5173', 'http://localhost:3000'];

const io = new Server(httpServer, {
    cors: {
        origin: allowedOrigins,
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
    },
});

// Middleware
app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: false // Disable CSP for simplicity in this demo, strictly check later
}));
app.use(cors({
    origin: allowedOrigins,
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

// Dashboard stats
// Stats route moved up
app.get('/api/stats', async (_req, res) => {
    try {
        const { pool } = require('./db/database');

        // Helper function for count queries
        const getCount = async (table: string, condition = '') => {
            const result = await pool.query(`SELECT COUNT(*) as count FROM ${table} ${condition}`);
            return parseInt(result.rows[0].count);
        };

        const totalAthletes = await getCount('athletes');
        const validAthletes = await getCount('athletes', "WHERE status = 'VALID'");
        const pendingAthletes = await getCount('athletes', "WHERE status = 'PENDING'");
        const totalEvents = await getCount('events');
        const ongoingEvents = await getCount('events', "WHERE status = 'ONGOING'");
        const totalMatches = await getCount('matches');
        const completedMatches = await getCount('matches', "WHERE status = 'COMPLETED'");
        const totalCertificates = await getCount('certificates');

        res.json({
            athletes: { total: totalAthletes, valid: validAthletes, pending: pendingAthletes },
            events: { total: totalEvents, ongoing: ongoingEvents },
            matches: { total: totalMatches, completed: completedMatches },
            certificates: totalCertificates,
        });
    } catch (err) {
        console.error('Stats error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Serve Frontend Static Files
import path from 'path';
// Resolved path: backend/dist/backend/src/index.js -> ../../../../../frontend/dist
const frontendPath = path.join(__dirname, '../../../../../frontend/dist');
app.use(express.static(frontendPath));

// Global error handler — catches errors forwarded by asyncHandler
app.use((err: any, _req: any, res: any, _next: any) => {
    console.error('❌ Unhandled error:', err.message || err);
    const status = err.status || err.statusCode || 500;
    res.status(status).json({
        error: err.message || 'Internal server error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
});

// Catch-all route for SPA - AFTER API routes and error handler
app.get('*', (_req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
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
  ║  Database: PostgreSQL                         ║
  ╚═══════════════════════════════════════════════╝
  `);
});

export { app, io };
