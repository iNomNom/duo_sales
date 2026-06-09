const router = require('express').Router();
const { db, getSalesPeriod, getDisplayPeriod, getAgentSalesCycles } = require('../models/db');
const auth = require('../middleware/auth');

// Helper: Determine which cycle period a sale date falls into for a given agent
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

router.get('/', auth, (req, res) => {
  const { from, to, filter } = req.query;

  // Get all agents with their sales cycles
  const agentCycles = getAgentSalesCycles();

  const results = agentCycles.map(ac => {
    const cycleStart = ac.sales_cycle_start || 8;

    // Determine date range based on filter
    let effectiveFrom = null;
    let effectiveTo = null;

    if (filter === 'monthly') {
      // Use cursor-based display period
      const displayPeriod = getDisplayPeriod(cycleStart, new Date());
      effectiveFrom = displayPeriod.periodStart;
      effectiveTo = displayPeriod.periodEnd;
    } else if (filter === 'custom' && from && to) {
      effectiveFrom = from;
      effectiveTo = to;
    }
    // filter === 'all_time' or no filter → no date restriction

    // Build the sales sub-condition
    let dateCond = '';
    const params = [];
    if (effectiveFrom) { dateCond += ' AND s.date >= ?'; params.push(effectiveFrom); }
    if (effectiveTo) { dateCond += ' AND s.date <= ?'; params.push(effectiveTo); }

    const row = db.prepare(`
      SELECT
        COUNT(s.id) as total_sales,
        COALESCE(SUM(CASE WHEN s.status NOT IN ('Cancelled','Chargeback') THEN s.amount ELSE 0 END),0) as total_revenue,
        SUM(CASE WHEN s.status='Active' THEN 1 ELSE 0 END) as active_sales,
        SUM(CASE WHEN s.status='Pending' THEN 1 ELSE 0 END) as pending_sales,
        SUM(CASE WHEN s.status='Cancelled' THEN 1 ELSE 0 END) as cancelled_sales,
        SUM(CASE WHEN s.status='Chargeback' THEN 1 ELSE 0 END) as chargeback_sales,
        COALESCE(SUM(CASE WHEN s.status='Cancelled' THEN s.amount ELSE 0 END),0) as cancelled_amount,
        COALESCE(SUM(CASE WHEN s.status='Chargeback' THEN s.amount ELSE 0 END),0) as chargeback_amount
      FROM sales s
      WHERE s.agent_name = ?${dateCond}
    `).get(ac.name, ...params);

    // Get display period info with cursor logic
    const displayPeriod = getDisplayPeriod(cycleStart, new Date());
    const fullPeriod = getSalesPeriod(cycleStart, new Date());

    return {
      id: ac.name,
      name: ac.name,
      total_sales: row?.total_sales || 0,
      total_revenue: row?.total_revenue || 0,
      active_sales: row?.active_sales || 0,
      pending_sales: row?.pending_sales || 0,
      cancelled_sales: row?.cancelled_sales || 0,
      chargeback_sales: row?.chargeback_sales || 0,
      cancelled_amount: row?.cancelled_amount || 0,
      chargeback_amount: row?.chargeback_amount || 0,
      sales_cycle_start: cycleStart,
      sales_period: displayPeriod,
      full_period: { periodStart: fullPeriod.periodStart, periodEnd: fullPeriod.periodEnd },
      is_current_cycle_active: displayPeriod.isCurrentCycleActive,
      cycle_label: displayPeriod.cycleLabel
    };
  });

  // Enrich with user data (email, role, created_at)
  const users = db.prepare("SELECT id, name, email, role, sales_cycle_start, created_at FROM users WHERE role = 'agent'").all();
  const userMap = {};
  users.forEach(u => { userMap[u.name] = u; });

  const finalResults = results.map(r => ({
    ...r,
    id: userMap[r.name]?.id || r.name,
    email: userMap[r.name]?.email || '',
    role: userMap[r.name]?.role || 'agent',
    created_at: userMap[r.name]?.created_at || '',
  }));

  // Sort by revenue descending
  finalResults.sort((a, b) => (b.total_revenue || 0) - (a.total_revenue || 0));

  res.json(finalResults);
});

module.exports = router;
