const router = require('express').Router();
const { db, getSalesPeriod, getAgentSalesCycles } = require('../models/db');
const auth = require('../middleware/auth');
const nodemailer = require('nodemailer');
const googleSheets = require('../services/googleSheets');

// ── Helper: Determine which cycle period a sale date falls into ───────────
function getCyclePeriodForDate(cycleStartDay, saleDate) {
  const d = new Date(saleDate + 'T00:00:00');
  const day = d.getDate();
  const month = d.getMonth();
  const year = d.getFullYear();

  if (day >= cycleStartDay) {
    const periodStart = new Date(year, month, cycleStartDay);
    const periodEnd = new Date(year, month + 1, cycleStartDay - 1);
    const fmt = dt => dt.toISOString().split('T')[0];
    return { periodStart: fmt(periodStart), periodEnd: fmt(periodEnd) };
  } else {
    const periodStart = new Date(year, month - 1, cycleStartDay);
    const periodEnd = new Date(year, month, cycleStartDay - 1);
    const fmt = dt => dt.toISOString().split('T')[0];
    return { periodStart: fmt(periodStart), periodEnd: fmt(periodEnd) };
  }
}

// ── Email helper ─────────────────────────────────────────────────────────────
function sendBackupEmail(sale) {
  const emailTo = process.env.BACKUP_EMAIL;
  const gmailUser = process.env.GMAIL_USER;
  const gmailPass = process.env.GMAIL_APP_PASSWORD;
  if (!emailTo || !gmailUser || !gmailPass) return;

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: gmailUser, pass: gmailPass }
  });

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
      <div style="background:#1a1a2e;padding:20px;border-radius:8px 8px 0 0;">
        <h2 style="color:#fff;margin:0;">🚛 New Sale — Duo Enterprizes LLC</h2>
      </div>
      <div style="background:#f9f9f9;padding:24px;border-radius:0 0 8px 8px;border:1px solid #e0e0e0;">
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          ${[
            ['Date', sale.date],
            ['Agent', sale.agent_name],
            ['Carrier Name', sale.carrier_name],
            ['Email', sale.email],
            ['Lane Details', sale.lane_details],
            ['Amount', sale.amount ? '$' + Number(sale.amount).toLocaleString() : '-'],
            ['Purpose', sale.purpose],
            ['Lane Start Date', sale.lane_start_date],
            ['Truck', sale.truck],
            ['Phone Number', sale.phone_number],
            ['Company Name', sale.company_name],
            ['Address', sale.address],
            ['Account Type', sale.acc_type],
            ['Status', sale.status],
            ['Closed By', sale.closed_by],
          ].map(([k, v]) => `
            <tr style="border-bottom:1px solid #e8e8e8;">
              <td style="padding:8px 12px;font-weight:bold;color:#555;width:40%;background:#fff;">${k}</td>
              <td style="padding:8px 12px;color:#222;background:#fff;">${v || '—'}</td>
            </tr>
          `).join('')}
        </table>
        <p style="margin-top:16px;font-size:12px;color:#999;">This is an automatic backup from your Duo Enterprizes Sales Platform.</p>
      </div>
    </div>
  `;

  transporter.sendMail({
    from: `"Duo Sales Platform" <${gmailUser}>`,
    to: emailTo,
    subject: `New Sale: ${sale.carrier_name || sale.company_name} — $${Number(sale.amount || 0).toLocaleString()}`,
    html
  }).catch(err => console.error('Email backup failed:', err.message));
}

// ── Create notification for agent when status changes ───────────────────────
function notifyAgentStatusChange(sale, newStatus, changedBy) {
  // Find the agent user by name
  const agent = db.prepare('SELECT id FROM users WHERE name = ? AND role = ?').get(sale.agent_name, 'agent');
  if (!agent) return;
  db.prepare('INSERT INTO notifications (user_id, message, type) VALUES (?, ?, ?)').run(
    agent.id,
    `Sale #${sale.id} (${sale.carrier_name || sale.company_name}) status changed to ${newStatus} by ${changedBy}`,
    'status_change'
  );
}

// ── GET all sales ─────────────────────────────────────────────────────────────
router.get('/', auth, (req, res) => {
  let query = 'SELECT * FROM sales';
  const params = [];
  const conditions = [];

  // Agents only see their own
  if (req.user.role === 'agent') {
    conditions.push('agent_name = ?');
    params.push(req.user.name);
  }

  if (req.query.status) { conditions.push('status = ?'); params.push(req.query.status); }
  if (req.query.agent)  { conditions.push('agent_name = ?'); params.push(req.query.agent); }
  if (req.query.company){ conditions.push('company_name LIKE ?'); params.push('%' + req.query.company + '%'); }
  if (req.query.from)   { conditions.push('date >= ?'); params.push(req.query.from); }
  if (req.query.to)     { conditions.push('date <= ?'); params.push(req.query.to); }
  if (req.query.search) {
    conditions.push('(carrier_name LIKE ? OR company_name LIKE ? OR agent_name LIKE ? OR lane_details LIKE ?)');
    const s = '%' + req.query.search + '%';
    params.push(s, s, s, s);
  }

  if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
  query += ' ORDER BY date DESC, created_at DESC';

  // Pagination
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  const offset = (page - 1) * limit;

  const total = db.prepare(`SELECT COUNT(*) as cnt FROM sales${conditions.length ? ' WHERE ' + conditions.join(' AND ') : ''}`).get(...params).cnt;
  const rows  = db.prepare(query + ` LIMIT ? OFFSET ?`).all(...params, limit, offset);

  // Add cycle period info to each sale for grouping
  const agentCycles = getAgentSalesCycles();
  const cycleMap = {};
  agentCycles.forEach(ac => { cycleMap[ac.name] = ac.sales_cycle_start || 1; });

  const salesWithCycle = rows.map(s => {
    const cycleStart = cycleMap[s.agent_name] || 1;
    const cyclePeriod = getCyclePeriodForDate(cycleStart, s.date);
    const cycleFormat = cycleStart === 1 ? '1-End' : `${cycleStart}-${cycleStart - 1}`;
    return {
      ...s,
      cycle_period_start: cyclePeriod.periodStart,
      cycle_period_end: cyclePeriod.periodEnd,
      cycle_start_day: cycleStart,
      cycle_format: cycleFormat
    };
  });

  res.json({ sales: salesWithCycle, total, page, pages: Math.ceil(total / limit) });
});

