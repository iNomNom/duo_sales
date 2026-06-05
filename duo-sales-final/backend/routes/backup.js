const router = require('express').Router();
const { db } = require('../models/db');
const auth = require('../middleware/auth');
const path = require('path');
const fs = require('fs');

// Download database backup (admin only)
router.get('/download', auth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });

  const timestamp = new Date().toISOString().split('T')[0];
  const filename = `duo_sales_backup_${timestamp}.db`;
  const tmpPath = path.join(__dirname, '..', filename);

  try {
    // Use SQLite's VACUUM INTO to create a clean, consistent snapshot
    // This packs all data (including WAL) into a single .db file
    db.exec(`VACUUM INTO '${tmpPath}'`);

    res.download(tmpPath, filename, (err) => {
      // Clean up temp file after download
      if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
      if (err) console.error('Download error:', err.message);
    });
  } catch (err) {
    if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
    console.error('Backup failed:', err.message);
    res.status(500).json({ error: 'Backup failed: ' + err.message });
  }
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