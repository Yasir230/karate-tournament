import { Router, Request, Response } from 'express';
import { query, withTransaction } from '../db/database';
import { authMiddleware, requireRole } from '../middleware/auth';
import { v4 as uuidv4 } from 'uuid';
import QRCode from 'qrcode';
import multer from 'multer';
import * as XLSX from 'xlsx';
import JsBarcode from 'jsbarcode';
import { createCanvas } from 'canvas';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

function calculateAgeClass(birthDate: string): string {
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
        age--;
    }
    if (age >= 3 && age <= 15) return 'A';
    if (age >= 16 && age <= 30) return 'B';
    if (age >= 31 && age <= 60) return 'C';
    return 'B';
}

function calculateWeightClass(weight: number): string {
    if (weight >= 20 && weight <= 40) return '1';
    if (weight > 40 && weight <= 60) return '2';
    if (weight > 60 && weight <= 80) return '3';
    if (weight > 80) return '3';
    return '1';
}

/** Generate a Code 128 barcode as a data URL */
function generateBarcode(text: string): string {
    const canvas = createCanvas(300, 100);
    JsBarcode(canvas, text, {
        format: 'CODE128',
        width: 2,
        height: 60,
        displayValue: true,
        fontSize: 14,
        margin: 10,
        background: '#ffffff',
        lineColor: '#000000',
    });
    return canvas.toDataURL('image/png');
}

/** Generate a short barcode-friendly ID from UUID */
function toBarcodeId(id: string): string {
    return 'KRT-' + id.replace(/-/g, '').substring(0, 10).toUpperCase();
}

