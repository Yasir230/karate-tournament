# 🥋 Karate Tournament Management System (KarateTMS)

A full-stack web platform for managing karate tournaments — from athlete registration to medal distribution.

## Features

- **Athlete Registration** — CRUD, CSV/Excel import, auto age/weight classification, QR code generation
- **QR Verification** — Camera-based scanner for field weigh-in verification
- **Tournament Bracket** — Auto-generated single elimination bracket with BYE handling
- **Real-Time Scoring** — Large touch-friendly buttons, live timer, WebSocket updates
- **Public Scoreboard** — Read-only live display for spectators
- **Certificates** — Auto-generated Gold/Silver/Bronze PDF certificates with redemption tracking
- **Role-Based Access** — Admin, Athlete, Spectator roles with JWT auth
- **Mobile Responsive** — Tablet-optimized with dark mode

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Tailwind CSS, Vite |
| Backend | Node.js, Express, TypeScript |
| Database | SQLite (better-sqlite3) |
| Real-time | Socket.io |
| QR | qrcode (gen) + html5-qrcode (scan) |
| PDF | PDFKit |
| Auth | JWT + bcrypt |

## Quick Start

### Prerequisites
- Node.js 18+
- npm

### 1. Install Dependencies

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 2. Seed the Database

```bash
cd backend
npm run seed
```

This creates:
- Admin user: `admin` / `admin123`
- Spectator user: `spectator` / `spectator`
- 32 sample athletes (16 male, 16 female)
- 1 sample event with all athletes registered

### 3. Start Development Servers

```bash
# Terminal 1 — Backend (port 3001)
cd backend
npm run dev

# Terminal 2 — Frontend (port 5173)
cd frontend
npm run dev
```

Open **http://localhost:5173** in your browser.

## Tournament Workflow

1. **Login** as admin
2. **Create Event** from Events page
3. **Register Athletes** (manually or via CSV import)
4. **Verify Athletes** — scan QR codes on Scanner page
5. **Generate Bracket** — auto-randomized single elimination
6. **Run Matches** — input scores via Scoring page
7. **Declare Winners** — auto-advance in bracket
8. **Generate Certificates** — PDF for Gold, Silver, Bronze

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/auth/login | Login |
| GET/POST | /api/athletes | List / Create athletes |
| POST | /api/athletes/import | CSV/Excel import |
| GET | /api/athletes/:id/qr | Get QR code |
| POST | /api/athletes/:id/verify | Verify athlete |
| GET/POST | /api/events | List / Create events |
| POST | /api/events/:id/athletes | Register athletes to event |
| POST | /api/events/:id/matches/generate-bracket | Generate bracket |
| GET | /api/events/:id/matches | Get matches |
| POST | /api/matches/:id/scores | Update score |
| POST | /api/matches/:id/winner | Select winner |
| GET/POST | /api/certificates | List / Generate certs |
| GET | /api/certificates/:id/pdf | Download PDF |

## Scoring Rules

| Action | Points |
|--------|--------|
| Head Kick | +3 |
| Body Kick | +2 |
| Punch | +1 |
| Red Card | -1 |
| Blue Card | Warning |

Win conditions: Higher score, 8-point gap, disqualification, or referee decision.

## Project Structure

```
karate-tournament/
├── backend/
│   ├── src/
│   │   ├── index.ts           # Server entry
│   │   ├── db/                # Database schema & seed
│   │   ├── middleware/        # JWT auth
│   │   ├── routes/            # API routes
│   │   ├── services/          # Bracket generation
│   │   └── socket/            # WebSocket handlers
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── App.tsx            # Router
│   │   ├── pages/             # All page components
│   │   ├── components/        # Layout & shared
│   │   ├── context/           # Auth context
│   │   └── lib/               # API & Socket clients
│   └── package.json
├── docker-compose.yml
└── README.md
```

## License

MIT
