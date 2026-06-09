import React, { useEffect, useState, useCallback, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const STATUS_COLORS = { Active: '#34d399', Pending: '#fbbf24', Cancelled: '#f87171', Chargeback: '#a78bfa' };

// ── Column Definitions (all 16 fields + actions) ─────────────────────────
const ALL_COLUMNS = [
  { key: 'date',            label: 'Date',        type: 'date',   width: 110, visible: true },
  { key: 'agent_name',      label: 'Agent',       type: 'text',   width: 110, visible: true },
  { key: 'carrier_name',    label: 'Carrier',     type: 'text',   width: 140, visible: true },
  { key: 'company_name',    label: 'Company',     type: 'text',   width: 140, visible: true },
  { key: 'email',           label: 'Email',       type: 'email',  width: 160, visible: false },
  { key: 'phone_number',    label: 'Phone',       type: 'text',   width: 120, visible: false },
  { key: 'lane_details',    label: 'Lane',        type: 'text',   width: 150, visible: true },
  { key: 'lane_start_date', label: 'Lane Start',  type: 'date',   width: 110, visible: false },
  { key: 'truck',           label: 'Truck',       type: 'text',   width: 110, visible: false },
  { key: 'amount',          label: 'Amount',      type: 'number', width: 100, visible: true },
  { key: 'purpose',         label: 'Purpose',     type: 'text',   width: 110, visible: false },
  { key: 'address',         label: 'Address',     type: 'text',   width: 160, visible: false },
  { key: 'acc_type',        label: 'Acc Type',    type: 'text',   width: 90,  visible: false },
  { key: 'status',          label: 'Status',      type: 'select', width: 100, visible: true },
  { key: 'closed_by',       label: 'Closed By',   type: 'text',   width: 110, visible: true },
  { key: 'notes',           label: 'Notes',       type: 'text',   width: 160, visible: false },
];

// ── Edit Modal ───────────────────────────────────────────────────────────
function EditModal({ sale, onSave, onCancel }) {
  const [form, setForm] = useState({ ...sale });
  const INPUT = { width: '100%', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, padding: '8px 12px', color: 'var(--text)', fontSize: 12, outline: 'none', boxSizing: 'border-box' };
  const LABEL = { display: 'block', fontSize: 10, color: 'var(--muted)', fontWeight: 500, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.3px' };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const fields = [
    { section: 'Basic Info', items: [
      { key: 'date', label: 'Date', type: 'date' },
      { key: 'agent_name', label: 'Agent Name', type: 'text' },
      { key: 'status', label: 'Status', type: 'select', options: ['Active','Pending','Cancelled','Chargeback'] },
      { key: 'closed_by', label: 'Closed By', type: 'text' },
    ]},
    { section: 'Carrier & Client', items: [
      { key: 'carrier_name', label: 'Carrier Name', type: 'text' },
      { key: 'company_name', label: 'Company Name', type: 'text' },
      { key: 'email', label: 'Email', type: 'email' },
      { key: 'phone_number', label: 'Phone', type: 'text' },
      { key: 'address', label: 'Address', type: 'text' },
      { key: 'acc_type', label: 'Account Type', type: 'text' },
    ]},
    { section: 'Lane & Deal', items: [
      { key: 'lane_details', label: 'Lane Details', type: 'text' },
      { key: 'lane_start_date', label: 'Lane Start Date', type: 'date' },
      { key: 'truck', label: 'Truck', type: 'text' },
      { key: 'amount', label: 'Amount ($)', type: 'number' },
      { key: 'purpose', label: 'Purpose', type: 'text' },
    ]},
    { section: 'Notes', items: [
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ]},
  ];

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={onCancel} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} />
      <div style={{
        position: 'relative', width: '90%', maxWidth: 800, maxHeight: '85vh',
        background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 14,
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
      }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', margin: 0 }}>Edit Sale #{sale.id}</h2>
          <button onClick={onCancel} style={{ padding: '4px 12px', background: 'transparent', border: '1px solid var(--border2)', borderRadius: 6, color: 'var(--muted)', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>
          {fields.map(section => (
            <div key={section.section} style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>{section.section}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                {section.items.map(item => (
                  <div key={item.key} style={item.type === 'textarea' ? { gridColumn: '1 / -1' } : {}}>
                    <label style={LABEL}>{item.label}</label>
                    {item.type === 'select' ? (
                      <select value={form[item.key] || ''} onChange={e => set(item.key, e.target.value)} style={INPUT}>
                        {item.options.map(o => <option key={o}>{o}</option>)}
                      </select>
                    ) : item.type === 'textarea' ? (
                      <textarea value={form[item.key] || ''} onChange={e => set(item.key, e.target.value)} rows={3} style={{ ...INPUT, resize: 'vertical', lineHeight: 1.5 }} />
                    ) : (
                      <input type={item.type} value={form[item.key] || ''} onChange={e => set(item.key, e.target.value)} style={INPUT} step={item.type === 'number' ? '0.01' : undefined} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, justifyContent: 'flex-end', flexShrink: 0 }}>
          <button onClick={onCancel} style={{ padding: '8px 20px', background: 'transparent', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--muted)', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
          <button onClick={() => onSave(form)} style={{ padding: '8px 24px', background: 'linear-gradient(135deg,#34d399,#2db583)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Save Changes</button>
        </div>
      </div>
    </div>
  );
}

// ── Column Visibility Dropdown ───────────────────────────────────────────
function ColumnPicker({ columns, visibleColumns, onToggle }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div style={{ position: 'relative' }} ref={ref}>
      <button onClick={() => setOpen(!open)} style={{ padding: '7px 14px', background: 'transparent', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--muted)', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
        <span>☰</span> Columns
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, marginTop: 4, zIndex: 100,
          background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10,
          padding: 12, minWidth: 200, maxHeight: 400, overflow: 'auto',
          boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Toggle Columns</div>
          {columns.map(col => (
            <label key={col.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 4px', cursor: 'pointer', borderRadius: 4, transition: 'background 0.1s' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg3)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <input type="checkbox" checked={visibleColumns.includes(col.key)} onChange={() => onToggle(col.key)}
                style={{ accentColor: 'var(--accent)', cursor: 'pointer' }} />
              <span style={{ fontSize: 12, color: 'var(--text)', fontWeight: visibleColumns.includes(col.key) ? 500 : 400 }}>{col.label}</span>
            </label>
          ))}
          <div style={{ borderTop: '1px solid var(--border)', marginTop: 8, paddingTop: 8, display: 'flex', gap: 6 }}>
            <button onClick={() => onToggle('all')} style={{ flex: 1, padding: '5px', background: 'transparent', border: '1px solid var(--border2)', borderRadius: 6, color: 'var(--muted)', fontSize: 10, cursor: 'pointer' }}>Show All</button>
            <button onClick={() => onToggle('defaults')} style={{ flex: 1, padding: '5px', background: 'transparent', border: '1px solid var(--border2)', borderRadius: 6, color: 'var(--muted)', fontSize: 10, cursor: 'pointer' }}>Defaults</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Sales Component ─────────────────────────────────────────────────
export default function Sales() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sales, setSales] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [editSale, setEditSale] = useState(null);
  const [filters, setFilters] = useState({ search: '', status: '', from: '', to: '' });
  const [groupByCycle, setGroupByCycle] = useState(true);
  const [visibleColumns, setVisibleColumns] = useState(
    ALL_COLUMNS.filter(c => c.visible).map(c => c.key)
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/sales', { params: { ...filters, page, limit: 25 } });
      setSales(res.data.sales);
      setTotal(res.data.total);
      setPages(res.data.pages);
    } catch {}
    setLoading(false);
  }, [filters, page]);

  useEffect(() => { load(); }, [load]);

  const deleteSale = async (id) => {
    if (!window.confirm('Delete this sale?')) return;
    await axios.delete(`/api/sales/${id}`);
    load();
  };

  const saveEdit = async (form) => {
    await axios.put(`/api/sales/${editSale.id}`, form);
    setEditSale(null);
    load();
  };

  const changeStatus = async (id, status) => {
    if (!window.confirm(`Change status to ${status}?`)) return;
    try {
      await axios.patch(`/api/sales/${id}/status`, { status });
      load();
    } catch {}
  };

  const setF = (k, v) => { setFilters(f => ({ ...f, [k]: v })); setPage(1); };

  // Export ALL filtered records (not just current page)
  const exportCSV = async () => {
    try {
      const res = await axios.get('/api/sales', { params: { ...filters, limit: 99999 } });
      const allSales = res.data.sales;
      const headers = ['ID','Date','Agent','Carrier','Company','Email','Phone','Lane','Lane Start','Truck','Amount','Purpose','Address','Acc Type','Status','Closed By','Notes','Cycle Period Start','Cycle Period End'];
      const rows = allSales.map(s =>
        [s.id, s.date, s.agent_name, s.carrier_name, s.company_name, s.email, s.phone_number, s.lane_details, s.lane_start_date, s.truck, s.amount, s.purpose, s.address, s.acc_type, s.status, s.closed_by, s.notes, s.cycle_period_start || '', s.cycle_period_end || '']
          .map(v => `"${(v || '').toString().replace(/"/g, '""')}"`)
          .join(',')
      );
      const csv = [headers.join(','), ...rows].join('\n');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
      a.download = `duo_sales_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
    } catch {}
  };

  const toggleColumn = (key) => {
    if (key === 'all') {
      setVisibleColumns(ALL_COLUMNS.map(c => c.key));
    } else if (key === 'defaults') {
      setVisibleColumns(ALL_COLUMNS.filter(c => c.visible).map(c => c.key));
    } else {
      setVisibleColumns(prev =>
        prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
      );
    }
  };

  const visibleCols = ALL_COLUMNS.filter(c => visibleColumns.includes(c.key));

  // Render a cell value
  const renderCell = (s, col) => {
    const val = s[col.key];
    if (col.key === 'amount') return <span style={{ color: 'var(--green)', fontWeight: 600 }}>${Number(val || 0).toLocaleString()}</span>;
    if (col.key === 'status') return (
      <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, fontWeight: 500, background: (STATUS_COLORS[val] || '#888') + '22', color: STATUS_COLORS[val] || 'var(--muted)' }}>{val}</span>
    );
    if (col.key === 'notes') return <span style={{ maxWidth: 160, display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{val || '—'}</span>;
    if (col.key === 'lane_details') return <span style={{ maxWidth: 150, display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{val}</span>;
    if (['email', 'address'].includes(col.key)) return <span style={{ maxWidth: 160, display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{val || '—'}</span>;
    return <span>{val || '—'}</span>;
  };

  // Group sales by cycle period
  const groupedSales = {};
  sales.forEach(s => {
    const cycleKey = s.cycle_period_start && s.cycle_period_end
      ? `${s.cycle_period_start}_${s.cycle_period_end}`
      : 'unknown';
    if (!groupedSales[cycleKey]) {
      groupedSales[cycleKey] = {
        periodStart: s.cycle_period_start,
        periodEnd: s.cycle_period_end,
        cycleFormat: s.cycle_format || '',
        cycleStartDay: s.cycle_start_day,
        agentNames: new Set(),
        sales: []
      };
    }
    groupedSales[cycleKey].sales.push(s);
    if (s.agent_name) groupedSales[cycleKey].agentNames.add(s.agent_name);
  });

  // Sort groups by period start date descending
  const sortedGroups = Object.values(groupedSales).sort((a, b) => {
    return (b.periodStart || '').localeCompare(a.periodStart || '');
  });

  // Build cycle label with agent names and format
  const getCycleLabel = (group) => {
    const agentList = [...group.agentNames];
    const format = group.cycleFormat || '?';
    if (agentList.length === 0) return `Cycle (${format})`;
    // Group agents by their cycle format
    const formatGroups = {};
    group.sales.forEach(s => {
      const fmt = s.cycle_format || format;
      if (!formatGroups[fmt]) formatGroups[fmt] = new Set();
      formatGroups[fmt].add(s.agent_name);
    });
    const parts = Object.entries(formatGroups).map(([fmt, names]) => {
      const nameList = [...names].join(', ');
      return fmt === '1-End' ? `${nameList} (1-End)` : `${nameList} (${fmt})`;
    });
    return parts.join(' · ');
  };

  const formatDate = (d) => {
    if (!d) return '';
    const date = new Date(d + 'T00:00:00');
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const INPUT_S = { background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, padding: '7px 12px', color: 'var(--text)', fontSize: 12, outline: 'none' };

  return (
    <div style={{ padding: 28 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text)', margin: 0 }}>All Sales</h1>
          <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>{total} total records · Showing {visibleCols.length} of {ALL_COLUMNS.length} columns</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={() => setGroupByCycle(!groupByCycle)}
            style={{
              padding: '7px 14px', background: groupByCycle ? 'var(--accent)' : 'transparent',
              border: groupByCycle ? '1px solid var(--accent)' : '1px solid var(--border2)',
              borderRadius: 8, color: groupByCycle ? '#fff' : 'var(--muted)', fontSize: 12, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6
            }}>
            <span>📅</span> {groupByCycle ? 'Grouped by Cycle' : 'Group by Cycle'}
          </button>
          <ColumnPicker columns={ALL_COLUMNS} visibleColumns={visibleColumns} onToggle={toggleColumn} />
          <button onClick={exportCSV} style={{ padding: '8px 16px', background: 'transparent', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--muted)', fontSize: 12, cursor: 'pointer' }}>Export CSV</button>
          <button onClick={() => navigate('/new-sale')} style={{ padding: '8px 16px', background: 'linear-gradient(135deg,#4f8ef7,#6c63ff)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>+ New Sale</button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input placeholder="Search carrier, company, agent, lane..." value={filters.search} onChange={e => setF('search', e.target.value)} style={{ ...INPUT_S, width: 280 }} />
        <select value={filters.status} onChange={e => setF('status', e.target.value)} style={INPUT_S}>
          <option value="">All Statuses</option>
          <option>Active</option><option>Pending</option><option>Cancelled</option><option>Chargeback</option>
        </select>
        <input type="date" value={filters.from} onChange={e => setF('from', e.target.value)} style={INPUT_S} title="From date" />
        <span style={{ color: 'var(--muted)', fontSize: 12 }}>to</span>
        <input type="date" value={filters.to} onChange={e => setF('to', e.target.value)} style={INPUT_S} title="To date" />
        <button onClick={() => { setFilters({ search: '', status: '', from: '', to: '' }); setPage(1); }} style={{ ...INPUT_S, cursor: 'pointer', background: 'transparent' }}>Clear</button>
      </div>

      {/* Table — Grouped by Cycle or Flat */}
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>Loading...</div>
          ) : sales.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>No sales found</div>
          ) : groupByCycle ? (
            /* ── Grouped View ── */
            sortedGroups.map((group, gi) => (
              <div key={`${group.periodStart}_${group.periodEnd}`}>
                {/* Cycle Period Header */}
                <div style={{
                  background: 'rgba(79,142,247,0.08)', borderBottom: '1px solid rgba(79,142,247,0.2)',
                  padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  position: 'sticky', top: 0, zIndex: 2,
                }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>
                    📅 {formatDate(group.periodStart)} — {formatDate(group.periodEnd)}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                    {getCycleLabel(group)} · {group.sales.length} sales · Net: ${group.sales.reduce((sum, s) => {
                      if (s.status === 'Cancelled' || s.status === 'Chargeback') return sum;
                      return sum + (Number(s.amount) || 0);
                    }, 0).toLocaleString()}
                  </span>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  {gi === 0 && (
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        {visibleCols.map(col => (
                          <th key={col.key} style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, fontWeight: 500, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.3px', whiteSpace: 'nowrap', minWidth: col.width }}>
                            {col.label}
                          </th>
                        ))}
                        <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, fontWeight: 500, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.3px', whiteSpace: 'nowrap', position: 'sticky', right: 0, background: 'var(--bg2)', zIndex: 1 }}>Actions</th>
                      </tr>
                    </thead>
                  )}
                  <tbody>
                    {group.sales.map(s => (
                      <tr key={s.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.1s' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        {visibleCols.map(col => (
                          <td key={col.key} style={{ padding: '10px 12px', color: col.key === 'date' ? 'var(--muted)' : 'var(--text)', fontSize: col.key === 'date' ? 12 : undefined }}>
                            {renderCell(s, col)}
                          </td>
                        ))}
                        <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', position: 'sticky', right: 0, background: 'var(--bg2)', zIndex: 1, borderBottom: '1px solid var(--border)' }}>
                          {(user?.role === 'admin' || user?.role === 'manager') && (
                            <>
                              {['Active', 'Pending', 'Cancelled', 'Chargeback'].map(st => (
                                s.status !== st && (
                                  <button key={st} onClick={() => changeStatus(s.id, st)} title={`Set ${st}`}
                                    style={{
                                      padding: '3px 6px', marginRight: 2, borderRadius: 4, fontSize: 9, cursor: 'pointer', fontWeight: 600,
                                      background: (STATUS_COLORS[st] || '#888') + '22', border: `1px solid ${STATUS_COLORS[st] || '#888'}40`,
                                      color: STATUS_COLORS[st] || 'var(--muted)',
                                    }}>
                                    {st === 'Active' ? '✓' : st === 'Pending' ? '⏳' : st === 'Cancelled' ? '✕' : '↩'}
                                  </button>
                                )
                              ))}
                              <button onClick={() => setEditSale({ ...s })} style={{ padding: '3px 8px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--muted)', fontSize: 10, cursor: 'pointer', marginLeft: 4 }}>Edit</button>
                            </>
                          )}
                          {user?.role === 'admin' && (
                            <button onClick={() => deleteSale(s.id)} style={{ padding: '3px 8px', background: 'transparent', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 4, color: 'var(--red)', fontSize: 10, cursor: 'pointer', marginLeft: 2 }}>Del</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))
          ) : (
            /* ── Flat View (no grouping) ── */
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {visibleCols.map(col => (
                    <th key={col.key} style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, fontWeight: 500, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.3px', whiteSpace: 'nowrap', minWidth: col.width }}>
                      {col.label}
                    </th>
                  ))}
                  <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, fontWeight: 500, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.3px', whiteSpace: 'nowrap', position: 'sticky', right: 0, background: 'var(--bg2)', zIndex: 1 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sales.map(s => (
                  <tr key={s.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.1s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    {visibleCols.map(col => (
                      <td key={col.key} style={{ padding: '10px 12px', color: col.key === 'date' ? 'var(--muted)' : 'var(--text)', fontSize: col.key === 'date' ? 12 : undefined }}>
                        {renderCell(s, col)}
                      </td>
                    ))}
                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', position: 'sticky', right: 0, background: 'var(--bg2)', zIndex: 1, borderBottom: '1px solid var(--border)' }}>
                      {(user?.role === 'admin' || user?.role === 'manager') && (
                        <>
                          {['Active', 'Pending', 'Cancelled', 'Chargeback'].map(st => (
                            s.status !== st && (
                              <button key={st} onClick={() => changeStatus(s.id, st)} title={`Set ${st}`}
                                style={{
                                  padding: '3px 6px', marginRight: 2, borderRadius: 4, fontSize: 9, cursor: 'pointer', fontWeight: 600,
                                  background: (STATUS_COLORS[st] || '#888') + '22', border: `1px solid ${STATUS_COLORS[st] || '#888'}40`,
                                  color: STATUS_COLORS[st] || 'var(--muted)',
                                }}>
                                {st === 'Active' ? '✓' : st === 'Pending' ? '⏳' : st === 'Cancelled' ? '✕' : '↩'}
                              </button>
                            )
                          ))}
                          <button onClick={() => setEditSale({ ...s })} style={{ padding: '3px 8px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--muted)', fontSize: 10, cursor: 'pointer', marginLeft: 4 }}>Edit</button>
                        </>
                      )}
                      {user?.role === 'admin' && (
                        <button onClick={() => deleteSale(s.id)} style={{ padding: '3px 8px', background: 'transparent', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 4, color: 'var(--red)', fontSize: 10, cursor: 'pointer', marginLeft: 2 }}>Del</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {pages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16, borderTop: '1px solid var(--border)' }}>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ padding: '5px 12px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--muted)', cursor: 'pointer', fontSize: 12 }}>← Prev</button>
            <span style={{ color: 'var(--muted)', fontSize: 12 }}>Page {page} of {pages}</span>
            <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages} style={{ padding: '5px 12px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--muted)', cursor: 'pointer', fontSize: 12 }}>Next →</button>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editSale && (
        <EditModal sale={editSale} onSave={saveEdit} onCancel={() => setEditSale(null)} />
      )}
    </div>
  );
}
