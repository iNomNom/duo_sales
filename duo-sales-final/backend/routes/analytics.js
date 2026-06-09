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

// Helper: Get cycle format label (e.g., "1-End", "8-7")
function getCycleFormatLabel(cycleStartDay) {
  if (cycleStartDay === 1) return '1-End';
  return `${cycleStartDay}-${cycleStartDay - 1}`;
}

// Helper: Calculate per-agent sales period revenue for dashboard using cursor logic
function computeDashboardWithAgentCycles(userRole, userName) {
  const agentCycles = getAgentSalesCycles();
  const now = new Date();

  const agentPeriods = agentCycles.map(a => {
    const cycleStart = a.sales_cycle_start || 8;
    const dp = getDisplayPeriod(cycleStart, now);
    return {
      name: a.name,
      cycleStart,
      periodStart: dp.periodStart,
      periodEnd: dp.periodEnd,
      fullPeriodStart: dp.fullPeriodStart,
      fullPeriodEnd: dp.fullPeriodEnd,
      isCurrentCycleActive: dp.isCurrentCycleActive
    };
  });

  let totalSales = 0;
  let totalRevenue = 0;
  let activeCount = 0;
  let pendingCount = 0;
  let cancelledCount = 0;
  let chargebackCount = 0;
  let chargebackAmount = 0;

  for (const ap of agentPeriods) {
    if (userRole === 'agent' && ap.name !== userName) continue;

    const from = ap.periodStart;
    const to = ap.periodEnd;

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

// Helper: Compute totals for ALL TIME (no date filter)
function computeAllTimeTotals(userRole, userName) {
  let where = 'WHERE 1=1';
  const p = [];
  if (userRole === 'agent') {
    where += ' AND agent_name = ?';
    p.push(userName);
  }

  return db.prepare(`
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

// Helper: Compute totals for a specific date range
function computeDateRangeTotals(userRole, userName, from, to) {
  let where = 'WHERE date >= ? AND date <= ?';
  const p = [from, to];
  if (userRole === 'agent') {
    where += ' AND agent_name = ?';
    p.push(userName);
  }

  return db.prepare(`
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

router.get('/dashboard', auth, (req, res) => {
  const { from, to, filter } = req.query;
  const hasCustomDates = from && to;
  const isAllTime = filter === 'all_time';
  const isSalesCycle = !filter || filter === 'sales_cycle';

  const userCycleStart = req.user.sales_cycle_start || 8;

  // Determine effective date range for non-totals sections
  let effectiveFrom, effectiveTo;
  if (isAllTime) {
    effectiveFrom = null;
    effectiveTo = null;
  } else if (hasCustomDates) {
    effectiveFrom = from;
    effectiveTo = to;
  } else {
    // Sales Cycle: use user's default period as approximation for non-totals sections
    const defaultPeriod = getSalesPeriod(userCycleStart, new Date());
    effectiveFrom = defaultPeriod.periodStart;
    effectiveTo = defaultPeriod.periodEnd;
  }

  // ── Totals ──────────────────────────────────────────────────────────────
  let totals;
  if (isAllTime) {
    totals = computeAllTimeTotals(req.user.role, req.user.name);
  } else if (isSalesCycle && !hasCustomDates) {
    totals = computeDashboardWithAgentCycles(req.user.role, req.user.name);
  } else {
    totals = computeDateRangeTotals(req.user.role, req.user.name, effectiveFrom, effectiveTo);
  }

  // ── Monthly revenue trend (last 6 months, always all data) ─────────────
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

  // ── Top agents ──────────────────────────────────────────────────────────
  let agents = [];
  if (req.user.role !== 'agent') {
    const agentCycles = getAgentSalesCycles();
    for (const ac of agentCycles) {
      let agentFrom, agentTo;
      if (isAllTime) {
        agentFrom = null;
        agentTo = null;
      } else if (hasCustomDates) {
        agentFrom = effectiveFrom;
        agentTo = effectiveTo;
      } else {
        // Sales Cycle: cursor-based display period
        const dp = getDisplayPeriod(ac.sales_cycle_start || 8, new Date());
        agentFrom = dp.periodStart;
        agentTo = dp.periodEnd;
      }

      let row;
      if (agentFrom && agentTo) {
        row = db.prepare(`
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
      } else {
        row = db.prepare(`
          SELECT agent_name,
                 COUNT(*) as sales_count,
                 COALESCE(SUM(CASE WHEN status NOT IN ('Cancelled','Chargeback') THEN amount ELSE 0 END),0) as revenue,
                 SUM(CASE WHEN status='Active' THEN 1 ELSE 0 END) as active,
                 SUM(CASE WHEN status='Cancelled' THEN 1 ELSE 0 END) as cancelled,
                 SUM(CASE WHEN status='Chargeback' THEN 1 ELSE 0 END) as chargebacks
          FROM sales
          WHERE agent_name = ?
          GROUP BY agent_name
        `).get(ac.name);
      }

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

  // ── Top companies ──────────────────────────────────────────────────────
  let companies = [];
  if (isAllTime || !effectiveFrom) {
    let compWhere = "WHERE company_name IS NOT NULL AND company_name != ''";
    const compP = [];
    if (req.user.role === 'agent') { compWhere += ' AND agent_name = ?'; compP.push(req.user.name); }
    companies = db.prepare(`
      SELECT company_name,
             COUNT(*) as sales_count,
             COALESCE(SUM(CASE WHEN status NOT IN ('Cancelled','Chargeback') THEN amount ELSE 0 END),0) as revenue,
             SUM(CASE WHEN status='Active' THEN 1 ELSE 0 END) as active,
             SUM(CASE WHEN status='Cancelled' THEN 1 ELSE 0 END) as cancelled
      FROM sales ${compWhere}
      GROUP BY company_name ORDER BY revenue DESC LIMIT 10
    `).all(...compP);
  } else {
    let compWhere = 'WHERE date >= ? AND date <= ?';
    const compP = [effectiveFrom, effectiveTo];
    if (req.user.role === 'agent') { compWhere += ' AND agent_name = ?'; compP.push(req.user.name); }
    companies = db.prepare(`
      SELECT company_name,
             COUNT(*) as sales_count,
             COALESCE(SUM(CASE WHEN status NOT IN ('Cancelled','Chargeback') THEN amount ELSE 0 END),0) as revenue,
             SUM(CASE WHEN status='Active' THEN 1 ELSE 0 END) as active,
             SUM(CASE WHEN status='Cancelled' THEN 1 ELSE 0 END) as cancelled
      FROM sales ${compWhere}
      GROUP BY company_name ORDER BY revenue DESC LIMIT 10
    `).all(...compP);
  }

  // ── Status breakdown ────────────────────────────────────────────────────
  let statusBreakdown = [];
  if (isAllTime || !effectiveFrom) {
    let statusWhere = 'WHERE 1=1';
    const statusP = [];
    if (req.user.role === 'agent') { statusWhere += ' AND agent_name = ?'; statusP.push(req.user.name); }
    statusBreakdown = db.prepare(`
      SELECT status, COUNT(*) as count, COALESCE(SUM(amount),0) as revenue
      FROM sales ${statusWhere}
      GROUP BY status
    `).all(...statusP);
  } else {
    let statusWhere = 'WHERE date >= ? AND date <= ?';
    const statusP = [effectiveFrom, effectiveTo];
    if (req.user.role === 'agent') { statusWhere += ' AND agent_name = ?'; statusP.push(req.user.name); }
    statusBreakdown = db.prepare(`
      SELECT status, COUNT(*) as count, COALESCE(SUM(amount),0) as revenue
      FROM sales ${statusWhere}
      GROUP BY status
    `).all(...statusP);
  }

  // ── Recent 10 sales ────────────────────────────────────────────────────
  let recent = [];
  if (isAllTime || !effectiveFrom) {
    let recentWhere = 'WHERE 1=1';
    const recentP = [];
    if (req.user.role === 'agent') { recentWhere += ' AND agent_name = ?'; recentP.push(req.user.name); }
    recent = db.prepare(`
      SELECT id, date, agent_name, carrier_name, company_name, amount, status, created_at
      FROM sales ${recentWhere}
      ORDER BY created_at DESC LIMIT 10
    `).all(...recentP);
  } else {
    let recentWhere = 'WHERE date >= ? AND date <= ?';
    const recentP = [effectiveFrom, effectiveTo];
    if (req.user.role === 'agent') { recentWhere += ' AND agent_name = ?'; recentP.push(req.user.name); }
    recent = db.prepare(`
      SELECT id, date, agent_name, carrier_name, company_name, amount, status, created_at
      FROM sales ${recentWhere}
      ORDER BY created_at DESC LIMIT 10
    `).all(...recentP);
  }

  // ── Agent count ────────────────────────────────────────────────────────
  const agentCount = req.user.role !== 'agent'
    ? db.prepare('SELECT COUNT(*) as count FROM users WHERE role = ?').get('agent').count
    : 0;

  // ── Unique companies count ─────────────────────────────────────────────
  let companyCount;
  if (isAllTime || !effectiveFrom) {
    let cntWhere = "WHERE company_name IS NOT NULL AND company_name != ''";
    const cntP = [];
    if (req.user.role === 'agent') { cntWhere += ' AND agent_name = ?'; cntP.push(req.user.name); }
    companyCount = db.prepare(`SELECT COUNT(DISTINCT company_name) as count FROM sales ${cntWhere}`).get(...cntP).count;
  } else {
    let cntWhere = "WHERE company_name IS NOT NULL AND company_name != '' AND date >= ? AND date <= ?";
    const cntP = [effectiveFrom, effectiveTo];
    if (req.user.role === 'agent') { cntWhere += ' AND agent_name = ?'; cntP.push(req.user.name); }
    companyCount = db.prepare(`SELECT COUNT(DISTINCT company_name) as count FROM sales ${cntWhere}`).get(...cntP).count;
  }

  // ── Sales period info with cursor logic ────────────────────────────────
  const agentCycles = getAgentSalesCycles();
  const salesPeriods = agentCycles.map(a => {
    const cycleStart = a.sales_cycle_start || 8;
    const dp = getDisplayPeriod(cycleStart, new Date());
    return {
      agent_name: a.name,
      cycle_start: cycleStart,
      cycle_format: getCycleFormatLabel(cycleStart),
      periodStart: dp.periodStart,
      periodEnd: dp.periodEnd,
      isCurrentCycleActive: dp.isCurrentCycleActive,
      cycleLabel: dp.cycleLabel,
      fullPeriodStart: dp.fullPeriodStart,
      fullPeriodEnd: dp.fullPeriodEnd
    };
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
      from: effectiveFrom || null,
      to: effectiveTo || null,
      filterMode: isAllTime ? 'all_time' : (isSalesCycle && !hasCustomDates) ? 'sales_cycle' : 'custom',
      isDefault: isSalesCycle && !hasCustomDates,
      agentPeriods: salesPeriods,
      userCycleStart: userCycleStart
    }
  });
});

// Per-agent detail
router.get('/agent/:name', auth, (req, res) => {
  const name = decodeURIComponent(req.params.name);
  if (req.user.role === 'agent' && req.user.name !== name) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { from, to, filter } = req.query;

  const agentUser = db.prepare("SELECT sales_cycle_start FROM users WHERE name = ? AND role = 'agent'").get(name);
  const cycleStart = agentUser?.sales_cycle_start || 8;

  // Determine date range
  let effectiveFrom, effectiveTo;
  if (filter === 'all_time') {
    effectiveFrom = null;
    effectiveTo = null;
  } else if (filter === 'monthly' || (!from && !to)) {
    const dp = getDisplayPeriod(cycleStart, new Date());
    effectiveFrom = dp.periodStart;
    effectiveTo = dp.periodEnd;
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

  // Add cycle period info to each sale
  const salesWithCycle = sales.map(s => {
    const cyclePeriod = getCyclePeriodForDate(cycleStart, s.date);
    return {
      ...s,
      cycle_period_start: cyclePeriod.periodStart,
      cycle_period_end: cyclePeriod.periodEnd,
      cycle_start_day: cycleStart,
      cycle_format: getCycleFormatLabel(cycleStart)
    };
  });

  // Stats
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

  // Monthly breakdown (all time for chart)
  const monthly = db.prepare(`
    SELECT strftime('%Y-%m', date) as month,
           COALESCE(SUM(CASE WHEN status NOT IN ('Cancelled','Chargeback') THEN amount ELSE 0 END),0) as revenue,
           COUNT(*) as count
    FROM sales WHERE agent_name = ?
    GROUP BY month ORDER BY month DESC LIMIT 6
  `).all(name);

  const dp = getDisplayPeriod(cycleStart, new Date());

  res.json({
    stats,
    sales: salesWithCycle,
    monthly,
    salesCycle: {
      cycle_start: cycleStart,
      cycle_format: getCycleFormatLabel(cycleStart),
      periodStart: dp.periodStart,
      periodEnd: dp.periodEnd,
      isCurrentCycleActive: dp.isCurrentCycleActive,
      cycleLabel: dp.cycleLabel,
      fullPeriodStart: dp.fullPeriodStart,
      fullPeriodEnd: dp.fullPeriodEnd
    },
    periodUsed: { from: effectiveFrom, to: effectiveTo }
  });
});

module.exports = router;
