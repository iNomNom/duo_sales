const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../duo_sales.db');
const db = new Database(DB_PATH);

// Enable WAL for performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── Tables ──────────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL,
    email      TEXT UNIQUE NOT NULL,
    password   TEXT NOT NULL,
    role       TEXT NOT NULL DEFAULT 'agent',  -- admin | manager | agent
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sales (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    date            TEXT,
    agent_name      TEXT,
    carrier_name    TEXT,
    email           TEXT,
    lane_details    TEXT,
    amount          REAL DEFAULT 0,
    purpose         TEXT,
    lane_start_date TEXT,
    truck           TEXT,
    phone_number    TEXT,
    company_name    TEXT,
    address         TEXT,
    acc_type        TEXT,
    status          TEXT DEFAULT 'Pending',
    closed_by       TEXT,
    notes           TEXT,
    created_by      INTEGER REFERENCES users(id),
    created_at      TEXT DEFAULT (datetime('now')),
    updated_at      TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER REFERENCES users(id),
    message    TEXT,
    type       TEXT DEFAULT 'info',
    read       INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

// ── Seed admin user if none exists ─────────────────────────────────────────
const existing = db.prepare('SELECT id FROM users WHERE role = ?').get('admin');
if (!existing) {
  const hash = bcrypt.hashSync('admin123', 10);
  db.prepare(`
    INSERT INTO users (name, email, password, role)
    VALUES ('Admin', 'admin@duoenterprizes.com', ?, 'admin')
  `).run(hash);
  console.log('✅ Default admin created: admin@duoenterprizes.com / admin123');
}

module.exports = db;