// ── GET single sale ───────────────────────────────────────────────────────────
router.get('/:id', auth, (req, res) => {
  const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(req.params.id);
  if (!sale) return res.status(404).json({ error: 'Not found' });
  // Agent can only see their own
  if (req.user.role === 'agent' && sale.agent_name !== req.user.name) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  res.json(sale);
});

// ── POST create sale ──────────────────────────────────────────────────────────
router.post('/', auth, (req, res) => {
  const {
    date, agent_name, carrier_name, email, lane_details, amount,
    purpose, lane_start_date, truck, phone_number, company_name,
    address, acc_type, status, closed_by, notes
  } = req.body;

  // Ensure only admins can set an initial status; agents' created sales are always 'Pending'
  const finalStatus = req.user.role === 'admin' ? (status || 'Pending') : 'Pending';

  const result = db.prepare(`
    INSERT INTO sales (
      date, agent_name, carrier_name, email, lane_details, amount,
      purpose, lane_start_date, truck, phone_number, company_name,
      address, acc_type, status, closed_by, notes, created_by
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    date, agent_name || req.user.name, carrier_name, email, lane_details,
    parseFloat(amount) || 0, purpose, lane_start_date, truck, phone_number,
    company_name, address, acc_type, finalStatus, closed_by, notes,
    req.user.id
  );

  const newSale = db.prepare('SELECT * FROM sales WHERE id = ?').get(result.lastInsertRowid);

  // Email backup
  sendBackupEmail(newSale);

  // Sync to Google Sheets immediately
  googleSheets.appendRow(newSale).catch(err =>
    console.error('Google Sheets sync failed on sale create:', err.message)
  );

  res.status(201).json(newSale);
});

// ── PATCH quick status update (admin/manager only) ────────────────────────────
router.patch('/:id/status', auth, (req, res) => {
  if (req.user.role === 'agent') return res.status(403).json({ error: 'Agents cannot change status' });
  const { status } = req.body;
  const validStatuses = ['Active', 'Pending', 'Cancelled', 'Chargeback'];
  if (!validStatuses.includes(status)) return res.status(400).json({ error: 'Invalid status' });

  const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(req.params.id);
  if (!sale) return res.status(404).json({ error: 'Not found' });

  db.prepare('UPDATE sales SET status = ?, updated_at = datetime(\'now\') WHERE id = ?').run(status, req.params.id);

  // Notify the agent about the status change
  notifyAgentStatusChange(sale, status, req.user.name);

  const updated = db.prepare('SELECT * FROM sales WHERE id = ?').get(req.params.id);

  // Sync to Google Sheets immediately
  googleSheets.updateRow(updated).catch(err =>
    console.error('Google Sheets sync failed on status change:', err.message)
  );

  res.json(updated);
});

// ── PUT update sale ───────────────────────────────────────────────────────────
router.put('/:id', auth, (req, res) => {
  if (req.user.role === 'agent') return res.status(403).json({ error: 'Agents cannot edit sales' });

  const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(req.params.id);
  if (!sale) return res.status(404).json({ error: 'Not found' });

  const {
    date, agent_name, carrier_name, email, lane_details, amount,
    purpose, lane_start_date, truck, phone_number, company_name,
    address, acc_type, status, closed_by, notes
  } = req.body;

  db.prepare(`
    UPDATE sales SET
      date=?, agent_name=?, carrier_name=?, email=?, lane_details=?,
      amount=?, purpose=?, lane_start_date=?, truck=?, phone_number=?,
      company_name=?, address=?, acc_type=?, status=?, closed_by=?, notes=?,
      updated_at=datetime('now')
    WHERE id=?
  `).run(
    date, agent_name, carrier_name, email, lane_details,
    parseFloat(amount) || 0, purpose, lane_start_date, truck, phone_number,
    company_name, address, acc_type, status, closed_by, notes,
    req.params.id
  );

  // If status changed, notify the agent
  if (status && status !== sale.status) {
    notifyAgentStatusChange(sale, status, req.user.name);
  }

  const updated = db.prepare('SELECT * FROM sales WHERE id = ?').get(req.params.id);

  // Sync to Google Sheets immediately
  googleSheets.updateRow(updated).catch(err =>
    console.error('Google Sheets sync failed on sale update:', err.message)
  );

  res.json(updated);
});

// ── DELETE sale (admin only) ──────────────────────────────────────────────────
router.delete('/:id', auth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  db.prepare('DELETE FROM sales WHERE id = ?').run(req.params.id);
  res.json({ message: 'Deleted' });
});

module.exports = router;
