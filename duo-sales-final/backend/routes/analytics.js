const router = require('express').Router();
const { db, getSalesPeriod, getAgentSalesCycles } = require('../models/db');
const auth = require('../middleware/auth');

// Helper: Calculate per-agent sales period revenue for dashboard
// This handles the case where different agents have different sales cycles
function computeDashboardWithAgentCycles(userRole, userName, customFrom, customTo) {
  const agentCycles = getAgentSalesCycles();
  const now = new Date();

  // For each agent, calculate their current sales period
  const agentPeriods = agentCycles.map(a => {
    const period = getSalesPeriod(a.sales_cycle_start || 7, now);
    return { name: a.name, cycleStart: a.sales_cycle_start || 7, ...period };
  });

  // Calculate total revenue using per-agent sales periods
  // Net revenue = Active + Pending only (exclude Cancelled + Chargeback)
  let totalSales = 0;
  let totalRevenue = 0;
  let activeCount = 0;
  let pendingCount = 0;
  let cancelledCount = 0;
  let chargebackCount = 0;
  let chargebackAmount = 0;

  for (const ap of agentPeriods) {
    // If agent view, only calculate for their own period
    if (userRole === 'agent' && ap.name !== userName) continue;

    // Use custom dates if provided, otherwise use sales period
    const from = customFrom || ap.periodStart;
    const to = customTo || ap.periodEnd;

    const row = db.prepare(`
      SELECT
        COUNT(*) as cnt,
        COALESCE(SUM(CASE WHEN status NOT IN ('Cancelled','Chargeback') THEN amount ELSE 0 END),0) as net_revenue,
        SUM(CASE WHEN status='Active' THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN status='Pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status='Cancelled' THEN 1 ELSE 0 END) as cancelled,
        SUM(CASE WHEN status='Chargeback' THEN 1 ELSE 0 END) as chargebacks,
        COALESCE(SUM(CASE WHEN status='Chargeback' THEN amount ELSE 0 END),0) as chargeback_amt
      FROM sales
      WHERE agent_name = ? AND date >= ? AND date <= ?
    `).get(ap.name, from, to);

    totalSales += row.cnt;
    totalRevenue += row.net_revenue;
    activeCount += row.active;
    pendingCount += row.pending;
    cancelledCount += row.cancelled;
    chargebackCount += row.chargebacks;
    chargebackAmount += row.chargeback_amt;
  }

  return {
    total_sales: totalSales,
    total_revenue: totalRevenue,
    active: activeCount,
    pending: pendingCount,
    cancelled: cancelledCount,
    chargebacks: chargebackCount,
    chargeback_amount: chargebackAmount
  };
}

