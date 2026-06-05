// backend/routes/seed.js
const router = require('express').Router();
const { db } = require('../models/db');
const bcrypt = require('bcryptjs');

// ── SEED ENDPOINT — wipe & re-populate with test data ─────────────────────────
// Usage: POST /api/seed  (no auth required, dev-only)
// Call it once then remove the route from server.js for production.
// ──────────────────────────────────────────────────────────────────────────────

router.post('/', (req, res) => {
  try {
    // ── 1. Wipe existing data ────────────────────────────────────────────────
    db.exec('DELETE FROM notifications');
    db.exec('DELETE FROM sales');
    db.exec('DELETE FROM users');
    console.log('Cleared existing data...');

    // ── 2. Create users ──────────────────────────────────────────────────────
    const users = [
      { name: 'Admin',        email: 'admin@duoenterprizes.com',   password: 'admin123',  role: 'admin'   },
      { name: 'Mike Ross',    email: 'mike@duoenterprizes.com',    password: 'manager123', role: 'manager' },
      { name: 'Sarah Chen',   email: 'sarah@duoenterprizes.com',   password: 'manager123', role: 'manager' },
      { name: 'James Wilson', email: 'james@duoenterprizes.com',   password: 'agent123',   role: 'agent'   },
      { name: 'Maria Garcia', email: 'maria@duoenterprizes.com',   password: 'agent123',   role: 'agent'   },
      { name: 'David Kim',    email: 'david@duoenterprizes.com',   password: 'agent123',   role: 'agent'   },
      { name: 'Emily Taylor', email: 'emily@duoenterprizes.com',   password: 'agent123',   role: 'agent'   },
      { name: 'Chris Brown',  email: 'chris@duoenterprizes.com',   password: 'agent123',   role: 'agent'   },
      { name: 'Lisa Wang',    email: 'lisa@duoenterprizes.com',    password: 'agent123',   role: 'agent'   },
      { name: 'Tom Harris',   email: 'tom@duoenterprizes.com',     password: 'agent123',   role: 'agent'   },
    ];

    const insertUser = db.prepare(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)'
    );
    const userMap = {};
    for (const u of users) {
      const hash = bcrypt.hashSync(u.password, 10);
      const r = insertUser.run(u.name, u.email, hash, u.role);
      userMap[u.name] = r.lastInsertRowid;
    }
    console.log(`Created ${users.length} users`);

    // ── 3. Sales data pools ──────────────────────────────────────────────────
    const agents = ['James Wilson', 'Maria Garcia', 'David Kim', 'Emily Taylor', 'Chris Brown', 'Lisa Wang', 'Tom Harris'];

    const carriers = [
      'Swift Transportation', 'Schneider National', 'J.B. Hunt', 'Werner Enterprises',
      'Prime Inc', 'Knight-Swift', 'U.S. Xpress', 'Roehl Transport',
      'C.R. England', 'Stevens Transport', 'Heartland Express', 'Martens Transport',
      'TMC Transportation', 'Maverick USA', 'Melton Truck Lines', 'KLLM Transport',
      'Western Express', 'USA Truck', 'Celadon Group', 'CRST International',
      'ATS Express', 'Ridge Creek Logistics', 'Trident Logistics', 'Pinnacle Freight',
      'Summit Carriers', 'Vanguard Transport', 'Alpha Freight Solutions', 'Delta Express Lines'
    ];

    const companies = [
      'Walmart Inc', 'Amazon Logistics', 'FedEx Supply Chain', 'Target Corp',
      'Home Depot Supply', 'Costco Wholesale', 'Procter & Gamble', 'Coca-Cola Bottling',
      'PepsiCo Distribution', 'General Mills Logistics', 'Kraft Heinz Transport',
      'Unilever Supply Chain', 'Johnson & Johnson Dist', '3M Logistics',
      'Dow Chemical Transport', 'Caterpillar Freight', 'Boeing Parts Supply',
      'Intel Shipping Corp', 'Apple Distribution', 'Tesla Parts Logistics',
      'Nestle Freight', 'Loreal Transport', 'Nike Distribution Center',
      'Samsung Supply Chain', 'Dell Logistics Inc', 'HP Enterprise Transport',
      'Cisco Freight', 'Oracle Supply Chain'
    ];

    const lanes = [
      'Chicago IL → Dallas TX', 'Los Angeles CA → Phoenix AZ', 'Atlanta GA → Miami FL',
      'New York NY → Boston MA', 'Seattle WA → Portland OR', 'Denver CO → Salt Lake City UT',
      'Houston TX → New Orleans LA', 'Detroit MI → Cleveland OH', 'Nashville TN → Memphis TN',
      'Minneapolis MN → Milwaukee WI', 'San Francisco CA → Sacramento CA', 'Charlotte NC → Raleigh NC',
      'Philadelphia PA → Pittsburgh PA', 'St. Louis MO → Kansas City MO', 'Indianapolis IN → Columbus OH',
      'Jacksonville FL → Tampa FL', 'San Antonio TX → Austin TX', 'Orlando FL → Atlanta GA',
      'Las Vegas NV → Albuquerque NM', 'Richmond VA → Washington DC', 'Birmingham AL → Mobile AL',
      'Oklahoma City OK → Tulsa OK', 'Omaha NE → Des Moines IA', 'Louisville KY → Cincinnati OH'
    ];

    const purposes = ['Freight Brokerage', 'Dispatch Service', 'Load Board', 'Carrier Onboarding', 'Route Optimization', 'Fleet Management', 'Cargo Insurance', 'Logistics Consulting'];

    const trucks = ['Dry Van', 'Reefer', 'Flatbed', 'Box Truck', 'Tanker', 'Step Deck', 'Conestoga', 'Hotshot'];

    const accTypes = ['New Account', 'Existing Account', 'Referral', 'Cold Call', 'Online Lead', 'Trade Show'];

    const statuses = ['Active', 'Pending', 'Cancelled', 'Chargeback'];
    const statusWeights = [0.45, 0.30, 0.15, 0.10]; // weighted random

    const addresses = [
      '1234 Main St, Chicago, IL 60601', '5678 Oak Ave, Dallas, TX 75201',
      '910 Elm Blvd, Atlanta, GA 30301', '246 Pine Rd, Miami, FL 33101',
      '135 Cedar Ln, New York, NY 10001', '789 Birch Way, Seattle, WA 98101',
      '321 Maple Dr, Denver, CO 80201', '654 Walnut St, Houston, TX 77001',
      '987 Spruce Ct, Detroit, MI 48201', '111 Ash Pl, Nashville, TN 37201'
    ];

    const closers = ['Admin', 'Mike Ross', 'Sarah Chen', 'Self'];

    // ── Helper: random from array ────────────────────────────────────────────
    function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
    function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
    function randAmount() { return Math.round((randInt(500, 25000) + Math.random() * 100) * 100) / 100; }
    function weightedStatus() {
      const r = Math.random();
      let cum = 0;
      for (let i = 0; i < statuses.length; i++) {
        cum += statusWeights[i];
        if (r <= cum) return statuses[i];
      }
      return 'Pending';
    }
    function randDate(daysBack) {
      const d = new Date();
      d.setDate(d.getDate() - randInt(0, daysBack));
      return d.toISOString().split('T')[0];
    }
    function randEmail(name, carrier) {
      const domains = ['gmail.com', 'outlook.com', 'company.com', 'carrier.net', 'transport.org'];
      const prefix = name.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z.]/g, '');
      return `${prefix}@${pick(domains)}`;
    }
    function randPhone() {
      return `(${randInt(200,999)}) ${randInt(200,999)}-${randInt(1000,9999)}`;
    }

    // ── 4. Generate 200 sales spread across 6 months ─────────────────────────
    const insertSale = db.prepare(`
      INSERT INTO sales (
        date, agent_name, carrier_name, email, lane_details, amount,
        purpose, lane_start_date, truck, phone_number, company_name,
        address, acc_type, status, closed_by, notes, created_by
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `);

    const SALE_COUNT = 200;
    let salesInserted = 0;

    const insertMany = db.transaction(() => {
      for (let i = 0; i < SALE_COUNT; i++) {
        const agent = pick(agents);
        const carrier = pick(carriers);
        const company = pick(companies);
        const status = weightedStatus();
        const saleDate = randDate(180);
        const laneStart = randDate(180);

        insertSale.run(
          saleDate,                                          // date
          agent,                                             // agent_name
          carrier,                                           // carrier_name
          randEmail(carrier, company),                       // email
          pick(lanes),                                       // lane_details
          randAmount(),                                      // amount
          pick(purposes),                                    // purpose
          laneStart,                                         // lane_start_date
          pick(trucks),                                      // truck
          randPhone(),                                       // phone_number
          company,                                           // company_name
          pick(addresses),                                   // address
          pick(accTypes),                                    // acc_type
          status,                                            // status
          pick(closers),                                     // closed_by
          i % 7 === 0 ? 'Follow up next week' : (i % 11 === 0 ? 'Priority account' : ''), // notes
          userMap[agent] || 1                                // created_by
        );
        salesInserted++;
      }
    });

    insertMany();
    console.log(`Created ${salesInserted} sales records`);

    // ── 5. Create some notifications for each agent ──────────────────────────
    const insertNotif = db.prepare(
      'INSERT INTO notifications (user_id, message, type) VALUES (?, ?, ?)'
    );

    const notifTypes = ['status_change', 'info', 'info', 'info'];
    const notifMessages = [
      'Your sale #SALE_ID has been marked as Active',
      'New sale assigned to you',
      'Reminder: follow up on pending sales',
      'Weekly performance report is ready',
      'Sale #SALE_ID status changed to Chargeback by Admin',
      'Monthly target: you are at 75% completion',
    ];

    let notifCount = 0;
    for (const [name, uid] of Object.entries(userMap)) {
      if (name === 'Admin' || name === 'Mike Ross' || name === 'Sarah Chen') continue;
      const count = randInt(3, 8);
      for (let j = 0; j < count; j++) {
        const msg = pick(notifMessages).replace('#SALE_ID', `#${randInt(1, 50)}`);
        insertNotif.run(uid, msg, pick(notifTypes));
        notifCount++;
      }
    }
    console.log(`Created ${notifCount} notifications`);

    // ── 6. Summary ───────────────────────────────────────────────────────────
    const summary = {
      users: users.length,
      agents: agents.length,
      sales: salesInserted,
      notifications: notifCount,
      loginInfo: {
        admin:   { email: 'admin@duoenterprizes.com',  password: 'admin123'   },
        manager: { email: 'mike@duoenterprizes.com',   password: 'manager123' },
        agent:   { email: 'james@duoenterprizes.com',  password: 'agent123'   },
      },
      dateRange: 'Last 6 months',
      statusBreakdown: db.prepare(
        'SELECT status, COUNT(*) as count FROM sales GROUP BY status'
      ).all(),
    };

    res.json({ message: 'Database seeded successfully!', summary });
  } catch (err) {
    console.error('Seed error:', err);
    res.status(500).json({ error: 'Seed failed', details: err.message });
  }
});

module.exports = router;