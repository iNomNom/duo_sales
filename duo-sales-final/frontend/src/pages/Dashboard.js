import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid } from 'recharts';

const STATUS_COLORS = { Active: '#34d399', Pending: '#fbbf24', Cancelled: '#f87171', Chargeback: '#a78bfa' };

// ── Date Presets ──────────────────────────────────────────────────────────
const DATE_PRESETS = [
  { label: 'Today', getRange: () => { const d = new Date().toISOString().split('T')[0]; return { from: d, to: d }; } },
  { label: 'This Week', getRange: () => { const now = new Date(); const day = now.getDay(); const diff = now.getDate() - day + (day === 0 ? -6 : 1); const mon = new Date(now.setDate(diff)); const sun = new Date(mon); sun.setDate(mon.getDate() + 6); return { from: mon.toISOString().split('T')[0], to: sun.toISOString().split('T')[0] }; } },
  { label: 'This Month', getRange: () => { const now = new Date(); return { from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0], to: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0] }; } },
  { label: 'This Quarter', getRange: () => { const now = new Date(); const q = Math.floor(now.getMonth() / 3); return { from: new Date(now.getFullYear(), q * 3, 1).toISOString().split('T')[0], to: new Date(now.getFullYear(), q * 3 + 3, 0).toISOString().split('T')[0] }; } },
  { label: 'This Year', getRange: () => { const y = new Date().getFullYear(); return { from: `${y}-01-01`, to: `${y}-12-31` }; } },
];

