const router = require('express').Router();
const db = require('../models/db');
const auth = require('../middleware/auth');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

// Download database backup (admin only)
router.get('/download', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
  const filename = `duo_sales_backup_${timestamp}.sql`;
  const tmpPath = path.join(__dirname, '..', filename);

  // Build pg_dump command from DATABASE_URL or individual env vars
  const databaseUrl = process.env.DATABASE_URL;
  let cmd;

  if (databaseUrl) {
    cmd = `pg_dump "${databaseUrl}" --no-owner --no-acl -f "${tmpPath}"`;
  } else {
    const pgHost = process.env.PGHOST || 'localhost';
    const pgPort = process.env.PGPORT || '5432';
    const pgUser = process.env.PGUSER || 'postgres';
    const pgDb = process.env.PGDATABASE || 'duo_sales';
    const pgPassword = process.env.PGPASSWORD || '';
    cmd = `PGPASSWORD="${pgPassword}" pg_dump -h ${pgHost} -p ${pgPort} -U ${pgUser} -d ${pgDb} --no-owner --no-acl -f "${tmpPath}"`;
  }

  exec(cmd, (err, stdout, stderr) => {
    if (err) {
      console.error('pg_dump failed:', err.message);
      if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
      return res.status(500).json({ error: 'Backup failed: ' + err.message });
    }

    res.download(tmpPath, filename, (downloadErr) => {
      // Clean up temp file after download
      if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
      if (downloadErr) console.error('Download error:', downloadErr.message);
    });
  });
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