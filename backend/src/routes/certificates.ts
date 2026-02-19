import { Router, Request, Response } from 'express';
import { query, withTransaction } from '../db/database';
import { authMiddleware, requireRole, verifyToken } from '../middleware/auth';
import { v4 as uuidv4 } from 'uuid';
import PDFDocument from 'pdfkit';

const router = Router();

// GET /api/certificates
router.get('/', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { event_id, athlete_id } = req.query;
        let sql = `
            SELECT c.*, a.name as athlete_name, a.dojo, e.name as event_name, e.event_code
            FROM certificates c
            JOIN athletes a ON c.athlete_id = a.id
            JOIN events e ON c.event_id = e.id
            WHERE 1=1
        `;
        const params: any[] = [];

        if (event_id) {
            params.push(event_id);
            sql += ` AND c.event_id = $${params.length}`;
        }
        if (athlete_id) {
            params.push(athlete_id);
            sql += ` AND c.athlete_id = $${params.length}`;
        }

        sql += ' ORDER BY c.issued_at DESC';

        const result = await query(sql, params);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/certificates/generate - Auto-generate for event winners
router.post('/generate', authMiddleware, requireRole('ADMIN'), async (req: Request, res: Response) => {
    try {
        const { event_id } = req.body;

        if (!event_id) {
            res.status(400).json({ error: 'event_id is required' });
            return;
        }

        const eventResult = await query('SELECT * FROM events WHERE id = $1', [event_id]);
        if (eventResult.rows.length === 0) {
            res.status(404).json({ error: 'Event not found' });
            return;
        }

        // Find matches to determine winners
        const matchesResult = await query(`
            SELECT * FROM matches WHERE event_id = $1 ORDER BY round DESC, match_order
        `, [event_id]);
        const matches = matchesResult.rows;

        if (matches.length === 0) {
            res.status(400).json({ error: 'No matches found for this event' });
            return;
        }

        const maxRound = Math.max(...matches.map((m: any) => m.round));
        const finalMatch = matches.find((m: any) => m.round === maxRound);

        const generatedCerts: any[] = [];

        await withTransaction(async (client) => {
            // Logic to determine medalists
            if (finalMatch && finalMatch.winner_id) {
                // Gold - winner of final
                const goldId = uuidv4();
                await client.query(`
                    INSERT INTO certificates (id, athlete_id, event_id, type) VALUES ($1, $2, $3, 'GOLD')
                    ON CONFLICT DO NOTHING
                `, [goldId, finalMatch.winner_id, event_id]);
                generatedCerts.push({ id: goldId, type: 'GOLD', athlete_id: finalMatch.winner_id });

                // Silver - loser of final
                const silverId = uuidv4();
                const silverAthleteId = finalMatch.athlete1_id === finalMatch.winner_id
                    ? finalMatch.athlete2_id
                    : finalMatch.athlete1_id;

                if (silverAthleteId) {
                    await client.query(`
                        INSERT INTO certificates (id, athlete_id, event_id, type) VALUES ($1, $2, $3, 'SILVER')
                        ON CONFLICT DO NOTHING
                    `, [silverId, silverAthleteId, event_id]);
                    generatedCerts.push({ id: silverId, type: 'SILVER', athlete_id: silverAthleteId });
                }

                // Bronze - losers of semi-finals
                const semiFinals = matches.filter((m: any) => m.round === maxRound - 1);
                for (const semi of semiFinals) {
                    if (semi.winner_id) {
                        const bronzeAthleteId = semi.athlete1_id === semi.winner_id
                            ? semi.athlete2_id
                            : semi.athlete1_id;

                        if (bronzeAthleteId) {
                            const bronzeId = uuidv4();
                            await client.query(`
                                INSERT INTO certificates (id, athlete_id, event_id, type) VALUES ($1, $2, $3, 'BRONZE')
                                ON CONFLICT DO NOTHING
                            `, [bronzeId, bronzeAthleteId, event_id]);
                            generatedCerts.push({ id: bronzeId, type: 'BRONZE', athlete_id: bronzeAthleteId });
                        }
                    }
                }
            }
        });

        // Fetch all certs with names
        const allCertsResult = await query(`
            SELECT c.*, a.name as athlete_name, a.dojo, e.name as event_name
            FROM certificates c
            JOIN athletes a ON c.athlete_id = a.id
            JOIN events e ON c.event_id = e.id
            WHERE c.event_id = $1
            ORDER BY CASE c.type WHEN 'GOLD' THEN 1 WHEN 'SILVER' THEN 2 WHEN 'BRONZE' THEN 3 ELSE 4 END
        `, [event_id]);

        res.json({ message: `Generated certificates`, certificates: allCertsResult.rows });
    } catch (err) {
        console.error('Certificate generation error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/certificates/:id/pdf - Generate PDF certificate
// Supports auth via query param ?token= for direct browser links (window.open)
router.get('/:id/pdf', async (req: Request, res: Response) => {
    // Allow token from query string for direct open in browser tab
    const token = (req.query.token as string) || req.headers.authorization?.split(' ')[1];
    if (!token) {
        res.status(401).json({ error: 'Access token required' });
        return;
    }
    try {
        req.user = verifyToken(token);
    } catch {
        res.status(401).json({ error: 'Invalid or expired token' });
        return;
    }

    try {
        const certResult = await query(`
            SELECT c.*, a.name as athlete_name, a.dojo, e.name as event_name, e.event_code, e.start_date
            FROM certificates c
            JOIN athletes a ON c.athlete_id = a.id
            JOIN events e ON c.event_id = e.id
            WHERE c.id = $1
        `, [req.params.id]);

        const cert = certResult.rows[0];

        if (!cert) {
            res.status(404).json({ error: 'Certificate not found' });
            return;
        }

        const doc = new PDFDocument({
            layout: 'landscape',
            size: 'A4',
            margins: { top: 50, bottom: 50, left: 60, right: 60 },
        });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename=certificate-${cert.id}.pdf`);
        doc.pipe(res);

        const medalColors: Record<string, string> = {
            GOLD: '#FFD700',
            SILVER: '#C0C0C0',
            BRONZE: '#CD7F32',
            PARTICIPATION: '#4A90D9',
        };

        const color = medalColors[cert.type] || '#333';

        // Border
        doc.rect(20, 20, doc.page.width - 40, doc.page.height - 40)
            .lineWidth(3)
            .strokeColor(color)
            .stroke();

        doc.rect(30, 30, doc.page.width - 60, doc.page.height - 60)
            .lineWidth(1)
            .strokeColor(color)
            .stroke();

        // Title
        doc.fontSize(36)
            .fillColor(color)
            .font('Helvetica-Bold')
            .text('CERTIFICATE OF ACHIEVEMENT', 0, 80, { align: 'center' });

        // Medal type
        doc.fontSize(24)
            .fillColor(color)
            .text(`🏅 ${cert.type} MEDAL`, 0, 140, { align: 'center' });

        // Divider
        doc.moveTo(200, 185).lineTo(doc.page.width - 200, 185).strokeColor(color).stroke();

        // This certifies
        doc.fontSize(14)
            .fillColor('#555')
            .font('Helvetica')
            .text('This certifies that', 0, 210, { align: 'center' });

        // Athlete name
        doc.fontSize(32)
            .fillColor('#1a1a1a')
            .font('Helvetica-Bold')
            .text(cert.athlete_name, 0, 240, { align: 'center' });

        // Dojo
        doc.fontSize(16)
            .fillColor('#666')
            .font('Helvetica')
            .text(`from ${cert.dojo}`, 0, 285, { align: 'center' });

        // Achievement text
        doc.fontSize(14)
            .fillColor('#555')
            .text(`has been awarded the ${cert.type} medal at`, 0, 320, { align: 'center' });

        // Event name
        doc.fontSize(22)
            .fillColor('#1a1a1a')
            .font('Helvetica-Bold')
            .text(cert.event_name, 0, 350, { align: 'center' });

        // Date
        doc.fontSize(12)
            .fillColor('#888')
            .font('Helvetica')
            .text(`Event Code: ${cert.event_code} | Date: ${cert.start_date}`, 0, 390, { align: 'center' });

        // Issued date
        doc.fontSize(11)
            .fillColor('#999')
            .text(`Issued: ${new Date(cert.issued_at).toLocaleDateString()}`, 0, 430, { align: 'center' });

        // Signature lines
        doc.moveTo(120, 480).lineTo(320, 480).strokeColor('#999').stroke();
        doc.fontSize(10).fillColor('#999').text('Tournament Director', 120, 485, { width: 200, align: 'center' });

        doc.moveTo(doc.page.width - 320, 480).lineTo(doc.page.width - 120, 480).strokeColor('#999').stroke();
        doc.text('Head Referee', doc.page.width - 320, 485, { width: 200, align: 'center' });

        doc.end();
    } catch (err) {
        console.error('PDF generation error:', err);
        res.status(500).json({ error: 'Failed to generate PDF' });
    }
});

// POST /api/certificates/:id/redeem
router.post('/:id/redeem', authMiddleware, requireRole('ADMIN'), async (req: Request, res: Response) => {
    try {
        const certResult = await query('SELECT * FROM certificates WHERE id = $1', [req.params.id]);
        const cert = certResult.rows[0];

        if (!cert) {
            res.status(404).json({ error: 'Certificate not found' });
            return;
        }

        await query("UPDATE certificates SET redeemed = 1, redeemed_at = CURRENT_TIMESTAMP WHERE id = $1", [req.params.id]);

        const updatedResult = await query(`
            SELECT c.*, a.name as athlete_name, a.dojo, e.name as event_name
            FROM certificates c
            JOIN athletes a ON c.athlete_id = a.id
            JOIN events e ON c.event_id = e.id
            WHERE c.id = $1
        `, [req.params.id]);

        res.json(updatedResult.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
