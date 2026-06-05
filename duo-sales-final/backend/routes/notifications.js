const router = require('express').Router();
const { db } = require('../models/db');
const auth = require('../middleware/auth');

// Get notifications for current user
router.get('/', auth, (req, res) => {
  const notifs = db.prepare(
    'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50'
  ).all(req.user.id);
  res.json(notifs);
});

// Mark a single notification as read
router.put('/:id/read', auth, (req, res) => {
  db.prepare('UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ message: 'Marked as read' });
});

// Mark all notifications as read
router.put('/read-all', auth, (req, res) => {
  db.prepare('UPDATE notifications SET read = 1 WHERE user_id = ? AND read = 0').run(req.user.id);
  res.json({ message: 'All marked as read' });
});

module.exports = router;
