import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../db/database';
import { generateToken, authMiddleware } from '../middleware/auth';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            res.status(400).json({ error: 'Username and password are required' });
            return;
        }

        const result = await query('SELECT * FROM users WHERE username = $1', [username]);
        const user = result.rows[0];

        if (!user) {
            res.status(401).json({ error: 'Invalid credentials' });
            return;
        }

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            res.status(401).json({ error: 'Invalid credentials' });
            return;
        }

        const token = generateToken({
            id: user.id,
            username: user.username,
            role: user.role,
            athleteId: user.athlete_id || undefined,
        });

        res.json({
            token,
            user: {
                id: user.id,
                username: user.username,
                role: user.role,
                athleteId: user.athlete_id,
            },
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/auth/register (admin only for creating new users)
router.post('/register', authMiddleware, async (req: Request, res: Response) => {
    try {
        if (req.user?.role !== 'ADMIN') {
            res.status(403).json({ error: 'Admin access required' });
            return;
        }

        const { username, password, role, athleteId } = req.body;

        if (!username || !password || !role) {
            res.status(400).json({ error: 'Username, password, and role are required' });
            return;
        }

        const existingUserResult = await query('SELECT id FROM users WHERE username = $1', [username]);
        if (existingUserResult.rows.length > 0) {
            res.status(409).json({ error: 'Username already exists' });
            return;
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const id = uuidv4();

        await query(
            'INSERT INTO users (id, username, password, role, athlete_id) VALUES ($1, $2, $3, $4, $5)',
            [id, username, hashedPassword, role, athleteId || null]
        );

        res.status(201).json({ id, username, role });
    } catch (err) {
        console.error('Register error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/auth/me
router.get('/me', authMiddleware, async (req: Request, res: Response) => {
    // req.user is already set by middleware (decoded token), no DB call strictly needed
    // unless we want to fetch fresh data. Returning existing logic.
    res.json({ user: req.user });
});

export default router;
