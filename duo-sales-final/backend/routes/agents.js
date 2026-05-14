const router = require('express').Router();
const db = require('../models/db');
const auth = require('../middleware/auth');

router.get('/', auth, (req, res) => {
  const agents = db.prepare(`
    SELECT u.id, u.name, u.email, u.role, u.created_at,
           COUNT(s.id) as total_sales,
           COALESCE(SUM(s.amount),0) as total_revenue,
           SUM(CASE WHEN s.status='Active' THEN 1 ELSE 0 END) as active_sales,
           SUM(CASE WHEN s.status='Pending' THEN 1 ELSE 0 END) as pending_sales,
           SUM(CASE WHEN s.status='Cancelled' THEN 1 ELSE 0 END) as cancelled_sales,
           SUM(CASE WHEN s.status='Chargeback' THEN 1 ELSE 0 END) as chargeback_sales
    FROM users u
    LEFT JOIN sales s ON s.agent_name = u.name
    WHERE u.role = 'agent'
    GROUP BY u.id
    ORDER BY total_revenue DESC
  `).all();
  res.json(agents);
});

module.exports = router;
