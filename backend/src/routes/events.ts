import { Router, Request, Response } from 'express';
import { query, withTransaction } from '../db/database';
import { authMiddleware, requireRole } from '../middleware/auth';
import { v4 as uuidv4 } from 'uuid';
import { generateBracket } from '../services/bracket';

const router = Router();

// GET /api/events
router.get('/', authMiddleware, async (req: Request, res: Response) => {
    try {
        const result = await query('SELECT * FROM events ORDER BY start_date DESC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/events/:id
router.get('/:id', authMiddleware, async (req: Request, res: Response) => {
    try {
        const eventResult = await query('SELECT * FROM events WHERE id = $1', [req.params.id]);
        const event = eventResult.rows[0];

        if (!event) {
            res.status(404).json({ error: 'Event not found' });
            return;
        }

        // Run fetches in parallel for performance
        const [athletesResult, matchesResult] = await Promise.all([
            query(`
                SELECT a.* FROM athletes a
                INNER JOIN event_athletes ea ON a.id = ea.athlete_id
                WHERE ea.event_id = $1
            `, [req.params.id]),
            query(`
                SELECT m.*, 
                    a1.name as athlete1_name, a1.dojo as athlete1_dojo,
                    a2.name as athlete2_name, a2.dojo as athlete2_dojo,
                    w.name as winner_name
                FROM matches m
                LEFT JOIN athletes a1 ON m.athlete1_id = a1.id
                LEFT JOIN athletes a2 ON m.athlete2_id = a2.id
                LEFT JOIN athletes w ON m.winner_id = w.id
                WHERE m.event_id = $1
                ORDER BY m.round, m.match_order
            `, [req.params.id])
        ]);

        res.json({ ...event, athletes: athletesResult.rows, matches: matchesResult.rows });
    } catch (err) {
        console.error('Get event error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/events
router.post('/', authMiddleware, requireRole('ADMIN'), async (req: Request, res: Response) => {
    try {
        const { name, start_date, end_date, location } = req.body;

        if (!name || !start_date || !end_date) {
            res.status(400).json({ error: 'Name, start_date, and end_date are required' });
            return;
        }

        const id = uuidv4();
        const dateStr = new Date(start_date as string).toISOString().slice(0, 10).replace(/-/g, '');
        const event_code: string = `KRT-${dateStr}-${id.slice(0, 4).toUpperCase()}`;

        await query(`
            INSERT INTO events (id, name, event_code, start_date, end_date, location, status)
            VALUES ($1, $2, $3, $4, $5, $6, 'UPCOMING')
        `, [id, name, event_code, start_date, end_date, location || null]);

        const result = await query('SELECT * FROM events WHERE id = $1', [id]);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Create event error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// PUT /api/events/:id
router.put('/:id', authMiddleware, requireRole('ADMIN'), async (req: Request, res: Response) => {
    try {
        const existingResult = await query('SELECT * FROM events WHERE id = $1', [req.params.id]);
        const existing = existingResult.rows[0];

        if (!existing) {
            res.status(404).json({ error: 'Event not found' });
            return;
        }

        const { name, start_date, end_date, location, status } = req.body;

        await query(`
            UPDATE events SET name = $1, start_date = $2, end_date = $3, location = $4, status = $5, updated_at = CURRENT_TIMESTAMP
            WHERE id = $6
        `, [
            name || existing.name,
            start_date || existing.start_date,
            end_date || existing.end_date,
            location ?? existing.location,
            status || existing.status,
            req.params.id
        ]);

        const result = await query('SELECT * FROM events WHERE id = $1', [req.params.id]);
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/events/:id/athletes - Register athletes to event
router.post('/:id/athletes', authMiddleware, requireRole('ADMIN'), async (req: Request, res: Response) => {
    try {
        const { athlete_ids } = req.body;

        if (!athlete_ids || !Array.isArray(athlete_ids)) {
            res.status(400).json({ error: 'athlete_ids array is required' });
            return;
        }

        const eventResult = await query('SELECT * FROM events WHERE id = $1', [req.params.id]);
        if (eventResult.rows.length === 0) {
            res.status(404).json({ error: 'Event not found' });
            return;
        }

        // Use transaction for bulk insert
        await withTransaction(async (client) => {
            for (const athleteId of athlete_ids) {
                // INSERT OR IGNORE logic in Postgres
                await client.query(
                    'INSERT INTO event_athletes (event_id, athlete_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                    [req.params.id, athleteId]
                );
            }
        });

        const athletesResult = await query(`
            SELECT a.* FROM athletes a
            INNER JOIN event_athletes ea ON a.id = ea.athlete_id
            WHERE ea.event_id = $1
        `, [req.params.id]);

        res.json({ message: `Registered ${athlete_ids.length} athletes`, athletes: athletesResult.rows });
    } catch (err) {
        console.error('Register athletes error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/events/:id/matches/generate-bracket
router.post('/:id/matches/generate-bracket', authMiddleware, requireRole('ADMIN'), async (req: Request, res: Response) => {
    try {
        const eventResult = await query('SELECT * FROM events WHERE id = $1', [req.params.id]);
        const event = eventResult.rows[0];

        if (!event) {
            res.status(404).json({ error: 'Event not found' });
            return;
        }

        // Get valid athletes registered for this event
        const athletesResult = await query(`
            SELECT a.* FROM athletes a
            INNER JOIN event_athletes ea ON a.id = ea.athlete_id
            WHERE ea.event_id = $1 AND a.status = 'VALID'
        `, [req.params.id]);
        const athletes = athletesResult.rows;

        if (athletes.length < 2) {
            res.status(400).json({ error: 'At least 2 valid athletes required to generate bracket' });
            return;
        }

        // Generate bracket logic (pure JS, no DB)
        const matches = generateBracket(athletes, req.params.id as string, event.event_code as string);

        // Transaction: Clear old matches -> Insert new matches -> Update Event Status
        await withTransaction(async (client) => {
            // Delete scores for matches in this event
            await client.query(`
                DELETE FROM scores WHERE match_id IN (SELECT id FROM matches WHERE event_id = $1)
            `, [req.params.id]);

            // Delete matches
            await client.query('DELETE FROM matches WHERE event_id = $1', [req.params.id]);

            // Insert new matches
            for (const m of matches) {
                await client.query(`
                    INSERT INTO matches (id, match_code, event_id, athlete1_id, athlete2_id, winner_id, round, match_order, arena, status, parent_match_id, slot)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                `, [m.id, m.match_code, m.event_id, m.athlete1_id, m.athlete2_id, m.winner_id, m.round, m.match_order, m.arena, m.status, m.parent_match_id, m.slot]);
            }

            // Update event status
            await client.query("UPDATE events SET status = 'ONGOING', updated_at = CURRENT_TIMESTAMP WHERE id = $1", [req.params.id]);
        });

        // Fetch created matches with details
        const createdMatchesResult = await query(`
            SELECT m.*, 
                a1.name as athlete1_name, a1.dojo as athlete1_dojo,
                a2.name as athlete2_name, a2.dojo as athlete2_dojo
            FROM matches m
            LEFT JOIN athletes a1 ON m.athlete1_id = a1.id
            LEFT JOIN athletes a2 ON m.athlete2_id = a2.id
            WHERE m.event_id = $1
            ORDER BY m.round, m.match_order
        `, [req.params.id]);

        res.json({ message: 'Bracket generated', matches: createdMatchesResult.rows });
    } catch (err) {
        console.error('Generate bracket error:', err);
        res.status(500).json({ error: 'Failed to generate bracket' });
    }
});

// GET /api/events/:id/matches — includes scores for each match
router.get('/:id/matches', authMiddleware, async (req: Request, res: Response) => {
    try {
        // Parallel fetch of matches and scores
        const [matchesResult, allScoresResult] = await Promise.all([
            query(`
                SELECT m.*, 
                    a1.name as athlete1_name, a1.dojo as athlete1_dojo,
                    a2.name as athlete2_name, a2.dojo as athlete2_dojo,
                    w.name as winner_name
                FROM matches m
                LEFT JOIN athletes a1 ON m.athlete1_id = a1.id
                LEFT JOIN athletes a2 ON m.athlete2_id = a2.id
                LEFT JOIN athletes w ON m.winner_id = w.id
                WHERE m.event_id = $1
                ORDER BY m.round, m.match_order
            `, [req.params.id]),

            query(`
                SELECT s.* FROM scores s
                INNER JOIN matches m ON s.match_id = m.id
                WHERE m.event_id = $1
            `, [req.params.id])
        ]);

        const matches = matchesResult.rows;
        const allScores = allScoresResult.rows;

        const scoresByMatch: Record<string, any[]> = {};
        for (const score of allScores) {
            if (!scoresByMatch[score.match_id]) scoresByMatch[score.match_id] = [];
            scoresByMatch[score.match_id].push(score);
        }

        const enrichedMatches = matches.map(m => ({
            ...m,
            scores: scoresByMatch[m.id] || [],
        }));

        res.json(enrichedMatches);
    } catch (err) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
