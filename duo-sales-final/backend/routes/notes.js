const router = require('express').Router();
const { db } = require('../models/db');
const auth = require('../middleware/auth');

// ── Constants ────────────────────────────────────────────────────────────────
const NOTE_COLORS = [
  'default', 'red', 'orange', 'yellow', 'green',
  'teal', 'blue', 'purple', 'pink', 'gray'
];
const TITLE_MAX = 1000;
const BODY_MAX = 100000;
// How long a note stays in trash before automatic permanent deletion.
// Configurable via TRASH_RETENTION_DAYS (default 30).
const TRASH_RETENTION_DAYS = Math.max(1, parseInt(process.env.TRASH_RETENTION_DAYS, 10) || 30);

// ── Helpers ──────────────────────────────────────────────────────────────────
const nowIso = () => new Date().toISOString();

function purgeExpiredTrash() {
  const cutoff = new Date(Date.now() - TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  db.prepare('DELETE FROM notes WHERE is_trashed = 1 AND trashed_at IS NOT NULL AND trashed_at < ?').run(cutoff);
}

function getOwnedNote(id, userId) {
  return db.prepare('SELECT * FROM notes WHERE id = ? AND user_id = ?').get(id, userId);
}

function serialize(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title || '',
    body: row.body || '',
    color: row.color || 'default',
    isPinned: !!row.is_pinned,
    isArchived: !!row.is_archived,
    isTrashed: !!row.is_trashed,
    sortOrder: row.sort_order != null ? row.sort_order : 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

// Fields the client may write via PUT, and how they are coerced.
function pickUpdates(body) {
  const updates = {};

  if (body.title !== undefined) {
    if (typeof body.title !== 'string' || body.title.length > TITLE_MAX) return { error: 'Invalid title' };
    updates.title = body.title;
  }
  if (body.body !== undefined) {
    if (typeof body.body !== 'string' || body.body.length > BODY_MAX) return { error: 'Invalid body' };
    updates.body = body.body;
  }
  if (body.color !== undefined) {
    if (!NOTE_COLORS.includes(body.color)) return { error: 'Invalid color' };
    updates.color = body.color;
  }
  if (body.isPinned !== undefined) {
    updates.is_pinned = body.isPinned ? 1 : 0;
    // Pinned notes live in the main collection; pinning restores them out of archive.
    if (updates.is_pinned) updates.is_archived = 0;
  }
  if (body.isArchived !== undefined) {
    updates.is_archived = body.isArchived ? 1 : 0;
    if (updates.is_archived) updates.is_pinned = 0;
  }
  if (body.isTrashed !== undefined) {
    updates.is_trashed = body.isTrashed ? 1 : 0;
    updates.trashed_at = body.isTrashed ? nowIso() : null;
    if (updates.is_trashed) { updates.is_pinned = 0; updates.is_archived = 0; }
  }

  return { updates };
}

// ── Routes ───────────────────────────────────────────────────────────────────

// Get every note owned by the user (collections/search are filtered client-side).
router.get('/', auth, (req, res) => {
  purgeExpiredTrash();
  const rows = db.prepare(
    'SELECT * FROM notes WHERE user_id = ? ORDER BY is_pinned DESC, sort_order ASC, updated_at DESC'
  ).all(req.user.id);
  res.json(rows.map(serialize));
});

// Create a note.
router.post('/', auth, (req, res) => {
  const { updates, error } = pickUpdates(req.body || {});
  if (error) return res.status(400).json({ error });

  const title = updates.title !== undefined ? updates.title : '';
  const bodyText = updates.body !== undefined ? updates.body : '';
  if (!title.trim() && !bodyText.trim()) {
    return res.status(400).json({ error: 'Note is empty' });
  }

  const color = updates.color || 'default';
  const isPinned = updates.is_pinned || 0;
  const isArchived = updates.is_archived || 0;
  const now = nowIso();

  // New notes appear at the top of the Others section (Keep behavior).
  const minOrder = db.prepare(
    'SELECT MIN(sort_order) AS m FROM notes WHERE user_id = ? AND is_pinned = 0'
  ).get(req.user.id).m;
  const sortOrder = (minOrder != null ? minOrder : 0) - 1;

  const info = db.prepare(`
    INSERT INTO notes (user_id, title, body, color, is_pinned, is_archived, sort_order, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(req.user.id, title, bodyText, color, isPinned, isArchived, sortOrder, now, now);

  res.status(201).json(serialize(getOwnedNote(info.lastInsertRowid, req.user.id)));
});

// Update a note (partial). Pass expectedUpdatedAt to guard against stale writes.
router.put('/:id', auth, (req, res) => {
  const note = getOwnedNote(req.params.id, req.user.id);
  if (!note) return res.status(404).json({ error: 'Note not found' });

  const { updates, error } = pickUpdates(req.body || {});
  if (error) return res.status(400).json({ error });
  if (Object.keys(updates).length === 0) return res.json(serialize(note));

  // Optimistic concurrency: reject writes based on a stale read.
  const expected = req.body.expectedUpdatedAt;
  if (expected && note.updated_at && expected !== note.updated_at) {
    return res.status(409).json({ error: 'Stale update', note: serialize(note) });
  }

  const sets = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  const values = Object.values(updates);
  db.prepare(`UPDATE notes SET ${sets}, updated_at = ? WHERE id = ? AND user_id = ?`)
    .run(...values, nowIso(), note.id, req.user.id);

  res.json(serialize(getOwnedNote(note.id, req.user.id)));
});

// Persist manual ordering after drag-and-drop.
// Body: { order: [{ id, sortOrder, isPinned }, ...] }
router.post('/reorder', auth, (req, res) => {
  const order = req.body && req.body.order;
  if (!Array.isArray(order)) return res.status(400).json({ error: 'order array required' });

  const update = db.prepare(
    'UPDATE notes SET sort_order = ?, is_pinned = COALESCE(?, is_pinned), updated_at = updated_at WHERE id = ? AND user_id = ?'
  );
  const runAll = db.transaction(entries => {
    for (const entry of entries) {
      if (!entry || !Number.isInteger(entry.id) || !Number.isInteger(entry.sortOrder)) continue;
      const pin = entry.isPinned === undefined ? null : (entry.isPinned ? 1 : 0);
      update.run(entry.sortOrder, pin, entry.id, req.user.id);
    }
  });
  runAll(order.slice(0, 5000));

  res.json({ message: 'Order saved' });
});

// Empty trash permanently.
router.delete('/trash', auth, (req, res) => {
  const info = db.prepare('DELETE FROM notes WHERE user_id = ? AND is_trashed = 1').run(req.user.id);
  res.json({ message: 'Trash emptied', deleted: info.changes });
});

// Permanently delete a note.
router.delete('/:id', auth, (req, res) => {
  const note = getOwnedNote(req.params.id, req.user.id);
  if (!note) return res.status(404).json({ error: 'Note not found' });
  db.prepare('DELETE FROM notes WHERE id = ? AND user_id = ?').run(note.id, req.user.id);
  res.json({ message: 'Note deleted' });
});

module.exports = router;
