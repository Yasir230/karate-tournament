import { pool } from './database';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';
import { createCanvas } from 'canvas';

const DOJOS = [
    'Tiger Dojo', 'Dragon Dojo', 'Phoenix Dojo', 'Eagle Dojo',
    'Lion Dojo', 'Snake Dojo', 'Crane Dojo', 'Wolf Dojo'
];

const MALE_NAMES = [
    'Arif Rahman', 'Budi Santoso', 'Cahyo Pratama', 'Dimas Wicaksono',
    'Erik Saputra', 'Fajar Hidayat', 'Gilang Permana', 'Hasan Wijaya',
    'Irfan Hakim', 'Joko Susanto', 'Kenzo Tanaka', 'Leo Firmansyah',
    'Maulana Putra', 'Niko Prasetyo', 'Oscar Nugroho', 'Pandu Setiawan',
];

const FEMALE_NAMES = [
    'Ayu Lestari', 'Bunga Citra', 'Citra Dewi', 'Dina Fitriani',
    'Eka Sari', 'Fitri Handayani', 'Gita Purnama', 'Hana Safira',
    'Indah Permata', 'Jasmine Kusuma', 'Kartika Sari', 'Luna Amelia',
    'Maya Anggraeni', 'Nisa Rahmawati', 'Olivia Putri', 'Putri Maharani',
];

function randomDate(startYear: number, endYear: number): string {
    const year = startYear + Math.floor(Math.random() * (endYear - startYear));
    const month = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0');
    const day = String(Math.floor(Math.random() * 28) + 1).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function randomWeight(): number {
    return Math.round((25 + Math.random() * 55) * 10) / 10;
}

function calculateAgeClass(birthDate: string): string {
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age--;
    if (age >= 3 && age <= 15) return 'A';
    if (age >= 16 && age <= 30) return 'B';
    return 'C';
}

function calculateWeightClass(weight: number): string {
    if (weight <= 40) return '1';
    if (weight <= 60) return '2';
    return '3';
}

/** Generate a Code 128 barcode as data URL */
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

function toBarcodeId(id: string): string {
    return 'KRT-' + id.replace(/-/g, '').substring(0, 10).toUpperCase();
}

async function seed() {
    console.log('🌱 Seeding database...\n');

    // Clear existing data
    await pool.query('DELETE FROM certificates');
    await pool.query('DELETE FROM scores');
    await pool.query('DELETE FROM matches');
    await pool.query('DELETE FROM event_athletes');
    await pool.query('DELETE FROM events');
    await pool.query('DELETE FROM athletes');
    await pool.query('DELETE FROM users');

    // Add barcode column if missing (migration) - PostgreSQL specific
    try {
        await pool.query('ALTER TABLE athletes ADD COLUMN IF NOT EXISTS barcode TEXT');
    } catch { /* column already exists */ }

    // Create admin user
    const adminId = uuidv4();
    const adminPassword = await bcrypt.hash('admin123', 10);
    await pool.query(
        'INSERT INTO users (id, username, password, role) VALUES ($1, $2, $3, $4)',
        [adminId, 'admin', adminPassword, 'ADMIN']
    );
    console.log('✅ Admin user created: admin / admin123');

    // Create spectator user
    const specId = uuidv4();
    const specPassword = await bcrypt.hash('spectator', 10);
    await pool.query(
        'INSERT INTO users (id, username, password, role) VALUES ($1, $2, $3, $4)',
        [specId, 'spectator', specPassword, 'SPECTATOR']
    );
    console.log('✅ Spectator user created: spectator / spectator');

    // Create 32 athletes (16 male, 16 female) with QR + Barcode
    const athleteIds: string[] = [];
    const insertAthleteQuery = `
    INSERT INTO athletes (id, name, dojo, birth_date, weight, gender, age_class, weight_class, qr_code, barcode, status)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'VALID')
  `;

    console.log('⏳ Generating athlete QR codes & barcodes...');

    for (let i = 0; i < 16; i++) {
        const id = uuidv4();
        const name = MALE_NAMES[i];
        const dojo = DOJOS[i % DOJOS.length];
        const birthDate = randomDate(1996, 2010);
        const weight = randomWeight();
        const ageClass = calculateAgeClass(birthDate);
        const weightClass = calculateWeightClass(weight);
        const qrData = JSON.stringify({ id, name, dojo, age_class: ageClass, weight_class: weightClass });
        const qrCode = await QRCode.toDataURL(qrData, { width: 300 });
        const barcodeId = toBarcodeId(id);
        const barcode = generateBarcode(barcodeId);

        await pool.query(insertAthleteQuery, [id, name, dojo, birthDate, weight, 'MALE', ageClass, weightClass, qrCode, barcode]);
        athleteIds.push(id);
    }

    for (let i = 0; i < 16; i++) {
        const id = uuidv4();
        const name = FEMALE_NAMES[i];
        const dojo = DOJOS[i % DOJOS.length];
        const birthDate = randomDate(1996, 2010);
        const weight = randomWeight();
        const ageClass = calculateAgeClass(birthDate);
        const weightClass = calculateWeightClass(weight);
        const qrData = JSON.stringify({ id, name, dojo, age_class: ageClass, weight_class: weightClass });
        const qrCode = await QRCode.toDataURL(qrData, { width: 300 });
        const barcodeId = toBarcodeId(id);
        const barcode = generateBarcode(barcodeId);

        await pool.query(insertAthleteQuery, [id, name, dojo, birthDate, weight, 'FEMALE', ageClass, weightClass, qrCode, barcode]);
        athleteIds.push(id);
    }

    console.log(`✅ Created ${athleteIds.length} athletes (with QR + Barcode)`);

    // Create an event
    const eventId = uuidv4();
    const eventCode = 'KRT-20260214-MAIN';
    await pool.query(`
    INSERT INTO events (id, name, event_code, start_date, end_date, location, status)
    VALUES ($1, $2, $3, $4, $5, $6, 'UPCOMING')
  `, [eventId, 'Karate Championship 2026', eventCode, '2026-03-01', '2026-03-02', 'Jakarta Sports Center']);

    // Register all athletes to event
    const insertEventAthleteQuery = 'INSERT INTO event_athletes (event_id, athlete_id) VALUES ($1, $2)';
    for (const aid of athleteIds) {
        await pool.query(insertEventAthleteQuery, [eventId, aid]);
    }

    console.log('✅ Event created: Karate Championship 2026');
    console.log(`✅ All ${athleteIds.length} athletes registered to event`);

    console.log('\n🎉 Database seeded successfully!');
    console.log('\n📋 Login credentials:');
    console.log('   Admin:     admin / admin123');
    console.log('   Spectator: spectator / spectator');

    // Close pool to allow script to exit
    await pool.end();
}

seed().catch(async (e) => {
    console.error(e);
    await pool.end();
    process.exit(1);
});
