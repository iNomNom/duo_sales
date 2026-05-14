const router = require('express').Router();
const db = require('../models/db');
const auth = require('../middleware/auth');
const path = require('path');
const fs = require('fs');

// Download database backup (admin only)
router.get('/download', auth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const dbPath = process.env.DB_PATH || path.join(__dirname, '../duo_sales.db');
  if (!fs.existsSync(dbPath)) return res.status(404).json({ error: 'Database file not found' });
  res.download(dbPath, `duo_sales_backup_${new Date().toISOString().split('T')[0]}.db`);
});

// Sync to Google Sheets (admin only)
router.post('/sync-sheets', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  try {
    const googleSheets = require('../services/googleSheets');
    const sales = db.prepare('SELECT * FROM sales ORDER BY created_at DESC').all();
    const result = await googleSheets.bulkSync(sales);
    if (result.success) {
      res.json({ message: `Synced ${result.count} sales to Google Sheets` });
    } else {
      res.status(500).json({ error: result.error || 'Sync failed' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message || 'Sync failed' });
  }
});

module.exports = router;
