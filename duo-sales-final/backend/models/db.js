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
    sales_cycle_start INTEGER DEFAULT 1,       -- Day of month when sales cycle starts (1-28)
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
  db.exec('ALTER TABLE users ADD COLUMN sales_cycle_start INTEGER DEFAULT 1');
  console.log('Added sales_cycle_start column to users table');
} else if (!hasSalesCycle && hasOldBillingCycle) {
  // Rename old billing_cycle_start column by copying data
  db.exec('ALTER TABLE users ADD COLUMN sales_cycle_start INTEGER DEFAULT 1');
  db.prepare('UPDATE users SET sales_cycle_start = billing_cycle_start').run();
  console.log('Migrated billing_cycle_start → sales_cycle_start');
}

// ── Migrate existing agents ────────────────────────────────────────────────
// Align any agent still using the previous defaults to the new month-end cycle.
db.prepare("UPDATE users SET sales_cycle_start = 1 WHERE role = 'agent' AND (sales_cycle_start IS NULL OR sales_cycle_start = 8 OR sales_cycle_start = 7)").run();
console.log('Aligned agent sales cycles to the month-end cycle');

// ── Revert a small set of agents back to the legacy 8-7 cycle ─────────────
// The product change should keep the DEFAULT at 1, but a few existing users
// intentionally need to stay on the old 8-7 cycle. Match by email or fuzzy
// name patterns to be resilient to minor name variations.
const legacyAgents = [
  { email: 'junaid@duoenterprizes.com', nameLike: '%junaid%ahmed%' },
  { email: 'adnan@duoenterprizes.com', nameLike: '%adnan%' },
  { email: 'satifnus@duoenterprizes.com', nameLike: '%satifnus%riaz%' }
];

legacyAgents.forEach(a => {
  try {
    db.prepare('UPDATE users SET sales_cycle_start = 8 WHERE email = ? OR name LIKE ?').run(a.email, a.nameLike);
    console.log(`Reverted sales_cycle_start to 8 for ${a.email}`);
  } catch (err) {
    console.warn('Failed reverting legacy agent', a, err.message);
  }
});

// ── Seed admin user if none exists ─────────────────────────────────────────
const existing = db.prepare('SELECT id FROM users WHERE role = ?').get('admin');
if (!existing) {
  const hash = bcrypt.hashSync('admin123', 10);
  db.prepare(`
    INSERT INTO users (name, email, password, role, sales_cycle_start)
    VALUES ('Admin', 'admin@duoenterprizes.com', ?, 'admin', 1)
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

// ── Helper: Get the display period for an agent based on universal cursor logic ──
// CURSOR_DAY = 8: The universal day when ALL cycles reset simultaneously.
// Before the 8th: Show previous cycle for ALL agents.
//   - Agents whose cycle started this month (e.g., Ahsan cycle 1): show their
//     PREVIOUS completed cycle (their current month sales are hidden until the 8th).
//   - Agents whose cycle hasn't started yet (e.g., cycle 8): show their ongoing
//     cycle from last month's start up to today.
// On/after the 8th: Show current cycle for ALL agents.
//   - Ahsan (1-End): shows from the 1st of the month (including 1st-7th that were hidden).
//   - Others (8-7): shows from the 8th.
const CURSOR_DAY = 8;

function getDisplayPeriod(cycleStartDay, referenceDate) {
  const ref = referenceDate ? new Date(referenceDate) : new Date();
  const day = ref.getDate();
  const month = ref.getMonth();
  const year = ref.getFullYear();
  const fmt = d => d.toISOString().split('T')[0];

  if (day >= CURSOR_DAY) {
    // ── After cursor: Current cycle is active for ALL agents ────────────────
    const periodStart = new Date(year, month, cycleStartDay);
    const today = new Date(year, month, day);

    // Full cycle boundaries for matching sales records
    let fps, fpe;
    if (cycleStartDay === 1) {
      fps = new Date(year, month, 1);
      fpe = new Date(year, month + 1, 0); // last day of month
    } else {
      fps = new Date(year, month, cycleStartDay);
      fpe = new Date(year, month + 1, cycleStartDay - 1);
    }

    return {
      periodStart: fmt(periodStart),
      periodEnd: fmt(today),
      isCurrentCycleActive: true,
      cycleLabel: 'Current Cycle (in progress)',
      fullPeriodStart: fmt(fps),
      fullPeriodEnd: fmt(fpe)
    };
  } else {
    // ── Before cursor: Show previous cycle for ALL agents ───────────────────
    if (day >= cycleStartDay) {
      // Agent's cycle HAS started this month (e.g., Ahsan cycle 1 on June 5)
      // but we DELAY showing it until the 8th → show their PREVIOUS completed cycle
      if (cycleStartDay === 1) {
        // Previous calendar month
        return {
          periodStart: fmt(new Date(year, month - 1, 1)),
          periodEnd: fmt(new Date(year, month, 0)),
          isCurrentCycleActive: false,
          cycleLabel: 'Previous Cycle (completed)',
          fullPeriodStart: fmt(new Date(year, month - 1, 1)),
          fullPeriodEnd: fmt(new Date(year, month, 0))
        };
      } else {
        // Previous cycle: started (month-1) cycleStartDay, ended this month (cycleStartDay-1)
        return {
          periodStart: fmt(new Date(year, month - 1, cycleStartDay)),
          periodEnd: fmt(new Date(year, month, cycleStartDay - 1)),
          isCurrentCycleActive: false,
          cycleLabel: 'Previous Cycle (completed)',
          fullPeriodStart: fmt(new Date(year, month - 1, cycleStartDay)),
          fullPeriodEnd: fmt(new Date(year, month, cycleStartDay - 1))
        };
      }
    } else {
      // Agent's cycle hasn't started this month yet (e.g., cycle 8 on June 5)
      // Show their ongoing cycle from last month start to today
      return {
        periodStart: fmt(new Date(year, month - 1, cycleStartDay)),
        periodEnd: fmt(new Date(year, month, day)),
        isCurrentCycleActive: false,
        cycleLabel: 'Previous Cycle (in progress)',
        fullPeriodStart: fmt(new Date(year, month - 1, cycleStartDay)),
        fullPeriodEnd: fmt(new Date(year, month, cycleStartDay - 1))
      };
    }
  }
}

// ── Helper: Get all agents' sales cycles ──────────────────────────────────
function getAgentSalesCycles() {
  return db.prepare("SELECT name, sales_cycle_start FROM users WHERE role = 'agent'").all();
}

module.exports = { db, getSalesPeriod, getDisplayPeriod, getAgentSalesCycles };
