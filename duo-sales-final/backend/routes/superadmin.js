const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../models/db');

const SECRET = process.env.JWT_SECRET || 'duo_secret_change_in_production';
const SUPERADMIN_KEY = 'Nomi@Nice1';
const MAX_EXPORT_ROWS = 2000;
const MAX_SQL_ROWS = 1000;

// ── Superadmin Auth Middleware ──────────────────────────────────────────────
function superadminAuth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No superadmin token' });
  try {
    const decoded = jwt.verify(token, SECRET);
    if (decoded.type !== 'superadmin') return res.status(403).json({ error: 'Invalid superadmin token' });
    next();
  } catch {
    res.status(401).json({ error: 'Superadmin token expired or invalid' });
  }
}

// ── Verify Secret Key ──────────────────────────────────────────────────────
router.post('/verify', (req, res) => {
  const { secretKey } = req.body;
  if (!secretKey) return res.status(400).json({ error: 'Secret key required' });

  if (secretKey !== SUPERADMIN_KEY) {
    return res.status(401).json({ error: 'Invalid secret key' });
  }

  // Issue a short-lived superadmin token (2 hours)
  const token = jwt.sign(
    { type: 'superadmin', iat: Math.floor(Date.now() / 1000) },
    SECRET,
    { expiresIn: '2h' }
  );

  res.json({ token, message: 'Superadmin access granted' });
});

// ── List All Admin Users ──────────────────────────────────────────────────
router.get('/admins', superadminAuth, (req, res) => {
  const admins = db.prepare(
    "SELECT id, name, email, role, sales_cycle_start, created_at FROM users WHERE role IN ('admin', 'manager') ORDER BY role, name"
  ).all();
  res.json(admins);
});

// ── List All Users ────────────────────────────────────────────────────────
router.get('/users', superadminAuth, (req, res) => {
  const users = db.prepare(
    'SELECT id, name, email, role, sales_cycle_start, created_at FROM users ORDER BY role, name'
  ).all();
  res.json(users);
});

// ── Change Admin/User Password ───────────────────────────────────────────
router.put('/users/:id/password', superadminAuth, (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  const targetUser = db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(req.params.id);
  if (!targetUser) return res.status(404).json({ error: 'User not found' });

  const hash = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hash, req.params.id);
  res.json({ message: `Password updated for ${targetUser.name} (${targetUser.email})` });
});

// ── Delete User ──────────────────────────────────────────────────────────
router.delete('/users/:id', superadminAuth, (req, res) => {
  const targetUser = db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(req.params.id);
  if (!targetUser) return res.status(404).json({ error: 'User not found' });

  // Prevent deleting all admins
  if (targetUser.role === 'admin') {
    const adminCount = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin'").get();
    if (adminCount.count <= 1) {
      return res.status(400).json({ error: 'Cannot delete the last admin account' });
    }
  }

  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ message: `User ${targetUser.name} deleted` });
});

// ── Create New Admin ─────────────────────────────────────────────────────
router.post('/admins', superadminAuth, (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'Name, email, and password required' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
  if (exists) return res.status(400).json({ error: 'Email already registered' });

  const hash = bcrypt.hashSync(password, 10);
  const userRole = role || 'admin';
  if (!['admin', 'manager'].includes(userRole)) {
    return res.status(400).json({ error: 'Role must be admin or manager' });
  }

  const result = db.prepare(
    'INSERT INTO users (name, email, password, role, sales_cycle_start) VALUES (?, ?, ?, ?, ?)'
  ).run(name, email.toLowerCase(), hash, userRole, 1);

  res.json({ message: `${userRole} created successfully`, id: result.lastInsertRowid });
});

// ── List available tables for the SQL browser ─────────────────────────────
router.get('/sql/tables', superadminAuth, (req, res) => {
  const tables = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
  ).all().map(row => row.name);
  res.json({ tables });
});