router.get('/dashboard', auth, (req, res) => {
  const { from, to } = req.query;
  const hasCustomDates = from && to;

  // ── Determine default sales period ────────────────────────────────────
  // Default: use per-agent sales cycles
  // If custom from/to provided, use those instead
  const userCycleStart = req.user.sales_cycle_start || 7;
  const defaultPeriod = getSalesPeriod(userCycleStart, new Date());

  const effectiveFrom = from || defaultPeriod.periodStart;
  const effectiveTo = to || defaultPeriod.periodEnd;

  // ── Totals ──────────────────────────────────────────────────────────────
  let totals;

  if (!hasCustomDates) {
    // Use per-agent sales cycles for totals
    totals = computeDashboardWithAgentCycles(req.user.role, req.user.name);
  } else {
    // Use custom date range with standard query
    let where = 'WHERE date >= ? AND date <= ?';
    const p = [effectiveFrom, effectiveTo];

    if (req.user.role === 'agent') {
      where += ' AND agent_name = ?';
      p.push(req.user.name);
    }

    totals = db.prepare(`
      SELECT
        COUNT(*) as total_sales,
        COALESCE(SUM(CASE WHEN status NOT IN ('Cancelled','Chargeback') THEN amount ELSE 0 END),0) as total_revenue,
        SUM(CASE WHEN status='Active' THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN status='Pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status='Cancelled' THEN 1 ELSE 0 END) as cancelled,
        SUM(CASE WHEN status='Chargeback' THEN 1 ELSE 0 END) as chargebacks,
        COALESCE(SUM(CASE WHEN status='Chargeback' THEN amount ELSE 0 END),0) as chargeback_amount
      FROM sales ${where}
    `).get(...p);
  }

  // ── Monthly revenue trend (last 6 months, net revenue only) ─────────────
  let monthlyWhere = 'WHERE date >= date(\'now\',\'-6 months\')';
  const monthlyP = [];
  if (req.user.role === 'agent') {
    monthlyWhere += ' AND agent_name = ?';
    monthlyP.push(req.user.name);
  }
  const monthly = db.prepare(`
    SELECT strftime('%Y-%m', date) as month,
           COALESCE(SUM(CASE WHEN status NOT IN ('Cancelled','Chargeback') THEN amount ELSE 0 END),0) as revenue,
           COUNT(*) as count
    FROM sales
    ${monthlyWhere}
    GROUP BY month ORDER BY month
  `).all(...monthlyP);

  // ── Top agents (admin/manager) using per-agent sales cycles ───────────
  let agents = [];
  if (req.user.role !== 'agent') {
    const agentCycles = getAgentSalesCycles();
    for (const ac of agentCycles) {
      let agentFrom, agentTo;
      if (hasCustomDates) {
        agentFrom = effectiveFrom;
        agentTo = effectiveTo;
      } else {
        const period = getSalesPeriod(ac.sales_cycle_start || 7, new Date());
        agentFrom = period.periodStart;
        agentTo = period.periodEnd;
      }

      const row = db.prepare(`
        SELECT agent_name,
               COUNT(*) as sales_count,
               COALESCE(SUM(CASE WHEN status NOT IN ('Cancelled','Chargeback') THEN amount ELSE 0 END),0) as revenue,
               SUM(CASE WHEN status='Active' THEN 1 ELSE 0 END) as active,
               SUM(CASE WHEN status='Cancelled' THEN 1 ELSE 0 END) as cancelled,
               SUM(CASE WHEN status='Chargeback' THEN 1 ELSE 0 END) as chargebacks
        FROM sales
        WHERE agent_name = ? AND date >= ? AND date <= ?
        GROUP BY agent_name
      `).get(ac.name, agentFrom, agentTo);

      if (row && row.sales_count > 0) {
        agents.push(row);
      } else {
        agents.push({
          agent_name: ac.name, sales_count: 0, revenue: 0,
          active: 0, cancelled: 0, chargebacks: 0
        });
      }
    }
    agents.sort((a, b) => b.revenue - a.revenue);
  }

  // ── Top companies (within the effective date range) ─────────────────────
  let compWhere = 'WHERE date >= ? AND date <= ?';
  const compP = [effectiveFrom, effectiveTo];
  if (req.user.role === 'agent') {
    compWhere += ' AND agent_name = ?';
    compP.push(req.user.name);
  }
  const companies = db.prepare(`
    SELECT company_name,
           COUNT(*) as sales_count,
           COALESCE(SUM(CASE WHEN status NOT IN ('Cancelled','Chargeback') THEN amount ELSE 0 END),0) as revenue,
           SUM(CASE WHEN status='Active' THEN 1 ELSE 0 END) as active,
           SUM(CASE WHEN status='Cancelled' THEN 1 ELSE 0 END) as cancelled
    FROM sales ${compWhere}
    GROUP BY company_name ORDER BY revenue DESC LIMIT 10
  `).all(...compP);

  // ── Status breakdown for donut chart ────────────────────────────────────
  let statusWhere = 'WHERE date >= ? AND date <= ?';
  const statusP = [effectiveFrom, effectiveTo];
  if (req.user.role === 'agent') {
    statusWhere += ' AND agent_name = ?';
    statusP.push(req.user.name);
  }
  const statusBreakdown = db.prepare(`
    SELECT status, COUNT(*) as count, COALESCE(SUM(amount),0) as revenue
    FROM sales ${statusWhere}
    GROUP BY status
  `).all(...statusP);

  // ── Recent 10 sales (within sales period) ─────────────────────────────
  let recentWhere = 'WHERE date >= ? AND date <= ?';
  const recentP = [effectiveFrom, effectiveTo];
  if (req.user.role === 'agent') {
    recentWhere += ' AND agent_name = ?';
    recentP.push(req.user.name);
  }
  const recent = db.prepare(`
    SELECT id, date, agent_name, carrier_name, company_name, amount, status, created_at
    FROM sales ${recentWhere}
    ORDER BY created_at DESC LIMIT 10
  `).all(...recentP);

  // ── Agent count (admin/manager only) ────────────────────────────────────
  const agentCount = req.user.role !== 'agent'
    ? db.prepare('SELECT COUNT(*) as count FROM users WHERE role = ?').get('agent').count
    : 0;

  // ── Unique companies count ──────────────────────────────────────────────
  const companyCount = db.prepare(
    `SELECT COUNT(DISTINCT company_name) as count FROM sales WHERE company_name IS NOT NULL AND company_name != '' AND date >= ? AND date <= ?${req.user.role === 'agent' ? ' AND agent_name = ?' : ''}`
  ).get(...(req.user.role === 'agent' ? [effectiveFrom, effectiveTo, req.user.name] : [effectiveFrom, effectiveTo])).count;

  // ── Include sales period info in response ─────────────────────────────
  const agentCycles = getAgentSalesCycles();
  const salesPeriods = agentCycles.map(a => {
    const period = getSalesPeriod(a.sales_cycle_start || 7, new Date());
    return { agent_name: a.name, cycle_start: a.sales_cycle_start || 7, ...period };
  });

  res.json({
    totals,
    monthly,
    agents,
    companies,
    statusBreakdown,
    recent,
    agentCount,
    companyCount,
    salesPeriod: {
      from: effectiveFrom,
      to: effectiveTo,
      isDefault: !hasCustomDates,
      agentPeriods: salesPeriods,
      userCycleStart: userCycleStart
    }
  });
});

