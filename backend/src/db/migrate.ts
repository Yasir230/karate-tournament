import { query, pool } from './database';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

async function migrate() {
    console.log('🔄 Starting migration...');

    try {
        // Users Table
        await query(`
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                role TEXT NOT NULL CHECK (role IN ('ADMIN', 'ATHLETE', 'SPECTATOR')),
                athlete_id TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Athletes Table
        await query(`
            CREATE TABLE IF NOT EXISTS athletes (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                dojo TEXT NOT NULL,
                birth_date TEXT NOT NULL,
                weight REAL NOT NULL,
                gender TEXT NOT NULL CHECK (gender IN ('MALE', 'FEMALE')),
                age_class TEXT CHECK (age_class IN ('A', 'B', 'C')),
                weight_class TEXT CHECK (weight_class IN ('1', '2', '3')),
                qr_code TEXT,
                barcode TEXT,
                status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'VALID', 'DISQUALIFIED')),
                photo_url TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Events Table
        await query(`
            CREATE TABLE IF NOT EXISTS events (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                event_code TEXT UNIQUE NOT NULL,
                start_date TEXT NOT NULL,
                end_date TEXT NOT NULL,
                location TEXT,
                status TEXT NOT NULL DEFAULT 'UPCOMING' CHECK (status IN ('UPCOMING', 'ONGOING', 'COMPLETED')),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Event Athletes Junction Table
        await query(`
            CREATE TABLE IF NOT EXISTS event_athletes (
                event_id TEXT NOT NULL,
                athlete_id TEXT NOT NULL,
                PRIMARY KEY (event_id, athlete_id),
                FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
                FOREIGN KEY (athlete_id) REFERENCES athletes(id) ON DELETE CASCADE
            );
        `);

        // Matches Table
        await query(`
            CREATE TABLE IF NOT EXISTS matches (
                id TEXT PRIMARY KEY,
                match_code TEXT NOT NULL,
                event_id TEXT NOT NULL,
                athlete1_id TEXT,
                athlete2_id TEXT,
                winner_id TEXT,
                round INTEGER NOT NULL,
                match_order INTEGER NOT NULL,
                arena TEXT DEFAULT 'A',
                status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'BYE')),
                parent_match_id TEXT,
                slot TEXT CHECK (slot IN ('athlete1', 'athlete2')),
                scheduled_time TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
                FOREIGN KEY (athlete1_id) REFERENCES athletes(id),
                FOREIGN KEY (athlete2_id) REFERENCES athletes(id),
                FOREIGN KEY (winner_id) REFERENCES athletes(id)
            );
        `);

        // Scores Table
        await query(`
            CREATE TABLE IF NOT EXISTS scores (
                id TEXT PRIMARY KEY,
                match_id TEXT NOT NULL,
                athlete_id TEXT NOT NULL,
                head_kicks INTEGER DEFAULT 0,
                body_kicks INTEGER DEFAULT 0,
                punches INTEGER DEFAULT 0,
                red_cards INTEGER DEFAULT 0,
                blue_cards INTEGER DEFAULT 0,
                fouls INTEGER DEFAULT 0,
                total_score INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
                FOREIGN KEY (athlete_id) REFERENCES athletes(id)
            );
        `);

        // Score Audit Log Table (Needed for Undo functionality)
        await query(`
            CREATE TABLE IF NOT EXISTS score_audit_log (
                id SERIAL PRIMARY KEY,
                match_id TEXT NOT NULL,
                athlete_id TEXT NOT NULL,
                action TEXT NOT NULL,
                old_value INTEGER,
                new_value INTEGER,
                performed_by TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE
            );
        `);

        // Certificates Table
        await query(`
            CREATE TABLE IF NOT EXISTS certificates (
                id TEXT PRIMARY KEY,
                athlete_id TEXT NOT NULL,
                event_id TEXT NOT NULL,
                type TEXT NOT NULL CHECK (type IN ('GOLD', 'SILVER', 'BRONZE', 'PARTICIPATION')),
                issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                redeemed INTEGER DEFAULT 0,
                redeemed_at TIMESTAMP,
                FOREIGN KEY (athlete_id) REFERENCES athletes(id),
                FOREIGN KEY (event_id) REFERENCES events(id)
            );
        `);

        // Indexes
        await query('CREATE INDEX IF NOT EXISTS idx_athletes_status ON athletes(status);');
        await query('CREATE INDEX IF NOT EXISTS idx_athletes_age_class ON athletes(age_class);');
        await query('CREATE INDEX IF NOT EXISTS idx_athletes_weight_class ON athletes(weight_class);');
        await query('CREATE INDEX IF NOT EXISTS idx_matches_event_id ON matches(event_id);');
        await query('CREATE INDEX IF NOT EXISTS idx_matches_round ON matches(round);');
        await query('CREATE INDEX IF NOT EXISTS idx_scores_match_id ON scores(match_id);');
        await query('CREATE INDEX IF NOT EXISTS idx_certificates_athlete_id ON certificates(athlete_id);');
        await query('CREATE INDEX IF NOT EXISTS idx_certificates_event_id ON certificates(event_id);');

        // Seed default admin user if not exists
        const adminPassword = bcrypt.hashSync('admin123', 10);
        await query(`
            INSERT INTO users (id, username, password, role)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (username) DO NOTHING;
        `, [uuidv4(), 'admin', adminPassword, 'ADMIN']);
        console.log('✅ Default admin user ensured');

        console.log('✅ Migration completed successfully');
    } catch (err) {
        console.error('❌ Migration failed:', err);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

migrate();