// ── Fetch rows for a specific table with pagination ───────────────────────
router.get('/sql/table/:table', superadminAuth, (req, res) => {
  const { table } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const offset = (page - 1) * limit;
  const filters = req.query.filters ? JSON.parse(req.query.filters) : [];
  const sortBy = req.query.sortBy || null;
  const sortDir = (req.query.sortDir || 'ASC').toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

  const tbl = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?").get(table);
  if (!tbl) return res.status(400).json({ error: 'Table not found' });

  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  const columnNames = columns.map(c => c.name);

  // Build WHERE clause from filters: [{ column, op, value }]
  let whereClause = '';
  const params = [];
  if (Array.isArray(filters) && filters.length > 0) {
    const parts = [];
    filters.forEach(f => {
      if (!f.column || typeof f.op === 'undefined') return;
      // simple ops: =, !=, LIKE, IS, IS NOT, >, <, >=, <=
      const op = String(f.op).toUpperCase();
      if (op === 'LIKE') {
        parts.push(`${f.column} LIKE ?`);
        params.push(String(f.value));
      } else if (op === 'IS' || op === 'IS NOT') {
        parts.push(`${f.column} ${op} ?`);
        params.push(f.value === null ? null : String(f.value));
      } else {
        parts.push(`${f.column} ${op} ?`);
        params.push(String(f.value));
      }
    });
    if (parts.length) {
      const logic = String(req.query.logic || 'AND').toUpperCase() === 'OR' ? ' OR ' : ' AND ';
      whereClause = 'WHERE ' + parts.join(logic);
    }
  }

  const totalRow = db.prepare(`SELECT COUNT(*) as count FROM ${table} ${whereClause}`).get(...params);
  const total = totalRow.count;

  let orderClause = '';
  if (sortBy && columnNames.includes(sortBy)) {
    orderClause = `ORDER BY ${sortBy} ${sortDir}`;
  }

  const rows = db.prepare(`SELECT * FROM ${table} ${whereClause} ${orderClause} LIMIT ? OFFSET ?`).all(...params, limit, offset);

  res.json({ table, columns: columns, rows, total, page, limit });
});