// ── KPI Card (clickable) ─────────────────────────────────────────────────
function KpiCard({ label, value, sub, color, onClick, icon }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
        padding: '18px 20px', cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.15s', position: 'relative',
      }}
      onMouseEnter={e => { if (onClick) { e.currentTarget.style.borderColor = color || 'var(--accent)'; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 4px 12px ${color || 'var(--accent)'}22`; } }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
    >
      {icon && <div style={{ position: 'absolute', top: 14, right: 16, fontSize: 20, opacity: 0.3 }}>{icon}</div>}
      <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 600, color: color || 'var(--text)', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>{sub}</div>}
      {onClick && <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 8, opacity: 0.6 }}>Click for details →</div>}
    </div>
  );
}

// ── Status Pill (clickable) ──────────────────────────────────────────────
function StatusPill({ status, count, bg, col, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: bg, border: `1px solid ${col}40`, borderRadius: 8, padding: '10px 16px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        cursor: 'pointer', transition: 'all 0.15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = `0 2px 8px ${col}33`; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
    >
      <span style={{ fontSize: 13, color: col, fontWeight: 500 }}>{status}</span>
      <span style={{ fontSize: 18, fontWeight: 600, color: col }}>{count}</span>
    </div>
  );
}

// ── Drill-Down Modal ─────────────────────────────────────────────────────
function DrillDownModal({ title, sales, agents, companies, type, onClose, onNavigate }) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const perPage = 15;

  const filteredSales = sales.filter(s => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (s.carrier_name || '').toLowerCase().includes(q) ||
           (s.company_name || '').toLowerCase().includes(q) ||
           (s.agent_name || '').toLowerCase().includes(q) ||
           (s.lane_details || '').toLowerCase().includes(q);
  });

  const paginatedSales = filteredSales.slice((page - 1) * perPage, page * perPage);
  const totalPages = Math.ceil(filteredSales.length / perPage);

  const totalRevenue = filteredSales.reduce((sum, s) => sum + (Number(s.amount) || 0), 0);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} />

      {/* Modal */}
      <div style={{
        position: 'relative', width: '90%', maxWidth: 1100, maxHeight: '85vh',
        background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 14,
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
      }}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)', margin: 0 }}>{title}</h2>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
              {type === 'sales' && `${filteredSales.length} records · Total: $${Number(totalRevenue).toLocaleString()}`}
              {type === 'agents' && `${agents.length} agents`}
              {type === 'companies' && `${companies.length} companies`}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {type === 'sales' && (
              <input placeholder="Search..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, padding: '7px 14px', color: 'var(--text)', fontSize: 12, outline: 'none', width: 240 }} />
            )}
            <button onClick={onClose} style={{ padding: '6px 14px', background: 'transparent', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--muted)', fontSize: 12, cursor: 'pointer' }}>✕ Close</button>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: 'auto', padding: '0 24px 20px' }}>
          {/* SALES TYPE */}
          {type === 'sales' && (
            <>
              {filteredSales.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>No sales found</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginTop: 16 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      {['Date', 'Agent', 'Carrier', 'Company', 'Lane', 'Amount', 'Status', 'Closed By'].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '10px 10px', fontSize: 11, fontWeight: 500, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.3px', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedSales.map(s => (
                      <tr key={s.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '10px 10px', color: 'var(--muted)', fontSize: 12 }}>{s.date}</td>
                        <td style={{ padding: '10px 10px', color: 'var(--text)' }}>{s.agent_name}</td>
                        <td style={{ padding: '10px 10px', color: 'var(--text)', fontWeight: 500 }}>{s.carrier_name}</td>
                        <td style={{ padding: '10px 10px', color: 'var(--muted)' }}>{s.company_name}</td>
                        <td style={{ padding: '10px 10px', color: 'var(--muted)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.lane_details}</td>
                        <td style={{ padding: '10px 10px', color: 'var(--green)', fontWeight: 600 }}>${Number(s.amount || 0).toLocaleString()}</td>
                        <td style={{ padding: '10px 10px' }}>
                          <span style={{ fontSize: 11, fontWeight: 500, padding: '3px 10px', borderRadius: 20, background: (STATUS_COLORS[s.status] || '#888') + '22', color: STATUS_COLORS[s.status] || 'var(--muted)' }}>{s.status}</span>
                        </td>
                        <td style={{ padding: '10px 10px', color: 'var(--muted)' }}>{s.closed_by}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {/* Pagination */}
              {totalPages > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '16px 0' }}>
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ padding: '5px 12px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--muted)', cursor: 'pointer', fontSize: 12 }}>← Prev</button>
                  <span style={{ color: 'var(--muted)', fontSize: 12 }}>Page {page} of {totalPages}</span>
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={{ padding: '5px 12px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--muted)', cursor: 'pointer', fontSize: 12 }}>Next →</button>
                </div>
              )}
            </>
          )}

          {/* AGENTS TYPE */}
          {type === 'agents' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12, marginTop: 16 }}>
              {agents.map(a => (
                <div key={a.agent_name} style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 10, padding: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--accent2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 600, color: '#fff' }}>
                      {a.agent_name?.[0]?.toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{a.agent_name}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>{a.sales_count} deals</div>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div style={{ background: 'var(--bg2)', borderRadius: 6, padding: '8px 10px' }}>
                      <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase' }}>Revenue</div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--green)' }}>${Number(a.revenue || 0).toLocaleString()}</div>
                    </div>
                    <div style={{ background: 'var(--bg2)', borderRadius: 6, padding: '8px 10px' }}>
                      <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase' }}>Active</div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#34d399' }}>{a.active || 0}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* COMPANIES TYPE */}
          {type === 'companies' && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginTop: 16 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['#', 'Company', 'Total Deals', 'Active', 'Cancelled', 'Revenue'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, fontWeight: 500, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.3px' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {companies.map((c, i) => (
                  <tr key={c.company_name} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 12px', color: 'var(--muted)', fontWeight: 600 }}>#{i + 1}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--text)', fontWeight: 500 }}>{c.company_name}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--text)' }}>{c.sales_count}</td>
                    <td style={{ padding: '10px 12px', color: '#34d399' }}>{c.active || 0}</td>
                    <td style={{ padding: '10px 12px', color: '#f87171' }}>{c.cancelled || 0}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--accent)', fontWeight: 600 }}>${Number(c.revenue || 0).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Dashboard ───────────────────────────────────────────────────────
export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState({ from: '', to: '' });
  const [activePreset, setActivePreset] = useState(null);
  const [drillDown, setDrillDown] = useState(null); // { title, type, sales?, agents?, companies? }
  const [drillDownSales, setDrillDownSales] = useState([]);
  const [drillDownLoading, setDrillDownLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (range.from) params.from = range.from;
      if (range.to) params.to = range.to;
      const res = await axios.get('/api/analytics/dashboard', { params });
      setData(res.data);
    } catch { /* ignore */ }
    setLoading(false);
  }, [range]);

  useEffect(() => { load(); }, [load]);

  const applyPreset = (preset) => {
    setActivePreset(preset.label);
    setRange(preset.getRange());
  };

  const clearDates = () => {
    setActivePreset(null);
    setRange({ from: '', to: '' });
  };

  // Fetch filtered sales for drill-down
  const openDrillDown = async (title, type, filterParams = {}) => {
    setDrillDown({ title, type });
    if (type === 'sales') {
      setDrillDownLoading(true);
      try {
        const params = { limit: 1000, ...filterParams };
        if (range.from) params.from = range.from;
        if (range.to) params.to = range.to;
        const res = await axios.get('/api/sales', { params });
        setDrillDownSales(res.data.sales);
      } catch { setDrillDownSales([]); }
      setDrillDownLoading(false);
    } else if (type === 'agents') {
      // agents and companies are already in data
    } else if (type === 'companies') {
      // companies already in data
    }
  };

  if (loading) return <div style={{ padding: 40, color: 'var(--muted)', textAlign: 'center' }}>Loading dashboard...</div>;
  if (!data) return <div style={{ padding: 40, color: 'var(--red)' }}>Failed to load data.</div>;

  const { totals, monthly, agents, companies, statusBreakdown, recent, agentCount, companyCount } = data;
  const fmt = v => '$' + Number(v || 0).toLocaleString();

  const pieData = statusBreakdown.map(s => ({ name: s.status, value: s.count }));

  return (
    <div style={{ padding: 28, maxWidth: 1200 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text)', margin: 0 }}>Sales Dashboard</h1>
          <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>Duo Enterprizes LLC — Freight Sales Overview</p>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Date Presets */}
          {DATE_PRESETS.map(preset => (
            <button
              key={preset.label}
              onClick={() => applyPreset(preset)}
              style={{
                padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 500,
                cursor: 'pointer', transition: 'all 0.15s',
                background: activePreset === preset.label ? 'var(--accent)' : 'transparent',
                border: activePreset === preset.label ? '1px solid var(--accent)' : '1px solid var(--border2)',
                color: activePreset === preset.label ? '#fff' : 'var(--muted)',
              }}
            >
              {preset.label}
            </button>
          ))}
          <span style={{ color: 'var(--border)', fontSize: 12 }}>|</span>
          <input type="date" value={range.from} onChange={e => { setRange(r => ({ ...r, from: e.target.value })); setActivePreset(null); }}
            style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 8, padding: '6px 10px', color: 'var(--text)', fontSize: 12 }} />
          <span style={{ color: 'var(--muted)', fontSize: 12 }}>to</span>
          <input type="date" value={range.to} onChange={e => { setRange(r => ({ ...r, to: e.target.value })); setActivePreset(null); }}
            style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 8, padding: '6px 10px', color: 'var(--text)', fontSize: 12 }} />
          <button onClick={clearDates} style={{ padding: '6px 12px', background: 'transparent', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--muted)', fontSize: 12, cursor: 'pointer' }}>Clear</button>
        </div>
      </div>

      {/* KPI Cards — Row 1: Core metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 14 }}>
        <KpiCard label="Total Sales" value={totals.total_sales} sub={fmt(totals.total_revenue) + ' revenue'} color="var(--text)" icon="📊"
          onClick={() => openDrillDown('All Sales', 'sales')} />
        <KpiCard label="Total Revenue" value={fmt(totals.total_revenue)} sub={`${totals.total_sales} total sales`} color="var(--accent)" icon="💰"
          onClick={() => openDrillDown('All Revenue Details', 'sales')} />
        <KpiCard label="Total Agents" value={agentCount || 0} sub="Registered agents" color="var(--accent2)" icon="👥"
          onClick={() => setDrillDown({ title: 'All Agents', type: 'agents' })} />
      </div>

      {/* KPI Cards — Row 2: Status breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 14, marginBottom: 20 }}>
        <KpiCard label="Active Sales" value={totals.active} sub="Currently active" color="var(--green)" icon="✓"
          onClick={() => openDrillDown('Active Sales', 'sales', { status: 'Active' })} />
        <KpiCard label="Pending Sales" value={totals.pending} sub="Awaiting confirmation" color="var(--yellow)" icon="⏳"
          onClick={() => openDrillDown('Pending Sales', 'sales', { status: 'Pending' })} />
        <KpiCard label="Cancelled" value={totals.cancelled} sub="Cancelled deals" color="var(--red)" icon="✕"
          onClick={() => openDrillDown('Cancelled Sales', 'sales', { status: 'Cancelled' })} />
        <KpiCard label="Chargebacks" value={totals.chargebacks} sub={fmt(totals.chargeback_amount) + ' lost'} color="var(--purple)" icon="↩"
          onClick={() => openDrillDown('Chargeback Sales', 'sales', { status: 'Chargeback' })} />
        <KpiCard label="Companies" value={companyCount || 0} sub="Unique companies" color="#4f8ef7" icon="🏢"
          onClick={() => setDrillDown({ title: 'All Companies', type: 'companies' })} />
      </div>

      {/* Status pills (clickable) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 24 }}>
        <StatusPill status="Active" count={totals.active} bg="#34d39922" col="#34d399"
          onClick={() => openDrillDown('Active Sales', 'sales', { status: 'Active' })} />
        <StatusPill status="Pending" count={totals.pending} bg="#fbbf2422" col="#fbbf24"
          onClick={() => openDrillDown('Pending Sales', 'sales', { status: 'Pending' })} />
        <StatusPill status="Cancelled" count={totals.cancelled} bg="#f8717122" col="#f87171"
          onClick={() => openDrillDown('Cancelled Sales', 'sales', { status: 'Cancelled' })} />
        <StatusPill status="Chargeback" count={totals.chargebacks} bg="#a78bfa22" col="#a78bfa"
          onClick={() => openDrillDown('Chargeback Sales', 'sales', { status: 'Chargeback' })} />
      </div>

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 16, marginBottom: 20 }}>
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>Monthly Revenue</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16 }}>Last 6 months</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#7a7f96' }} />
              <YAxis tick={{ fontSize: 11, fill: '#7a7f96' }} tickFormatter={v => '$' + (v/1000).toFixed(0) + 'k'} />
              <Tooltip formatter={v => ['$' + Number(v).toLocaleString(), 'Revenue']} contentStyle={{ background: '#1a1d28', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="revenue" fill="#4f8ef7" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>Deal Breakdown</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>By status</div>
          {pieData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={65} dataKey="value">
                    {pieData.map((entry, i) => <Cell key={i} fill={STATUS_COLORS[entry.name] || '#4f8ef7'} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#1a1d28', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                {pieData.map(d => (
                  <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: STATUS_COLORS[d.name] || '#4f8ef7' }} />
                    <span style={{ color: 'var(--muted)' }}>{d.name}</span>
                    <span style={{ color: 'var(--text)', fontWeight: 500 }}>{d.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : <div style={{ color: 'var(--muted)', fontSize: 13, textAlign: 'center', paddingTop: 40 }}>No data yet</div>}
        </div>
      </div>

      {/* Agents + Companies */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Top Agents</div>
            <button onClick={() => setDrillDown({ title: 'All Agents', type: 'agents' })} style={{ padding: '4px 10px', background: 'transparent', border: '1px solid var(--border2)', borderRadius: 6, color: 'var(--muted)', fontSize: 11, cursor: 'pointer' }}>View All →</button>
          </div>
          {agents.length === 0 ? <p style={{ color: 'var(--muted)', fontSize: 13 }}>No data yet</p> : agents.map((a, i) => (
            <div key={a.agent_name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: i < agents.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ fontSize: 11, color: 'var(--muted)', width: 16, textAlign: 'center', fontWeight: 600 }}>#{i + 1}</div>
              <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--accent2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: '#fff', flexShrink: 0 }}>
                {a.agent_name?.[0]?.toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{a.agent_name}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>{a.sales_count} deals</div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--green)' }}>{fmt(a.revenue)}</div>
            </div>
          ))}
        </div>

        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Top Companies</div>
            <button onClick={() => setDrillDown({ title: 'All Companies', type: 'companies' })} style={{ padding: '4px 10px', background: 'transparent', border: '1px solid var(--border2)', borderRadius: 6, color: 'var(--muted)', fontSize: 11, cursor: 'pointer' }}>View All →</button>
          </div>
          {companies.length === 0 ? <p style={{ color: 'var(--muted)', fontSize: 13 }}>No data yet</p> : companies.map((c, i) => (
            <div key={c.company_name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: i < companies.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ fontSize: 11, color: 'var(--muted)', width: 16, fontWeight: 600 }}>#{i + 1}</div>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(79,142,247,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: 'var(--accent)', flexShrink: 0 }}>
                {c.company_name?.[0]?.toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{c.company_name}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>{c.sales_count} deals · {c.active} active</div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>{fmt(c.revenue)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent sales */}
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Recent Sales</div>
          <button onClick={() => openDrillDown('All Sales', 'sales')} style={{ padding: '4px 10px', background: 'transparent', border: '1px solid var(--border2)', borderRadius: 6, color: 'var(--muted)', fontSize: 11, cursor: 'pointer' }}>View All →</button>
        </div>
        {recent.length === 0 ? <p style={{ color: 'var(--muted)', fontSize: 13 }}>No sales yet. Add your first sale!</p> : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Date', 'Agent', 'Carrier', 'Company', 'Amount', 'Status'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '6px 10px', fontSize: 11, fontWeight: 500, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.3px' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recent.map(s => (
                <tr key={s.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 10px', color: 'var(--muted)', fontSize: 12 }}>{s.date}</td>
                  <td style={{ padding: '10px 10px', color: 'var(--text)' }}>{s.agent_name}</td>
                  <td style={{ padding: '10px 10px', color: 'var(--text)' }}>{s.carrier_name}</td>
                  <td style={{ padding: '10px 10px', color: 'var(--text)' }}>{s.company_name}</td>
                  <td style={{ padding: '10px 10px', color: 'var(--green)', fontWeight: 600 }}>${Number(s.amount || 0).toLocaleString()}</td>
                  <td style={{ padding: '10px 10px' }}>
                    <span style={{ fontSize: 11, fontWeight: 500, padding: '3px 10px', borderRadius: 20, background: s.status === 'Active' ? '#34d39922' : s.status === 'Pending' ? '#fbbf2422' : s.status === 'Cancelled' ? '#f8717122' : '#a78bfa22', color: STATUS_COLORS[s.status] || 'var(--muted)' }}>
                      {s.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Drill-Down Modal */}
      {drillDown && (
        <DrillDownModal
          title={drillDown.title}
          type={drillDown.type}
          sales={drillDownSales}
          agents={agents}
          companies={companies}
          onClose={() => { setDrillDown(null); setDrillDownSales([]); }}
          onNavigate={() => {}}
        />
      )}

      {/* Loading overlay for drill-down */}
      {drillDown && drillDownLoading && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.3)' }}>
          <div style={{ background: 'var(--bg2)', padding: '16px 24px', borderRadius: 8, color: 'var(--muted)', fontSize: 13 }}>Loading details...</div>
        </div>
      )}
    </div>
  );
}