// Per-agent detail
router.get('/agent/:name', auth, (req, res) => {
  const name = decodeURIComponent(req.params.name);
  // Agents can only see their own details
  if (req.user.role === 'agent' && req.user.name !== name) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { from, to, filter } = req.query;

  // Determine the agent's sales cycle
  const agentUser = db.prepare("SELECT sales_cycle_start FROM users WHERE name = ? AND role = 'agent'").get(name);
  const cycleStart = agentUser?.sales_cycle_start || 7;

  // Determine date range
  let effectiveFrom, effectiveTo;
  if (filter === 'all_time' || (!from && !to && filter !== 'monthly')) {
    // All time - no date filter (but default to sales cycle for initial load)
    if (filter === 'monthly' || (!from && !to)) {
      const period = getSalesPeriod(cycleStart, new Date());
      effectiveFrom = period.periodStart;
      effectiveTo = period.periodEnd;
    } else {
      effectiveFrom = null;
      effectiveTo = null;
    }
  } else {
    effectiveFrom = from;
    effectiveTo = to;
  }

  // Build WHERE clause
  let where = 'WHERE agent_name = ?';
  const params = [name];
  if (effectiveFrom) { where += ' AND date >= ?'; params.push(effectiveFrom); }
  if (effectiveTo) { where += ' AND date <= ?'; params.push(effectiveTo); }

  const sales = db.prepare(`SELECT * FROM sales ${where} ORDER BY date DESC`).all(...params);

  // Stats: net revenue (exclude Cancelled + Chargeback)
  let statsWhere = 'WHERE agent_name = ?';
  const statsParams = [name];
  if (effectiveFrom) { statsWhere += ' AND date >= ?'; statsParams.push(effectiveFrom); }
  if (effectiveTo) { statsWhere += ' AND date <= ?'; statsParams.push(effectiveTo); }

  const stats = db.prepare(`
    SELECT COUNT(*) as total,
           COALESCE(SUM(CASE WHEN status NOT IN ('Cancelled','Chargeback') THEN amount ELSE 0 END),0) as revenue,
           SUM(CASE WHEN status='Active' THEN 1 ELSE 0 END) as active,
           SUM(CASE WHEN status='Pending' THEN 1 ELSE 0 END) as pending,
           SUM(CASE WHEN status='Cancelled' THEN 1 ELSE 0 END) as cancelled,
           SUM(CASE WHEN status='Chargeback' THEN 1 ELSE 0 END) as chargebacks,
           COALESCE(SUM(CASE WHEN status='Cancelled' THEN amount ELSE 0 END),0) as cancelled_amount,
           COALESCE(SUM(CASE WHEN status='Chargeback' THEN amount ELSE 0 END),0) as chargeback_amount
    FROM sales ${statsWhere}
  `).get(...statsParams);

  // Monthly breakdown (all time for chart, net revenue)
  const monthly = db.prepare(`
    SELECT strftime('%Y-%m', date) as month,
           COALESCE(SUM(CASE WHEN status NOT IN ('Cancelled','Chargeback') THEN amount ELSE 0 END),0) as revenue,
           COUNT(*) as count
    FROM sales WHERE agent_name = ?
    GROUP BY month ORDER BY month DESC LIMIT 6
  `).all(name);

  // Include sales period info
  const salesPeriod = getSalesPeriod(cycleStart, new Date());

  res.json({
    stats,
    sales,
    monthly,
    salesCycle: { cycle_start: cycleStart, ...salesPeriod },
    periodUsed: { from: effectiveFrom, to: effectiveTo }
  });
});

module.exports = router;
