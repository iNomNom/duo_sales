import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useAuth } from '../context/AuthContext';

const STATUS_COLORS = { Active: '#34d399', Pending: '#fbbf24', Cancelled: '#f87171', Chargeback: '#a78bfa' };

// ── Sales Cycle Edit Modal ──────────────────────────────────────────────
function SalesCycleModal({ agent, onClose, onSave }) {
  const [cycleStart, setCycleStart] = useState(agent.sales_cycle_start || 7);
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const day = parseInt(cycleStart);
    if (isNaN(day) || day < 1 || day > 28) {
      setMsg('Day must be between 1 and 28');
      return;
    }
    setSaving(true);
    try {
      await axios.put(`/api/auth/users/${agent.id}/sales-cycle`, { sales_cycle_start: day });
      setMsg('Sales cycle updated successfully!');
      setTimeout(() => { onSave(); onClose(); }, 1000);
    } catch (err) {
      setMsg(err.response?.data?.error || 'Error updating sales cycle');
    }
    setSaving(false);
  };

  const formatDate = (d) => {
    if (!d) return '';
    const date = new Date(d + 'T00:00:00');
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getPeriodLabel = (day) => {
    const endDay = day === 1 ? 'end of month' : `${day - 1}`;
    return `${day}th to ${endDay} of each month`;
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} />
      <div style={{
        position: 'relative', width: '90%', maxWidth: 450,
        background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 14,
        padding: 24, boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
      }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', margin: '0 0 6px 0' }}>Sales Cycle for {agent.name}</h3>
        <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 16px 0' }}>
          Current period: {agent.sales_period ? `${formatDate(agent.sales_period.periodStart)} — ${formatDate(agent.sales_period.periodEnd)}` : 'N/A'}
        </p>
        {msg && <div style={{ background: msg.includes('successfully') ? 'rgba(52,211,153,0.1)' : 'rgba(248,113,113,0.1)', border: `1px solid ${msg.includes('successfully') ? 'rgba(52,211,153,0.3)' : 'rgba(248,113,113,0.3)'}`, borderRadius: 8, padding: '10px 14px', color: msg.includes('successfully') ? 'var(--green)' : 'var(--red)', fontSize: 13, marginBottom: 16 }}>{msg}</div>}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 11, color: 'var(--muted)', marginBottom: 5 }}>
              Cycle Start Day (1-28)
            </label>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <input type="number" min="1" max="28" value={cycleStart} onChange={e => setCycleStart(e.target.value)}
                style={{ width: 80, background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, padding: '8px 12px', color: 'var(--text)', fontSize: 14, outline: 'none' }} />
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                Revenue cycle: {getPeriodLabel(parseInt(cycleStart) || 7)}
              </span>
            </div>
          </div>
          <div style={{ background: 'var(--bg3)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: 'var(--muted)' }}>
            Example: Day 7 means sales cycle runs from the 7th of each month to the 6th of the next month.
            Day 1 means calendar month (1st to end of month).
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={onClose} style={{ flex: 1, padding: '8px 16px', background: 'transparent', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--muted)', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
            <button type="submit" disabled={saving} style={{ flex: 1, padding: '8px 16px', background: 'linear-gradient(135deg,#4f8ef7,#6c63ff)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>Save</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Agent Detail Modal ───────────────────────────────────────────────────
function AgentDetailModal({ agent, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('monthly');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const loadAgentData = async (filter, from, to) => {
    setLoading(true);
    try {
      const params = { filter };
      if (filter === 'custom' && from && to) {
        params.from = from;
        params.to = to;
      }
      const res = await axios.get(`/api/analytics/agent/${encodeURIComponent(agent.name)}`, { params });
      setData(res.data);
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    loadAgentData('monthly');
  }, [agent.name]);

  const applyFilter = (filter) => {
    setActiveFilter(filter);
    if (filter !== 'custom') {
      loadAgentData(filter);
    }
  };

  const applyCustomDate = () => {
    if (customFrom && customTo) {
      loadAgentData('custom', customFrom, customTo);
    }
  };

  const fmt = v => '$' + Number(v || 0).toLocaleString();

  const formatDate = (d) => {
    if (!d) return '';
    const date = new Date(d + 'T00:00:00');
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const periodLabel = data?.periodUsed?.from
    ? `${formatDate(data.periodUsed.from)} — ${formatDate(data.periodUsed.to)}`
    : 'All Time';

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} />
      <div style={{
        position: 'relative', width: '90%', maxWidth: 1000, maxHeight: '85vh',
        background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 14,
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
      }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--accent2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 600, color: '#fff' }}>
                {agent.name?.[0]?.toUpperCase()}
              </div>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)', margin: 0 }}>{agent.name}</h2>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                  {agent.email} · Cycle: {agent.sales_cycle_start || 7}-{agent.sales_cycle_start === 1 ? 'end' : (agent.sales_cycle_start - 1)} · {periodLabel}
                </div>
              </div>
            </div>
            <button onClick={onClose} style={{ padding: '6px 14px', background: 'transparent', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--muted)', fontSize: 12, cursor: 'pointer' }}>✕ Close</button>
          </div>

          {/* Filter bar */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            {[
              { label: 'Monthly (Sales Cycle)', value: 'monthly' },
              { label: 'All Time', value: 'all_time' },
              { label: 'Custom', value: 'custom' },
            ].map(f => (
              <button key={f.value} onClick={() => applyFilter(f.value)}
                style={{
                  padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 500,
                  cursor: 'pointer', transition: 'all 0.15s',
                  background: activeFilter === f.value ? 'var(--accent)' : 'transparent',
                  border: activeFilter === f.value ? '1px solid var(--accent)' : '1px solid var(--border2)',
                  color: activeFilter === f.value ? '#fff' : 'var(--muted)',
                }}
              >
                {f.label}
              </button>
            ))}
            {activeFilter === 'custom' && (
              <>
                <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                  style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 6, padding: '5px 8px', color: 'var(--text)', fontSize: 11 }} />
                <span style={{ color: 'var(--muted)', fontSize: 11 }}>to</span>
                <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                  style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 6, padding: '5px 8px', color: 'var(--text)', fontSize: 11 }} />
                <button onClick={applyCustomDate} style={{ padding: '5px 10px', background: 'var(--accent)', border: 'none', borderRadius: 6, color: '#fff', fontSize: 11, cursor: 'pointer' }}>Apply</button>
              </>
            )}
          </div>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>Loading agent details...</div>
          ) : !data ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--red)' }}>Failed to load data</div>
          ) : (
            <>
              {/* Stats row */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 20 }}>
                {[
                  { label: 'Total Sales', value: data.stats.total, color: 'var(--text)' },
                  { label: 'Net Revenue', value: fmt(data.stats.revenue), color: 'var(--green)' },
                  { label: 'Active', value: data.stats.active || 0, color: '#34d399' },
                  { label: 'Cancelled', value: data.stats.cancelled || 0, color: '#f87171' },
                  { label: 'Chargebacks', value: data.stats.chargebacks || 0, color: '#a78bfa' },
                ].map(s => (
                  <div key={s.label} style={{ background: 'var(--bg3)', borderRadius: 8, padding: '12px 14px' }}>
                    <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.3px' }}>{s.label}</div>
                    <div style={{ fontSize: 20, fontWeight: 600, color: s.color, marginTop: 4 }}>{s.value}</div>
                  </div>
                ))}
              </div>

              {/* Loss summary */}
              {(data.stats.cancelled_amount > 0 || data.stats.chargeback_amount > 0) && (
                <div style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 8, padding: '10px 14px', marginBottom: 20, display: 'flex', gap: 20 }}>
                  <span style={{ fontSize: 12, color: '#f87171' }}>Cancelled: {fmt(data.stats.cancelled_amount)}</span>
                  <span style={{ fontSize: 12, color: '#a78bfa' }}>Chargeback: {fmt(data.stats.chargeback_amount)}</span>
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>Total Loss: {fmt(Number(data.stats.cancelled_amount || 0) + Number(data.stats.chargeback_amount || 0))}</span>
                </div>
              )}

              {/* Monthly chart */}
              {data.monthly.length > 0 && (
                <div style={{ background: 'var(--bg3)', borderRadius: 10, padding: 16, marginBottom: 20 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>Monthly Revenue (Net)</div>
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={data.monthly}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                      <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#7a7f96' }} />
                      <YAxis tick={{ fontSize: 10, fill: '#7a7f96' }} tickFormatter={v => '$' + (v/1000).toFixed(0) + 'k'} />
                      <Tooltip formatter={v => ['$' + Number(v).toLocaleString(), 'Net Revenue']} contentStyle={{ background: '#1a1d28', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 11 }} />
                      <Bar dataKey="revenue" fill="#6c63ff" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Sales table */}
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>Sales ({data.sales.length})</div>
              {data.sales.length === 0 ? (
                <div style={{ padding: 20, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>No sales in this period</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      {['Date', 'Carrier', 'Company', 'Lane', 'Amount', 'Status', 'Closed By'].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '8px 10px', fontSize: 10, fontWeight: 500, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.3px' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.sales.map(s => (
                      <tr key={s.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '8px 10px', color: 'var(--muted)' }}>{s.date}</td>
                        <td style={{ padding: '8px 10px', color: 'var(--text)', fontWeight: 500 }}>{s.carrier_name}</td>
                        <td style={{ padding: '8px 10px', color: 'var(--muted)' }}>{s.company_name}</td>
                        <td style={{ padding: '8px 10px', color: 'var(--muted)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.lane_details}</td>
                        <td style={{ padding: '8px 10px', color: s.status === 'Cancelled' || s.status === 'Chargeback' ? 'var(--red)' : 'var(--green)', fontWeight: 600 }}>${Number(s.amount || 0).toLocaleString()}</td>
                        <td style={{ padding: '8px 10px' }}>
                          <span style={{ fontSize: 10, fontWeight: 500, padding: '2px 8px', borderRadius: 12, background: (STATUS_COLORS[s.status] || '#888') + '22', color: STATUS_COLORS[s.status] || 'var(--muted)' }}>{s.status}</span>
                        </td>
                        <td style={{ padding: '8px 10px', color: 'var(--muted)' }}>{s.closed_by}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Password Change Modal ─────────────────────────────────────────────────
function PasswordChangeModal({ user, onClose }) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [msg, setMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (newPassword.length < 6) { setMsg('Password must be at least 6 characters'); return; }
    if (newPassword !== confirmPassword) { setMsg('Passwords do not match'); return; }
    try {
      await axios.put(`/api/auth/users/${user.id}/password`, { newPassword });
      setMsg('Password updated successfully!');
      setTimeout(() => onClose(), 1500);
    } catch (err) {
      setMsg(err.response?.data?.error || 'Error updating password');
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} />
      <div style={{
        position: 'relative', width: '90%', maxWidth: 400,
        background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 14,
        padding: 24, boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
      }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', margin: '0 0 16px 0' }}>Change Password for {user.name}</h3>
        {msg && <div style={{ background: msg.includes('successfully') ? 'rgba(52,211,153,0.1)' : 'rgba(248,113,113,0.1)', border: `1px solid ${msg.includes('successfully') ? 'rgba(52,211,153,0.3)' : 'rgba(248,113,113,0.3)'}`, borderRadius: 8, padding: '10px 14px', color: msg.includes('successfully') ? 'var(--green)' : 'var(--red)', fontSize: 13, marginBottom: 16 }}>{msg}</div>}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 11, color: 'var(--muted)', marginBottom: 5 }}>New Password</label>
            <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required minLength={6} style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, padding: '8px 12px', color: 'var(--text)', fontSize: 13, outline: 'none' }} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 11, color: 'var(--muted)', marginBottom: 5 }}>Confirm New Password</label>
            <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required minLength={6} style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, padding: '8px 12px', color: 'var(--text)', fontSize: 13, outline: 'none' }} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={onClose} style={{ flex: 1, padding: '8px 16px', background: 'transparent', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--muted)', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
            <button type="submit" style={{ flex: 1, padding: '8px 16px', background: 'linear-gradient(135deg,#4f8ef7,#6c63ff)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Update Password</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Agents Page ─────────────────────────────────────────────────────
export default function Agents() {
  const { user } = useAuth();
  const [agents, setAgents] = useState([]);
  const [users, setUsers] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'agent' });
  const [msg, setMsg] = useState('');
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [passwordChangeUser, setPasswordChangeUser] = useState(null);
  const [salesCycleAgent, setSalesCycleAgent] = useState(null);
  const [activeFilter, setActiveFilter] = useState('monthly');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const load = async () => {
    try {
      const params = { filter: activeFilter };
      if (activeFilter === 'custom' && customFrom && customTo) {
        params.from = customFrom;
        params.to = customTo;
      }
      const [a, u] = await Promise.all([axios.get('/api/agents', { params }), axios.get('/api/auth/users')]);
      setAgents(a.data);
      setUsers(u.data);
    } catch {}
  };

  useEffect(() => { load(); }, [activeFilter]);

  const applyCustomDate = () => {
    if (customFrom && customTo) {
      load();
    }
  };

  const addUser = async (e) => {
    e.preventDefault();
    try {
      await axios.post('/api/auth/register', form);
      setMsg('User created successfully!');
      setShowAdd(false);
      setForm({ name: '', email: '', password: '', role: 'agent' });
      load();
    } catch (err) {
      setMsg(err.response?.data?.error || 'Error');
    }
  };

  const deleteUser = async (id) => {
    if (!window.confirm('Delete this user?')) return;
    await axios.delete(`/api/auth/users/${id}`);
    load();
  };

  const BADGE = { admin: '#f87171', manager: '#fbbf24', agent: '#34d399' };

  const formatDate = (d) => {
    if (!d) return '';
    const date = new Date(d + 'T00:00:00');
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const filterLabel = activeFilter === 'monthly'
    ? 'Sales Cycle'
    : activeFilter === 'custom' && customFrom && customTo
      ? `${formatDate(customFrom)} — ${formatDate(customTo)}`
      : 'All Time';

  return (
    <div style={{ padding: 28 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text)', margin: 0 }}>Agents & Users</h1>
          <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>
            Showing: {filterLabel} · Click agent card to view details
          </p>
        </div>
        <button onClick={() => setShowAdd(!showAdd)} style={{ padding: '8px 16px', background: 'linear-gradient(135deg,#4f8ef7,#6c63ff)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          + Add User
        </button>
      </div>

      {/* Filter Bar */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { label: 'Sales Cycle', value: 'monthly' },
          { label: 'All Time', value: 'all_time' },
          { label: 'Custom', value: 'custom' },
        ].map(f => (
          <button key={f.value} onClick={() => setActiveFilter(f.value)}
            style={{
              padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 500,
              cursor: 'pointer', transition: 'all 0.15s',
              background: activeFilter === f.value ? 'var(--accent)' : 'transparent',
              border: activeFilter === f.value ? '1px solid var(--accent)' : '1px solid var(--border2)',
              color: activeFilter === f.value ? '#fff' : 'var(--muted)',
            }}
          >
            {f.label}
          </button>
        ))}
        {activeFilter === 'custom' && (
          <>
            <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
              style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 8, padding: '6px 10px', color: 'var(--text)', fontSize: 12 }} />
            <span style={{ color: 'var(--muted)', fontSize: 12 }}>to</span>
            <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
              style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 8, padding: '6px 10px', color: 'var(--text)', fontSize: 12 }} />
            <button onClick={applyCustomDate} style={{ padding: '6px 12px', background: 'var(--accent)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 12, cursor: 'pointer' }}>Apply</button>
          </>
        )}
      </div>

      {msg && <div style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.3)', borderRadius: 8, padding: '10px 16px', color: 'var(--green)', fontSize: 13, marginBottom: 16 }}>{msg}</div>}

      {showAdd && (
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 24, marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 16 }}>Add New User</div>
          <form onSubmit={addUser}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr auto', gap: 12, alignItems: 'end' }}>
              {[['Full Name', 'name', 'text'], ['Email', 'email', 'email'], ['Password', 'password', 'password']].map(([l, k, t]) => (
                <div key={k}>
                  <label style={{ display: 'block', fontSize: 11, color: 'var(--muted)', marginBottom: 5 }}>{l}</label>
                  <input type={t} value={form[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} required
                    style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, padding: '8px 12px', color: 'var(--text)', fontSize: 13, outline: 'none' }} />
                </div>
              ))}
              <div>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--muted)', marginBottom: 5 }}>Role</label>
                <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                  style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, padding: '8px 12px', color: 'var(--text)', fontSize: 13, outline: 'none' }}>
                  <option value="agent">Agent</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <button type="submit" style={{ padding: '8px 20px', background: 'linear-gradient(135deg,#4f8ef7,#6c63ff)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>Create</button>
            </div>
          </form>
        </div>
      )}

      {/* Agent Cards Grid */}
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 14 }}>Agent Cards</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14, marginBottom: 24 }}>
        {agents.map(a => (
          <div key={a.id || a.name}
            onClick={() => setSelectedAgent(a)}
            style={{
              background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12,
              padding: 20, cursor: 'pointer', transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(79,142,247,0.15)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--accent2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 600, color: '#fff', flexShrink: 0 }}>
                {a.name?.[0]?.toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                  {a.email} · Cycle: {a.sales_cycle_start || 7}-{a.sales_cycle_start === 1 ? 'end' : ((a.sales_cycle_start || 7) - 1)}
                </div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div style={{ background: 'var(--bg3)', borderRadius: 8, padding: '10px 12px' }}>
                <div style={{ fontSize: 9, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Sales</div>
                <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)', marginTop: 2 }}>{a.total_sales}</div>
              </div>
              <div style={{ background: 'var(--bg3)', borderRadius: 8, padding: '10px 12px' }}>
                <div style={{ fontSize: 9, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Net Revenue</div>
                <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--green)', marginTop: 2 }}>${Number(a.total_revenue || 0).toLocaleString()}</div>
              </div>
            </div>
            {/* Sales cycle info */}
            {a.sales_period && (
              <div style={{ marginTop: 10, fontSize: 10, color: 'var(--muted)', background: 'var(--bg3)', borderRadius: 6, padding: '6px 10px' }}>
                Period: {formatDate(a.sales_period.periodStart)} — {formatDate(a.sales_period.periodEnd)}
              </div>
            )}
            {/* Loss indicators */}
            {(a.cancelled_amount > 0 || a.chargeback_amount > 0) && (
              <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                {a.cancelled_amount > 0 && (
                  <span style={{ fontSize: 10, color: '#f87171', background: 'rgba(248,113,113,0.1)', padding: '2px 6px', borderRadius: 4 }}>
                    Cancelled: ${Number(a.cancelled_amount || 0).toLocaleString()}
                  </span>
                )}
                {a.chargeback_amount > 0 && (
                  <span style={{ fontSize: 10, color: '#a78bfa', background: 'rgba(167,139,250,0.1)', padding: '2px 6px', borderRadius: 4 }}>
                    Chargeback: ${Number(a.chargeback_amount || 0).toLocaleString()}
                  </span>
                )}
              </div>
            )}
            <div style={{ marginTop: 10, fontSize: 10, color: 'var(--muted)', textAlign: 'center', opacity: 0.6 }}>Click to view details →</div>
          </div>
        ))}
      </div>

      {/* All users table */}
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 16 }}>All Users</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Name', 'Email', 'Role', 'Sales Cycle', 'Joined', ''].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontSize: 11, fontWeight: 500, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.3px' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '10px 12px', color: 'var(--text)', fontWeight: 500 }}>{u.name}</td>
                <td style={{ padding: '10px 12px', color: 'var(--muted)' }}>{u.email}</td>
                <td style={{ padding: '10px 12px' }}>
                  <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, fontWeight: 500, background: (BADGE[u.role] || '#888') + '22', color: BADGE[u.role] || 'var(--muted)', textTransform: 'capitalize' }}>{u.role}</span>
                </td>
                <td style={{ padding: '10px 12px' }}>
                  {u.role === 'agent' ? (
                    <span style={{ fontSize: 11, color: 'var(--accent)', cursor: 'pointer', background: 'rgba(79,142,247,0.1)', padding: '3px 8px', borderRadius: 4 }}
                      onClick={(e) => { e.stopPropagation(); setSalesCycleAgent(u); }}>
                      {u.sales_cycle_start || 7}-{(u.sales_cycle_start || 7) === 1 ? 'end' : (u.sales_cycle_start || 7) - 1} ✎
                    </span>
                  ) : (
                    <span style={{ fontSize: 11, color: 'var(--muted)' }}>—</span>
                  )}
                </td>
                <td style={{ padding: '10px 12px', color: 'var(--muted)', fontSize: 12 }}>{u.created_at?.split('T')[0]}</td>
                <td style={{ padding: '10px 12px' }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {user?.role === 'admin' && (
                      <button onClick={() => setPasswordChangeUser(u)} style={{ padding: '4px 10px', background: 'transparent', border: '1px solid rgba(79,142,247,0.3)', borderRadius: 6, color: '#4f8ef7', fontSize: 11, cursor: 'pointer' }}>Change Password</button>
                    )}
                    <button onClick={() => deleteUser(u.id)} style={{ padding: '4px 10px', background: 'transparent', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 6, color: 'var(--red)', fontSize: 11, cursor: 'pointer' }}>Remove</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Agent Detail Modal */}
      {selectedAgent && (
        <AgentDetailModal agent={selectedAgent} onClose={() => setSelectedAgent(null)} />
      )}

      {/* Password Change Modal */}
      {passwordChangeUser && (
        <PasswordChangeModal user={passwordChangeUser} onClose={() => setPasswordChangeUser(null)} />
      )}

      {/* Sales Cycle Edit Modal */}
      {salesCycleAgent && (
        <SalesCycleModal
          agent={salesCycleAgent}
          onClose={() => setSalesCycleAgent(null)}
          onSave={() => load()}
        />
      )}
    </div>
  );
}
