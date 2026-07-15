import React, { useState } from 'react';
import axios from 'axios';

const SUPERADMIN_TOKEN_KEY = 'duo_superadmin_token';

export default function SuperAdmin() {
  const [secretKey, setSecretKey] = useState('');
  const [authed, setAuthed] = useState(() => !!localStorage.getItem(SUPERADMIN_TOKEN_KEY));
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Admin data
  const [admins, setAdmins] = useState([]);
  const [users, setUsers] = useState([]);
  const [tab, setTab] = useState('admins'); // 'admins' | 'all-users'
  const [dataLoaded, setDataLoaded] = useState(false);
  // SQL editor
  const [sqlText, setSqlText] = useState('SELECT * FROM users LIMIT 50');
  const [sqlRows, setSqlRows] = useState([]);
  const [sqlCols, setSqlCols] = useState([]);
  const [sqlMsg, setSqlMsg] = useState('');
  const [editableTable, setEditableTable] = useState(null); // detected table name for simple updates

  // Password change modal
  const [pwModal, setPwModal] = useState(null); // user object
  const [newPw, setNewPw] = useState('');
  const [pwMsg, setPwMsg] = useState('');

  // Create admin modal
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', email: '', password: '', role: 'admin' });
  const [createMsg, setCreateMsg] = useState('');

  // Delete confirm
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const getAuthHeader = () => {
    const token = localStorage.getItem(SUPERADMIN_TOKEN_KEY);
    return { headers: { Authorization: `Bearer ${token}` } };
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await axios.post('/api/superadmin/verify', { secretKey });
      localStorage.setItem(SUPERADMIN_TOKEN_KEY, res.data.token);
      setAuthed(true);
      // Set default auth header for subsequent requests
      axios.defaults.headers.common['Authorization'] = `Bearer ${res.data.token}`;
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid secret key');
    } finally {
      setLoading(false);
    }
  };

  const loadData = async () => {
    try {
      const [adminsRes, usersRes] = await Promise.all([
        axios.get('/api/superadmin/admins', getAuthHeader()),
        axios.get('/api/superadmin/users', getAuthHeader())
      ]);
      setAdmins(adminsRes.data);
      setUsers(usersRes.data);
      setDataLoaded(true);
    } catch (err) {
      if (err.response?.status === 401) {
        localStorage.removeItem(SUPERADMIN_TOKEN_KEY);
        setAuthed(false);
        setError('Session expired. Please re-enter the secret key.');
      }
    }
  };

  const handlePasswordChange = async () => {
    if (!newPw || newPw.length < 6) { setPwMsg('Password must be at least 6 characters'); return; }
    setPwMsg('');
    try {
      const res = await axios.put(`/api/superadmin/users/${pwModal.id}/password`, { newPassword: newPw }, getAuthHeader());
      setPwMsg(res.data.message);
      setNewPw('');
      setTimeout(() => { setPwModal(null); setPwMsg(''); }, 1500);
    } catch (err) {
      setPwMsg(err.response?.data?.error || 'Failed to update password');
    }
  };

  const handleCreateAdmin = async () => {
    setCreateMsg('');
    if (!createForm.name || !createForm.email || !createForm.password) {
      setCreateMsg('All fields are required');
      return;
    }
    try {
      const res = await axios.post('/api/superadmin/admins', createForm, getAuthHeader());
      setCreateMsg(res.data.message);
      setCreateForm({ name: '', email: '', password: '', role: 'admin' });
      setTimeout(() => { setShowCreate(false); setCreateMsg(''); loadData(); }, 1500);
    } catch (err) {
      setCreateMsg(err.response?.data?.error || 'Failed to create admin');
    }
  };

  const handleDelete = async (userId) => {
    try {
      await axios.delete(`/api/superadmin/users/${userId}`, getAuthHeader());
      setDeleteConfirm(null);
      loadData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete user');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(SUPERADMIN_TOKEN_KEY);
    setAuthed(false);
    setDataLoaded(false);
    setAdmins([]);
    setUsers([]);
  };

  // Load data when authenticated
  React.useEffect(() => {
    if (authed && !dataLoaded) loadData();
  }, [authed]);

  const displayData = tab === 'admins' ? admins : users;

  const INPUT = { width: '100%', background: '#1a1d2e', border: '1px solid #2a2d3e', borderRadius: 8, padding: '10px 14px', color: '#e2e4eb', fontSize: 14, outline: 'none', boxSizing: 'border-box' };
  const BTN_PRIMARY = { padding: '10px 24px', background: 'linear-gradient(135deg,#4f8ef7,#6c63ff)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' };
  const BTN_DANGER = { padding: '8px 16px', background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 8, color: '#f87171', fontSize: 13, fontWeight: 500, cursor: 'pointer' };
  const BTN_WARN = { padding: '8px 16px', background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: 8, color: '#fbbf24', fontSize: 13, fontWeight: 500, cursor: 'pointer' };

  // ── Secret Key Entry Screen ──────────────────────────────────────────────
  if (!authed) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f1117', padding: 20 }}>
        <div style={{ width: '100%', maxWidth: 420 }}>
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <div style={{ width: 56, height: 56, borderRadius: 14, background: 'linear-gradient(135deg,#f59e0b,#ef4444)', margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 700, color: '#fff' }}>S</div>
            <h1 style={{ fontSize: 22, fontWeight: 600, color: '#e2e4eb', margin: 0 }}>SuperAdmin Access</h1>
            <p style={{ color: '#7a7f96', fontSize: 14, marginTop: 6 }}>Restricted area — secret key required</p>
          </div>

          <div style={{ background: '#141728', border: '1px solid #252840', borderRadius: 14, padding: 32 }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, color: '#e2e4eb', marginBottom: 20, marginTop: 0 }}>Enter Secret Key</h2>
            {error && <div style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 8, padding: '10px 14px', color: '#f87171', fontSize: 13, marginBottom: 16 }}>{error}</div>}
            <form onSubmit={handleVerify}>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 12, color: '#7a7f96', marginBottom: 6, fontWeight: 500 }}>SECRET KEY</label>
                <input type="password" value={secretKey} onChange={e => setSecretKey(e.target.value)} required
                  style={INPUT} placeholder="Enter superadmin secret key" />
              </div>
              <button type="submit" disabled={loading} style={{ ...BTN_PRIMARY, width: '100%', opacity: loading ? 0.7 : 1 }}>
                {loading ? 'Verifying...' : 'Unlock Access'}
              </button>
            </form>
          </div>

          <p style={{ textAlign: 'center', marginTop: 20 }}>
            <a href="/" style={{ color: '#7a7f96', fontSize: 13, textDecoration: 'none' }}>&larr; Back to App</a>
          </p>
        </div>
      </div>
    );
  }

  // ── Admin Management Panel ───────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: '#0f1117', padding: '28px 32px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: '#e2e4eb', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg,#f59e0b,#ef4444)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: '#fff' }}>S</span>
            SuperAdmin Panel
          </h1>
          <p style={{ color: '#7a7f96', fontSize: 13, marginTop: 4 }}>Manage admin accounts and passwords</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <a href="/" style={{ ...BTN_PRIMARY, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', padding: '8px 16px', fontSize: 13 }}>&larr; Back to App</a>
          <button onClick={handleLogout} style={BTN_DANGER}>Lock & Exit</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '1px solid #252840' }}>
        {[
          { key: 'admins', label: `Admins & Managers (${admins.length})` },
          { key: 'all-users', label: `All Users (${users.length})` }
          ,{ key: 'sql', label: `SQL Runner` }
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{
              padding: '10px 20px', background: 'none', border: 'none', borderBottom: tab === t.key ? '2px solid #4f8ef7' : '2px solid transparent',
              color: tab === t.key ? '#e2e4eb' : '#7a7f96', fontSize: 13, fontWeight: tab === t.key ? 600 : 400, cursor: 'pointer'
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Actions Bar */}
      {tab === 'admins' && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
          <button onClick={() => setShowCreate(true)} style={BTN_PRIMARY}>+ Create New Admin</button>
        </div>
      )}

      {/* SQL Runner */}
      {tab === 'sql' && (
        <div style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
            <textarea value={sqlText} onChange={e => setSqlText(e.target.value)} rows={6}
              style={{ width: '100%', borderRadius: 8, padding: 12, background: '#0f1117', border: '1px solid #252840', color: '#e2e4eb', fontFamily: 'monospace' }} />
          </div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
            <button onClick={async () => {
              setSqlMsg('');
              try {
                const res = await axios.post('/api/superadmin/sql/execute', { sql: sqlText }, getAuthHeader());
                const rows = res.data.rows || [];
                setSqlRows(rows);
                setSqlCols(rows.length ? Object.keys(rows[0]) : []);

                // try to detect simple table name from FROM clause for editing
                const m = sqlText.match(/FROM\s+([a-zA-Z0-9_]+)/i);
                if (m) setEditableTable(m[1]); else setEditableTable(null);
              } catch (err) {
                setSqlMsg(err.response?.data?.error || err.message || 'Query failed');
                setSqlRows([]);
                setSqlCols([]);
                setEditableTable(null);
              }
            }} style={BTN_PRIMARY}>Run</button>
            <button onClick={() => { setSqlRows([]); setSqlCols([]); setSqlMsg(''); }} style={{ ...BTN_WARN }}>Clear</button>
          </div>
          {sqlMsg && <div style={{ color: '#f87171', marginBottom: 8 }}>{sqlMsg}</div>}

          <div style={{ background: '#141728', border: '1px solid #252840', borderRadius: 12, overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#1a1d2e' }}>
                  {sqlCols.map(c => (
                    <th key={c} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 12, color: '#7a7f96' }}>{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sqlRows.map((r, ri) => (
                  <tr key={ri} style={{ borderBottom: '1px solid #1e2136' }}>
                    {sqlCols.map(c => (
                      <td key={c} style={{ padding: '8px 12px', color: '#e2e4eb' }}>
                        {editableTable && c !== 'id' ? (
                          <input defaultValue={r[c]} onBlur={async (e) => {
                            const newVal = e.target.value;
                            if (String(newVal) === String(r[c])) return;
                            try {
                              await axios.post('/api/superadmin/sql/update-cell', { table: editableTable, id: r.id, column: c, value: newVal }, getAuthHeader());
                              setSqlMsg('Updated successfully');
                              // reflect locally
                              const copy = [...sqlRows]; copy[ri] = { ...copy[ri], [c]: newVal }; setSqlRows(copy);
                            } catch (err) {
                              setSqlMsg(err.response?.data?.error || 'Update failed');
                            }
                          }} style={{ width: '100%', background: 'transparent', border: '1px solid transparent', color: '#e2e4eb' }} />
                        ) : (
                          <span>{String(r[c])}</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
                {sqlRows.length === 0 && (
                  <tr><td style={{ padding: 20, color: '#7a7f96' }}>No rows</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Users Table */}
      <div style={{ background: '#141728', border: '1px solid #252840', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#1a1d2e' }}>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, color: '#7a7f96', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Name</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, color: '#7a7f96', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Email</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, color: '#7a7f96', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Role</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, color: '#7a7f96', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Sales Cycle</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, color: '#7a7f96', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Created</th>
              <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 11, color: '#7a7f96', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {displayData.map((u, i) => (
              <tr key={u.id} style={{ borderBottom: i < displayData.length - 1 ? '1px solid #1e2136' : 'none' }}>
                <td style={{ padding: '12px 16px', color: '#e2e4eb', fontSize: 14, fontWeight: 500 }}>{u.name}</td>
                <td style={{ padding: '12px 16px', color: '#a0a3b5', fontSize: 13 }}>{u.email}</td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{
                    padding: '3px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, textTransform: 'capitalize',
                    background: u.role === 'admin' ? 'rgba(99,102,241,0.15)' : u.role === 'manager' ? 'rgba(251,191,36,0.15)' : 'rgba(52,211,153,0.15)',
                    color: u.role === 'admin' ? '#818cf8' : u.role === 'manager' ? '#fbbf24' : '#34d399',
                    border: `1px solid ${u.role === 'admin' ? 'rgba(99,102,241,0.3)' : u.role === 'manager' ? 'rgba(251,191,36,0.3)' : 'rgba(52,211,153,0.3)'}`
                  }}>{u.role}</span>
                </td>
                <td style={{ padding: '12px 16px', color: '#a0a3b5', fontSize: 13 }}>{u.sales_cycle_start}{u.sales_cycle_start === 1 ? 'st' : u.sales_cycle_start === 2 ? 'nd' : u.sales_cycle_start === 3 ? 'rd' : 'th'} of month</td>
                <td style={{ padding: '12px 16px', color: '#7a7f96', fontSize: 13 }}>{u.created_at ? new Date(u.created_at + 'Z').toLocaleDateString() : 'N/A'}</td>
                <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button onClick={() => { setPwModal(u); setNewPw(''); setPwMsg(''); }} style={BTN_WARN}>Reset Password</button>
                    <button onClick={() => setDeleteConfirm(u)} style={BTN_DANGER}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
            {displayData.length === 0 && (
              <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: '#7a7f96', fontSize: 14 }}>No users found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Password Change Modal */}
      {pwModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#141728', border: '1px solid #252840', borderRadius: 14, padding: 28, width: '100%', maxWidth: 420 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: '#e2e4eb', marginTop: 0, marginBottom: 4 }}>Reset Password</h3>
            <p style={{ color: '#7a7f96', fontSize: 13, marginBottom: 20 }}>
              Set a new password for <strong style={{ color: '#e2e4eb' }}>{pwModal.name}</strong> ({pwModal.email})
            </p>
            {pwMsg && (
              <div style={{
                background: pwMsg.includes('updated') || pwMsg.includes('successfully') ? 'rgba(52,211,153,0.1)' : 'rgba(248,113,113,0.1)',
                border: `1px solid ${pwMsg.includes('updated') || pwMsg.includes('successfully') ? 'rgba(52,211,153,0.3)' : 'rgba(248,113,113,0.3)'}`,
                borderRadius: 8, padding: '10px 14px',
                color: pwMsg.includes('updated') || pwMsg.includes('successfully') ? '#34d399' : '#f87171',
                fontSize: 13, marginBottom: 16
              }}>{pwMsg}</div>
            )}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, color: '#7a7f96', marginBottom: 6, fontWeight: 500 }}>NEW PASSWORD</label>
              <input type="text" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="Min 6 characters"
                style={INPUT} />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => { setPwModal(null); setPwMsg(''); }} style={{ padding: '9px 18px', background: '#1a1d2e', border: '1px solid #252840', borderRadius: 8, color: '#a0a3b5', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
              <button onClick={handlePasswordChange} style={BTN_PRIMARY}>Update Password</button>
            </div>
          </div>
        </div>
      )}

      {/* Create Admin Modal */}
      {showCreate && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#141728', border: '1px solid #252840', borderRadius: 14, padding: 28, width: '100%', maxWidth: 460 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: '#e2e4eb', marginTop: 0, marginBottom: 20 }}>Create New Admin / Manager</h3>
            {createMsg && (
              <div style={{
                background: createMsg.includes('created') || createMsg.includes('successfully') ? 'rgba(52,211,153,0.1)' : 'rgba(248,113,113,0.1)',
                border: `1px solid ${createMsg.includes('created') || createMsg.includes('successfully') ? 'rgba(52,211,153,0.3)' : 'rgba(248,113,113,0.3)'}`,
                borderRadius: 8, padding: '10px 14px',
                color: createMsg.includes('created') || createMsg.includes('successfully') ? '#34d399' : '#f87171',
                fontSize: 13, marginBottom: 16
              }}>{createMsg}</div>
            )}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, color: '#7a7f96', marginBottom: 6, fontWeight: 500 }}>NAME</label>
              <input type="text" value={createForm.name} onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))} placeholder="Full name" style={INPUT} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, color: '#7a7f96', marginBottom: 6, fontWeight: 500 }}>EMAIL</label>
              <input type="email" value={createForm.email} onChange={e => setCreateForm(f => ({ ...f, email: e.target.value }))} placeholder="admin@email.com" style={INPUT} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, color: '#7a7f96', marginBottom: 6, fontWeight: 500 }}>PASSWORD</label>
              <input type="text" value={createForm.password} onChange={e => setCreateForm(f => ({ ...f, password: e.target.value }))} placeholder="Min 6 characters" style={INPUT} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 12, color: '#7a7f96', marginBottom: 6, fontWeight: 500 }}>ROLE</label>
              <select value={createForm.role} onChange={e => setCreateForm(f => ({ ...f, role: e.target.value }))}
                style={{ ...INPUT, appearance: 'auto' }}>
                <option value="admin">Admin</option>
                <option value="manager">Manager</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowCreate(false); setCreateMsg(''); }} style={{ padding: '9px 18px', background: '#1a1d2e', border: '1px solid #252840', borderRadius: 8, color: '#a0a3b5', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleCreateAdmin} style={BTN_PRIMARY}>Create Admin</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#141728', border: '1px solid #252840', borderRadius: 14, padding: 28, width: '100%', maxWidth: 400 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: '#f87171', marginTop: 0, marginBottom: 8 }}>Confirm Delete</h3>
            <p style={{ color: '#a0a3b5', fontSize: 14, lineHeight: 1.6 }}>
              Are you sure you want to delete <strong style={{ color: '#e2e4eb' }}>{deleteConfirm.name}</strong> ({deleteConfirm.email})?
              This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ padding: '9px 18px', background: '#1a1d2e', border: '1px solid #252840', borderRadius: 8, color: '#a0a3b5', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => handleDelete(deleteConfirm.id)} style={{ padding: '9px 18px', background: 'rgba(248,113,113,0.2)', border: '1px solid rgba(248,113,113,0.4)', borderRadius: 8, color: '#f87171', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Yes, Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
