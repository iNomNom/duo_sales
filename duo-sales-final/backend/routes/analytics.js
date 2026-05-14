const router = require('express').Router();
const db = require('../models/db');
const auth = require('../middleware/auth');

router.get('/dashboard', auth, (req, res) => {
  const { from, to } = req.query;

  // Build WHERE clause with optional date range
  let where = '';
  const p = [];
  if (from) { where += (where ? ' AND ' : ' WHERE ') + 'date >= ?'; p.push(from); }
  if (to)   { where += (where ? ' AND ' : ' WHERE ') + 'date <= ?'; p.push(to); }

  // For agents, filter all queries to only their sales
  let agentWhere = where;
  const agentP = [...p];
  if (req.user.role === 'agent') {
    agentWhere += (agentWhere ? ' AND ' : ' WHERE ') + 'agent_name = ?';
    agentP.push(req.user.name);
  }

  const totals = db.prepare(`
    SELECT
      COUNT(*) as total_sales,
      COALESCE(SUM(amount),0) as total_revenue,
      SUM(CASE WHEN status='Active' THEN 1 ELSE 0 END) as active,
      SUM(CASE WHEN status='Pending' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN status='Cancelled' THEN 1 ELSE 0 END) as cancelled,
      SUM(CASE WHEN status='Chargeback' THEN 1 ELSE 0 END) as chargebacks,
      COALESCE(SUM(CASE WHEN status='Chargeback' THEN amount ELSE 0 END),0) as chargeback_amount
    FROM sales${agentWhere}
  `).get(...agentP);

  // Monthly revenue trend (last 6 months)
  let monthlyWhere = 'WHERE date >= date(\'now\',\'-6 months\')';
  const monthlyP = [];
  if (req.user.role === 'agent') {
    monthlyWhere += ' AND agent_name = ?';
    monthlyP.push(req.user.name);
  }
  const monthly = db.prepare(`
    SELECT strftime('%Y-%m', date) as month,
           COALESCE(SUM(amount),0) as revenue,
           COUNT(*) as count
    FROM sales
    ${monthlyWhere}
    GROUP BY month ORDER BY month
  `).all(...monthlyP);

  // Top agents (only for admin/manager)
  let agents = [];
  if (req.user.role !== 'agent') {
    agents = db.prepare(`
      SELECT agent_name,
             COUNT(*) as sales_count,
             COALESCE(SUM(amount),0) as revenue,
             SUM(CASE WHEN status='Active' THEN 1 ELSE 0 END) as active,
             SUM(CASE WHEN status='Cancelled' THEN 1 ELSE 0 END) as cancelled,
             SUM(CASE WHEN status='Chargeback' THEN 1 ELSE 0 END) as chargebacks
      FROM sales${where}
      GROUP BY agent_name ORDER BY revenue DESC LIMIT 10
    `).all(...p);
  }

  // Top companies
  const companies = db.prepare(`
    SELECT company_name,
           COUNT(*) as sales_count,
           COALESCE(SUM(amount),0) as revenue,
           SUM(CASE WHEN status='Active' THEN 1 ELSE 0 END) as active,
           SUM(CASE WHEN status='Cancelled' THEN 1 ELSE 0 END) as cancelled
    FROM sales${agentWhere}
    GROUP BY company_name ORDER BY revenue DESC LIMIT 10
  `).all(...agentP);

  // Status breakdown for donut chart
  const statusBreakdown = db.prepare(`
    SELECT status, COUNT(*) as count, COALESCE(SUM(amount),0) as revenue
    FROM sales${agentWhere}
    GROUP BY status
  `).all(...agentP);

  // Recent 10 sales
  let recentQuery = 'SELECT id, date, agent_name, carrier_name, company_name, amount, status, created_at FROM sales';
  const recentP = [];
  if (req.user.role === 'agent') {
    recentQuery += ' WHERE agent_name = ?';
    recentP.push(req.user.name);
  }
  recentQuery += ' ORDER BY created_at DESC LIMIT 10';
  const recent = db.prepare(recentQuery).all(...recentP);

  // Agent count (total agents in system) — only for admin/manager
  const agentCount = req.user.role !== 'agent'
    ? db.prepare('SELECT COUNT(*) as count FROM users WHERE role = ?').get('agent').count
    : 0;

  // Unique companies count
  const companyCount = db.prepare(`SELECT COUNT(DISTINCT company_name) as count FROM sales WHERE company_name IS NOT NULL AND company_name != ''${req.user.role === 'agent' ? ' AND agent_name = ?' : ''}`).get(...(req.user.role === 'agent' ? [req.user.name] : [])).count;

  res.json({ totals, monthly, agents, companies, statusBreakdown, recent, agentCount, companyCount });
});

// Per-agent detail
router.get('/agent/:name', auth, (req, res) => {
  const name = decodeURIComponent(req.params.name);
  // Agents can only see their own details
  if (req.user.role === 'agent' && req.user.name !== name) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const sales = db.prepare('SELECT * FROM sales WHERE agent_name = ? ORDER BY date DESC').all(name);
  const stats = db.prepare(`
    SELECT COUNT(*) as total, COALESCE(SUM(amount),0) as revenue,
           SUM(CASE WHEN status='Active' THEN 1 ELSE 0 END) as active,
           SUM(CASE WHEN status='Pending' THEN 1 ELSE 0 END) as pending,
           SUM(CASE WHEN status='Cancelled' THEN 1 ELSE 0 END) as cancelled,
           SUM(CASE WHEN status='Chargeback' THEN 1 ELSE 0 END) as chargebacks
    FROM sales WHERE agent_name = ?
  `).get(name);
  const monthly = db.prepare(`
    SELECT strftime('%Y-%m', date) as month, COALESCE(SUM(amount),0) as revenue, COUNT(*) as count
    FROM sales WHERE agent_name = ?
    GROUP BY month ORDER BY month DESC LIMIT 6
  `).all(name);
  res.json({ stats, sales, monthly });
});

module.exports = router;
