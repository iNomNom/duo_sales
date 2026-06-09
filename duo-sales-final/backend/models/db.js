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
    sales_cycle_start INTEGER DEFAULT 8,       -- Day of month when sales cycle starts (1-28)
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

// ── Migration: Add sales_cycle_start column if it doesn't exist ─────────
const userColumns = db.prepare("PRAGMA table_info(users)").all();
const hasSalesCycle = userColumns.some(col => col.name === 'sales_cycle_start');
const hasOldBillingCycle = userColumns.some(col => col.name === 'billing_cycle_start');

if (!hasSalesCycle && !hasOldBillingCycle) {
  db.exec('ALTER TABLE users ADD COLUMN sales_cycle_start INTEGER DEFAULT 8');
  console.log('Added sales_cycle_start column to users table');
} else if (!hasSalesCycle && hasOldBillingCycle) {
  // Rename old billing_cycle_start column by copying data
  db.exec('ALTER TABLE users ADD COLUMN sales_cycle_start INTEGER DEFAULT 8');
  db.prepare('UPDATE users SET sales_cycle_start = billing_cycle_start').run();
  console.log('Migrated billing_cycle_start → sales_cycle_start');
}

// ── Migrate existing agents ────────────────────────────────────────────────
// Set Ahsan Shadab to 1-1 cycle (check various name spellings)
const ahsan = db.prepare("SELECT id FROM users WHERE name LIKE '%ahsan%shadab%'").get();
if (ahsan) {
  db.prepare('UPDATE users SET sales_cycle_start = 1 WHERE id = ?').run(ahsan.id);
  console.log('Set Ahsan Shadab sales cycle to 1st of month');
}

// Set all other agents to 8 (default) if not set
db.prepare("UPDATE users SET sales_cycle_start = 8 WHERE role = 'agent' AND sales_cycle_start IS NULL").run();
// Also update any agent still on old default of 7 to new default of 8 (except Ahsan)
db.prepare("UPDATE users SET sales_cycle_start = 8 WHERE role = 'agent' AND sales_cycle_start = 7 AND name NOT LIKE '%ahsan%shadab%'").run();

// ── Seed admin user if none exists ─────────────────────────────────────────
const existing = db.prepare('SELECT id FROM users WHERE role = ?').get('admin');
if (!existing) {
  const hash = bcrypt.hashSync('admin123', 10);
  db.prepare(`
    INSERT INTO users (name, email, password, role, sales_cycle_start)
    VALUES ('Admin', 'admin@duoenterprizes.com', ?, 'admin', 8)
  `).run(hash);
  console.log('Default admin created: admin@duoenterprizes.com / admin123');
}

// ── Helper: Calculate sales period for a given cycle start day ────────────
// Returns { periodStart, periodEnd, isCurrentCycleActive } as 'YYYY-MM-DD' strings
// isCurrentCycleActive: true if today's date is on or after the cycle start day,
// meaning the current cycle has begun and revenue should be shown.
function getSalesPeriod(cycleStartDay, referenceDate) {
  const ref = referenceDate ? new Date(referenceDate) : new Date();
  const day = ref.getDate();
  const month = ref.getMonth();
  const year = ref.getFullYear();

  let periodStart, periodEnd;
  let isCurrentCycleActive = day >= cycleStartDay;

  if (day >= cycleStartDay) {
    // We're on or after the cycle start day → current period started this month
    periodStart = new Date(year, month, cycleStartDay);
    // Period ends on the day before the next cycle starts next month
    periodEnd = new Date(year, month + 1, cycleStartDay - 1);
  } else {
    // We're before the cycle start day → current period started last month
    periodStart = new Date(year, month - 1, cycleStartDay);
    periodEnd = new Date(year, month, cycleStartDay - 1);
  }

  const fmt = d => d.toISOString().split('T')[0];
  return { periodStart: fmt(periodStart), periodEnd: fmt(periodEnd), isCurrentCycleActive };
}

// ── Helper: Get the display period for an agent based on cursor logic ──────
// Cursor logic: Only show revenue when the current date has reached the agent's
// cycle start day. If the cycle hasn't started yet this month, show the
// PREVIOUS cycle's completed data. If the cycle HAS started, show the current
// cycle's partial data (from cycle start to today).
function getDisplayPeriod(cycleStartDay, referenceDate) {
  const ref = referenceDate ? new Date(referenceDate) : new Date();
  const day = ref.getDate();
  const month = ref.getMonth();
  const year = ref.getFullYear();

  if (day >= cycleStartDay) {
    // Cycle has started this month → show current cycle data from start to today
    const periodStart = new Date(year, month, cycleStartDay);
    const today = new Date(year, month, day);
    const fmt = d => d.toISOString().split('T')[0];
    return {
      periodStart: fmt(periodStart),
      periodEnd: fmt(today),
      isCurrentCycleActive: true,
      cycleLabel: 'Current Cycle (in progress)'
    };
  } else {
    // Cycle hasn't started yet this month → show previous full cycle
    const prevPeriod = getSalesPeriod(cycleStartDay, ref);
    return {
      periodStart: prevPeriod.periodStart,
      periodEnd: prevPeriod.periodEnd,
      isCurrentCycleActive: false,
      cycleLabel: 'Previous Cycle (completed)'
    };
  }
}

// ── Helper: Get all agents' sales cycles ──────────────────────────────────
function getAgentSalesCycles() {
  return db.prepare("SELECT name, sales_cycle_start FROM users WHERE role = 'agent'").all();
}

module.exports = { db, getSalesPeriod, getDisplayPeriod, getAgentSalesCycles };
