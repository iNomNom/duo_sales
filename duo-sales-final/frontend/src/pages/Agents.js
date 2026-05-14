import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const STATUS_COLORS = { Active: '#34d399', Pending: '#fbbf24', Cancelled: '#f87171', Chargeback: '#a78bfa' };

// ── Agent Detail Modal ───────────────────────────────────────────────────
function AgentDetailModal({ agent, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await axios.get(`/api/analytics/agent/${encodeURIComponent(agent.name)}`);
        setData(res.data);
      } catch {}
      setLoading(false);
    };
    load();
  }, [agent.name]);

  const fmt = v => '$' + Number(v || 0).toLocaleString();

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} />
      <div style={{
        position: 'relative', width: '90%', maxWidth: 1000, maxHeight: '85vh',
        background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 14,
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
      }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--accent2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 600, color: '#fff' }}>
              {agent.name?.[0]?.toUpperCase()}
            </div>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)', margin: 0 }}>{agent.name}</h2>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{agent.email} · All-time record</div>
            </div>
          </div>
          <button onClick={onClose} style={{ padding: '6px 14px', background: 'transparent', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--muted)', fontSize: 12, cursor: 'pointer' }}>✕ Close</button>
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
                  { label: 'Revenue', value: fmt(data.stats.revenue), color: 'var(--green)' },
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

              {/* Monthly chart */}
              {data.monthly.length > 0 && (
                <div style={{ background: 'var(--bg3)', borderRadius: 10, padding: 16, marginBottom: 20 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>Monthly Revenue</div>
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={data.monthly}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                      <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#7a7f96' }} />
                      <YAxis tick={{ fontSize: 10, fill: '#7a7f96' }} tickFormatter={v => '$' + (v/1000).toFixed(0) + 'k'} />
                      <Tooltip formatter={v => ['$' + Number(v).toLocaleString(), 'Revenue']} contentStyle={{ background: '#1a1d28', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 11 }} />
                      <Bar dataKey="revenue" fill="#6c63ff" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Sales table */}
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>All Sales ({data.sales.length})</div>
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
                      <td style={{ padding: '8px 10px', color: 'var(--green)', fontWeight: 600 }}>${Number(s.amount || 0).toLocaleString()}</td>
                      <td style={{ padding: '8px 10px' }}>
                        <span style={{ fontSize: 10, fontWeight: 500, padding: '2px 8px', borderRadius: 12, background: (STATUS_COLORS[s.status] || '#888') + '22', color: STATUS_COLORS[s.status] || 'var(--muted)' }}>{s.status}</span>
                      </td>
                      <td style={{ padding: '8px 10px', color: 'var(--muted)' }}>{s.closed_by}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Agents Page ─────────────────────────────────────────────────────
export default function Agents() {
  const [agents, setAgents] = useState([]);
  const [users, setUsers] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'agent' });
  const [msg, setMsg] = useState('');
  const [selectedAgent, setSelectedAgent] = useState(null);

  const load = async () => {
    try {
      const [a, u] = await Promise.all([axios.get('/api/agents'), axios.get('/api/auth/users')]);
      setAgents(a.data);
      setUsers(u.data);
    } catch {}
  };

  useEffect(() => { load(); }, []);

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

  return (
    <div style={{ padding: 28 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text)', margin: 0 }}>Agents & Users</h1>
          <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>Click any agent card to view their all-time record</p>
        </div>
        <button onClick={() => setShowAdd(!showAdd)} style={{ padding: '8px 16px', background: 'linear-gradient(135deg,#4f8ef7,#6c63ff)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          + Add User
        </button>
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14, marginBottom: 24 }}>
        {agents.map(a => (
          <div key={a.id}
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
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>{a.email}</div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div style={{ background: 'var(--bg3)', borderRadius: 8, padding: '10px 12px' }}>
                <div style={{ fontSize: 9, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Sales</div>
                <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)', marginTop: 2 }}>{a.total_sales}</div>
              </div>
              <div style={{ background: 'var(--bg3)', borderRadius: 8, padding: '10px 12px' }}>
                <div style={{ fontSize: 9, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Revenue</div>
                <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--green)', marginTop: 2 }}>${Number(a.total_revenue || 0).toLocaleString()}</div>
              </div>
            </div>
            <div style={{ marginTop: 12, fontSize: 10, color: 'var(--muted)', textAlign: 'center', opacity: 0.6 }}>Click to view all-time record →</div>
          </div>
        ))}
      </div>

      {/* All users table */}
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 16 }}>All Users</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Name', 'Email', 'Role', 'Joined', ''].map(h => (
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
                <td style={{ padding: '10px 12px', color: 'var(--muted)', fontSize: 12 }}>{u.created_at?.split('T')[0]}</td>
                <td style={{ padding: '10px 12px' }}>
                  <button onClick={() => deleteUser(u.id)} style={{ padding: '4px 10px', background: 'transparent', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 6, color: 'var(--red)', fontSize: 11, cursor: 'pointer' }}>Remove</button>
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
    </div>
  );
}