// ── Bulk update: apply same changes to many rows ─────────────────────────
router.post('/sql/table/:table/bulk-update', superadminAuth, (req, res) => {
  const { table } = req.params;
  const { ids, changes } = req.body; // ids: [1,2], changes: { colName: value }
  if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ids array required' });
  if (!changes || typeof changes !== 'object' || Object.keys(changes).length === 0) return res.status(400).json({ error: 'changes object required' });
  const tbl = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?").get(table);
  if (!tbl) return res.status(400).json({ error: 'Table not found' });

  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  const colNames = cols.map(c => c.name);
  if (!colNames.includes('id')) return res.status(400).json({ error: "Table must have an 'id' primary key" });

  // validate change columns
  const toUpdate = Object.entries(changes).filter(([col]) => colNames.includes(col) && col !== 'id');
  if (toUpdate.length === 0) return res.status(400).json({ error: 'No valid columns to update' });

  const transaction = db.transaction((idsList) => {
    idsList.forEach(id => {
      const parts = toUpdate.map(([col]) => `${col} = ?`).join(', ');
      const stmt = db.prepare(`UPDATE ${table} SET ${parts} WHERE id = ?`);
      const values = toUpdate.map(([, val]) => val).concat([id]);
      stmt.run(...values);
    });
  });

  try {
    transaction(ids);
    res.json({ message: 'Bulk update applied', rows: ids.length });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── Save inline edits for a specific table ────────────────────────────────
router.post('/sql/table/:table/save', superadminAuth, (req, res) => {
  const { table } = req.params;
  const { changes } = req.body;
  if (!changes || !Array.isArray(changes) || changes.length === 0) {
    return res.status(400).json({ error: 'No changes provided' });
  }

  const tbl = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?").get(table);
  if (!tbl) return res.status(400).json({ error: 'Table not found' });

  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  const colNames = cols.map(c => c.name);
  if (!colNames.includes('id')) return res.status(400).json({ error: "Table must have an 'id' primary key" });

  const settings = { changes };
  const updateStmt = db.prepare(`UPDATE ${table} SET %COLUMN% = ? WHERE id = ?`);
  const transaction = db.transaction((items) => {
    items.forEach(item => {
      if (!item || typeof item.id === 'undefined' || !item.column || !colNames.includes(item.column)) {
        throw new Error('Invalid change payload');
      }
      if (item.column === 'id') {
        throw new Error('Cannot update id column');
      }
      const stmt = db.prepare(`UPDATE ${table} SET ${item.column} = ? WHERE id = ?`);
      stmt.run(item.value, item.id);
    });
  });

  try {
    transaction(changes);
    res.json({ message: 'Changes saved', changes: changes.length });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── Get table schema and foreign keys ───────────────────────────────────
router.get('/sql/table/:table/schema', superadminAuth, (req, res) => {
  const { table } = req.params;
  const tbl = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?").get(table);
  if (!tbl) return res.status(400).json({ error: 'Table not found' });

  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  const fks = db.prepare(`PRAGMA foreign_key_list(${table})`).all();
  res.json({ columns, foreignKeys: fks });
});

// ── Delete rows by id list ─────────────────────────────────────────────
router.post('/sql/table/:table/delete', superadminAuth, (req, res) => {
  const { table } = req.params;
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ids array required' });
  const tbl = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?").get(table);
  if (!tbl) return res.status(400).json({ error: 'Table not found' });

  const placeholders = ids.map(() => '?').join(',');
  const stmt = db.prepare(`DELETE FROM ${table} WHERE id IN (${placeholders})`);
  const info = stmt.run(...ids);
  res.json({ changes: info.changes });
});

// ── Add column to table ───────────────────────────────────────────────
router.post('/sql/table/:table/add-column', superadminAuth, (req, res) => {
  const { table } = req.params;
  const { column, type, nullable, name } = req.body;
  const colName = column || name;
  const colType = type;
  if (!colName || !colType) return res.status(400).json({ error: 'column/name and type required' });
  const tbl = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?").get(table);
  if (!tbl) return res.status(400).json({ error: 'Table not found' });

  // basic name/type validation to avoid SQL injection via identifiers
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(colName)) return res.status(400).json({ error: 'Invalid column name' });
  if (!/^[A-Za-z0-9_()\s]+$/.test(colType)) return res.status(400).json({ error: 'Invalid column type' });

  // ensure column doesn't already exist
  const existing = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
  if (existing.includes(colName)) return res.status(400).json({ error: 'Column already exists' });

  try {
    const nullStr = nullable === false || nullable === 'false' ? ' NOT NULL' : '';
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${colName} ${colType}${nullStr}`).run();
    res.json({ message: 'Column added' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── Add row to table ──────────────────────────────────────────────────
router.post('/sql/table/:table/add-row', superadminAuth, (req, res) => {
  const { table } = req.params;
  const { values } = req.body; // { col: value }
  if (!values || typeof values !== 'object') return res.status(400).json({ error: 'values object required' });
  const tbl = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?").get(table);
  if (!tbl) return res.status(400).json({ error: 'Table not found' });

  const cols = Object.keys(values);
  if (cols.length === 0) return res.status(400).json({ error: 'Empty values' });

  const placeholders = cols.map(() => '?').join(',');
  const stmt = db.prepare(`INSERT INTO ${table} (${cols.join(',')}) VALUES (${placeholders})`);
  try {
    const info = stmt.run(...cols.map(c => values[c]));
    res.json({ lastInsertRowid: info.lastInsertRowid });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── Export CSV (all or selected ids) ──────────────────────────────────
router.get('/sql/table/:table/export', superadminAuth, (req, res) => {
  const { table } = req.params;
  const ids = req.query.ids ? (Array.isArray(req.query.ids) ? req.query.ids : [req.query.ids]) : null;
  const tbl = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?").get(table);
  if (!tbl) return res.status(400).json({ error: 'Table not found' });

  let rows;
  if (ids && ids.length) {
    const placeholders = ids.map(() => '?').join(',');
    rows = db.prepare(`SELECT * FROM ${table} WHERE id IN (${placeholders})`).all(...ids);
  } else {
    const totalRows = db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get().count;
    if (totalRows > MAX_EXPORT_ROWS) return res.status(400).json({ error: `Export exceeds limit (${MAX_EXPORT_ROWS}). Please apply filters or export selected rows.` });
    rows = db.prepare(`SELECT * FROM ${table}`).all();
  }

  // Convert to CSV
  if (!rows || rows.length === 0) {
    res.setHeader('Content-Type', 'text/csv');
    return res.send('');
  }
  const cols = Object.keys(rows[0]);
  const escape = v => (v === null || typeof v === 'undefined') ? '' : String(v).replace(/"/g, '""');
  const csv = [cols.join(',')].concat(rows.map(r => cols.map(c => `"${escape(r[c])}"`).join(','))).join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${table}.csv"`);
  res.send(csv);
});

// ── Execute arbitrary SELECT queries (superadmin only) ─────────────────────
router.post('/sql/execute', superadminAuth, (req, res) => {
  const { sql, params } = req.body;
  if (!sql) return res.status(400).json({ error: 'SQL is required' });

  const cleaned = sql.trim();
  const up = cleaned.toUpperCase();

  // Allow only SELECT statements here for safety in the ad-hoc runner.
  if (!up.startsWith('SELECT')) {
    return res.status(400).json({ error: 'Only SELECT queries allowed via this endpoint' });
  }

  try {
    const stmt = db.prepare(sql);
    const rows = params ? stmt.all(params) : stmt.all();
    res.json({ rows });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── Update a single cell in a table (validated) ───────────────────────────
router.post('/sql/update-cell', superadminAuth, (req, res) => {
  const { table, id, column, value } = req.body;
  if (!table || typeof id === 'undefined' || !column) return res.status(400).json({ error: 'table, id and column required' });

  // Validate table exists
  const tbl = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?").get(table);
  if (!tbl) return res.status(400).json({ error: 'Table not found' });

  // Validate column exists
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  const colNames = cols.map(c => c.name);
  if (!colNames.includes(column)) return res.status(400).json({ error: 'Column not found on table' });

  // Only allow updating a row by primary key column named 'id'
  if (!colNames.includes('id')) return res.status(400).json({ error: "Table must have an 'id' primary key to use cell update" });

  try {
    const stmt = db.prepare(`UPDATE ${table} SET ${column} = ? WHERE id = ?`);
    const info = stmt.run(value, id);
    res.json({ changes: info.changes });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