// GET /api/athletes
router.get('/', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { status, age_class, weight_class, gender, search, event_id } = req.query;
        let sql = 'SELECT * FROM athletes WHERE 1=1';
        const params: any[] = [];

        if (status) {
            params.push(status);
            sql += ` AND status = $${params.length}`;
        }
        if (age_class) {
            params.push(age_class);
            sql += ` AND age_class = $${params.length}`;
        }
        if (weight_class) {
            params.push(weight_class);
            sql += ` AND weight_class = $${params.length}`;
        }
        if (gender) {
            params.push(gender);
            sql += ` AND gender = $${params.length}`;
        }
        if (search) {
            params.push(`%${search}%`);
            params.push(`%${search}%`);
            sql += ` AND (name LIKE $${params.length - 1} OR dojo LIKE $${params.length})`;
        }

        sql += ' ORDER BY created_at DESC';

        let result = await query(sql, params);
        let athletes = result.rows;

        if (event_id) {
            const eventAthleteIdsResult = await query(
                'SELECT athlete_id FROM event_athletes WHERE event_id = $1',
                [event_id]
            );
            const eventAthleteIds = eventAthleteIdsResult.rows.map((ea: any) => ea.athlete_id);
            athletes = athletes.filter((a: any) => eventAthleteIds.includes(a.id));
        }

        res.json(athletes);
    } catch (err) {
        console.error('Get athletes error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/athletes/:id
router.get('/:id', authMiddleware, async (req: Request, res: Response) => {
    try {
        const result = await query('SELECT * FROM athletes WHERE id = $1', [req.params.id]);
        const athlete = result.rows[0];
        if (!athlete) {
            res.status(404).json({ error: 'Athlete not found' });
            return;
        }
        res.json(athlete);
    } catch (err) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/athletes
router.post('/', authMiddleware, requireRole('ADMIN'), async (req: Request, res: Response) => {
    try {
        const { name, dojo, birth_date, weight, gender } = req.body;

        if (!name || !dojo || !birth_date || !weight || !gender) {
            res.status(400).json({ error: 'All fields are required' });
            return;
        }

        const id = uuidv4();
        const age_class = calculateAgeClass(birth_date);
        const weight_class = calculateWeightClass(weight);

        // Generate QR code
        const qrData = JSON.stringify({ id, name, dojo, age_class, weight_class });
        const qr_code = await QRCode.toDataURL(qrData, { width: 300 });

        // Generate barcode (Code 128)
        const barcodeId = toBarcodeId(id);
        const barcode = generateBarcode(barcodeId);

        await query(`
            INSERT INTO athletes (id, name, dojo, birth_date, weight, gender, age_class, weight_class, qr_code, barcode, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'PENDING')
        `, [id, name, dojo, birth_date, weight, gender, age_class, weight_class, qr_code, barcode]);

        const result = await query('SELECT * FROM athletes WHERE id = $1', [id]);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Create athlete error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// PUT /api/athletes/:id
router.put('/:id', authMiddleware, requireRole('ADMIN'), async (req: Request, res: Response) => {
    try {
        const existingResult = await query('SELECT * FROM athletes WHERE id = $1', [req.params.id]);
        const existing = existingResult.rows[0];

        if (!existing) {
            res.status(404).json({ error: 'Athlete not found' });
            return;
        }

        const { name, dojo, birth_date, weight, gender, status } = req.body;

        const updatedName = name || existing.name;
        const updatedDojo = dojo || existing.dojo;
        const updatedBirthDate = birth_date || existing.birth_date;
        const updatedWeight = weight ?? existing.weight;
        const updatedGender = gender || existing.gender;
        const updatedStatus = status || existing.status;

        const age_class = calculateAgeClass(updatedBirthDate);
        const weight_class = calculateWeightClass(updatedWeight);

        await query(`
            UPDATE athletes 
            SET name = $1, dojo = $2, birth_date = $3, weight = $4, gender = $5, 
                age_class = $6, weight_class = $7, status = $8, updated_at = CURRENT_TIMESTAMP
            WHERE id = $9
        `, [updatedName, updatedDojo, updatedBirthDate, updatedWeight, updatedGender,
            age_class, weight_class, updatedStatus, req.params.id]);

        const result = await query('SELECT * FROM athletes WHERE id = $1', [req.params.id]);
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Update athlete error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// DELETE /api/athletes/:id
router.delete('/:id', authMiddleware, requireRole('ADMIN'), async (req: Request, res: Response) => {
    try {
        const result = await query('DELETE FROM athletes WHERE id = $1', [req.params.id]);
        if (result.rowCount === 0) {
            res.status(404).json({ error: 'Athlete not found' });
            return;
        }
        res.json({ message: 'Athlete deleted' });
    } catch (err) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/athletes/import
router.post('/import', authMiddleware, requireRole('ADMIN'), upload.single('file'), async (req: Request, res: Response) => {
    try {
        if (!req.file) {
            res.status(400).json({ error: 'File is required' });
            return;
        }

        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(sheet) as any[];

        const inserted: any[] = [];
        const errors: any[] = [];

        // Use transaction for bulk import
        await withTransaction(async (client) => {
            for (let i = 0; i < data.length; i++) {
                const row = data[i];
                try {
                    const name = row.name || row.Name || row.NAME;
                    const dojo = row.dojo || row.Dojo || row.DOJO;
                    const birth_date = row.birth_date || row.BirthDate || row['Birth Date'];
                    const weight = parseFloat(row.weight || row.Weight || row.WEIGHT);
                    const gender = (row.gender || row.Gender || row.GENDER || '').toUpperCase();

                    if (!name || !dojo || !birth_date || isNaN(weight) || !gender) {
                        errors.push({ row: i + 2, error: 'Missing required fields' });
                        continue;
                    }

                    const id = uuidv4();
                    const age_class = calculateAgeClass(birth_date);
                    const weight_class = calculateWeightClass(weight);
                    const qrData = JSON.stringify({ id, name, dojo, age_class, weight_class });
                    const qr_code = await QRCode.toDataURL(qrData, { width: 300 });
                    const barcodeId = toBarcodeId(id);
                    const barcode = generateBarcode(barcodeId);

                    await client.query(`
                        INSERT INTO athletes (id, name, dojo, birth_date, weight, gender, age_class, weight_class, qr_code, barcode, status)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'PENDING')
                    `, [id, name, dojo, birth_date, weight, gender, age_class, weight_class, qr_code, barcode]);

                    inserted.push({ id, name, dojo });
                } catch (rowErr: any) {
                    errors.push({ row: i + 2, error: rowErr.message });
                }
            }
        });

        res.json({
            message: `Imported ${inserted.length} athletes`,
            imported: inserted.length,
            errors: errors.length,
            errorDetails: errors,
        });
    } catch (err) {
        console.error('Import error:', err);
        res.status(500).json({ error: 'Import failed' });
    }
});

// GET /api/athletes/:id/qr
router.get('/:id/qr', authMiddleware, async (req: Request, res: Response) => {
    try {
        const result = await query('SELECT * FROM athletes WHERE id = $1', [req.params.id]);
        const athlete = result.rows[0];
        if (!athlete) {
            res.status(404).json({ error: 'Athlete not found' });
            return;
        }

        if (athlete.qr_code) {
            res.json({ qr_code: athlete.qr_code });
        } else {
            const qrData = JSON.stringify({ id: athlete.id, name: athlete.name, dojo: athlete.dojo });
            const qr_code = await QRCode.toDataURL(qrData, { width: 300 });
            await query('UPDATE athletes SET qr_code = $1 WHERE id = $2', [qr_code, athlete.id]);
            res.json({ qr_code });
        }
    } catch (err) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/athletes/:id/barcode
router.get('/:id/barcode', authMiddleware, async (req: Request, res: Response) => {
    try {
        const result = await query('SELECT * FROM athletes WHERE id = $1', [req.params.id]);
        const athlete = result.rows[0];
        if (!athlete) {
            res.status(404).json({ error: 'Athlete not found' });
            return;
        }

        if (athlete.barcode) {
            res.json({ barcode: athlete.barcode });
        } else {
            const barcodeId = toBarcodeId(athlete.id);
            const barcode = generateBarcode(barcodeId);
            await query('UPDATE athletes SET barcode = $1 WHERE id = $2', [barcode, athlete.id]);
            res.json({ barcode });
        }
    } catch (err) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/athletes/:id/verify - QR/Barcode verification
router.post('/:id/verify', authMiddleware, requireRole('ADMIN'), async (req: Request, res: Response) => {
    try {
        const { weight } = req.body;
        const result = await query('SELECT * FROM athletes WHERE id = $1', [req.params.id]);
        const athlete = result.rows[0];

        if (!athlete) {
            res.status(404).json({ error: 'Athlete not found' });
            return;
        }

        const updatedWeight = weight ?? athlete.weight;
        const weight_class = calculateWeightClass(updatedWeight);

        await query(`
            UPDATE athletes SET status = 'VALID', weight = $1, weight_class = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3
        `, [updatedWeight, weight_class, req.params.id]);

        const updatedResult = await query('SELECT * FROM athletes WHERE id = $1', [req.params.id]);
        res.json(updatedResult.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
