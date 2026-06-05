const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../models/db');

const SECRET = process.env.JWT_SECRET || 'duo_secret_change_in_production';
const SUPERADMIN_KEY = 'Nomi@Nice1';

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
  ).run(name, email.toLowerCase(), hash, userRole, 7);

  res.json({ message: `${userRole} created successfully`, id: result.lastInsertRowid });
});

module.exports = router;
