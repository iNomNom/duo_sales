import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

export default function Settings() {
  const { user } = useAuth();
  const [pwForm, setPwForm] = useState({ current: '', newPassword: '', confirm: '' });
  const [pwMsg, setPwMsg] = useState('');
  const [syncMsg, setSyncMsg] = useState('');
  const [backupMsg, setBackupMsg] = useState('');
  const [syncing, setSyncing] = useState(false);

  const changePassword = async (e) => {
    e.preventDefault();
    if (pwForm.newPassword !== pwForm.confirm) { setPwMsg('Passwords do not match'); return; }
    try {
      await axios.put('/api/auth/password', { current: pwForm.current, newPassword: pwForm.newPassword });
      setPwMsg('Password updated!');
      setPwForm({ current: '', newPassword: '', confirm: '' });
    } catch (err) {
      setPwMsg(err.response?.data?.error || 'Error');
    }
  };

  const syncToSheets = async () => {
    setSyncing(true); setSyncMsg('');
    try {
      const res = await axios.post('/api/backup/sync-sheets');
      setSyncMsg(res.data.message || 'Sync initiated');
    } catch (err) {
      setSyncMsg(err.response?.data?.error || 'Sync failed — check Google Sheets config in .env');
    }
    setSyncing(false);
  };

const downloadBackup = async () => {
  try {
    const res = await axios.get('/api/backup/download', { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = `duo_sales_backup_${new Date().toISOString().split('T')[0]}.db`;
    a.click();
    URL.revokeObjectURL(url);
    setBackupMsg('Download started!');
  } catch (err) {
    // Read the actual error message
    let msg = 'Download failed';
    if (err.response?.data) {
      try {
        const text = await err.response.data.text();
        const json = JSON.parse(text);
        msg = json.error || msg;
      } catch { msg = text || msg; }
    }
    setBackupMsg(msg);
  }
};

  const INPUT = { width: '100%', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, padding: '9px 12px', color: 'var(--text)', fontSize: 13, outline: 'none', boxSizing: 'border-box' };
  const LABEL = { display: 'block', fontSize: 11, color: 'var(--muted)', fontWeight: 500, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.3px' };

  return (
    <div style={{ padding: 28, maxWidth: 700 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text)', margin: 0 }}>Settings</h1>
        <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>Account and system configuration</p>
      </div>

      {/* Account info */}
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 24, marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 16 }}>Account Details</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div><label style={LABEL}>Name</label><div style={{ ...INPUT, opacity: 0.6 }}>{user?.name}</div></div>
          <div><label style={LABEL}>Email</label><div style={{ ...INPUT, opacity: 0.6 }}>{user?.email}</div></div>
          <div><label style={LABEL}>Role</label><div style={{ ...INPUT, opacity: 0.6, textTransform: 'capitalize' }}>{user?.role}</div></div>
        </div>
      </div>

      {/* Change password */}
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 24, marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 16 }}>Change Password</div>
        {pwMsg && <div style={{ background: pwMsg.includes('updated') ? 'rgba(52,211,153,0.1)' : 'rgba(248,113,113,0.1)', border: `1px solid ${pwMsg.includes('updated') ? 'rgba(52,211,153,0.3)' : 'rgba(248,113,113,0.3)'}`, borderRadius: 8, padding: '10px 14px', color: pwMsg.includes('updated') ? 'var(--green)' : 'var(--red)', fontSize: 13, marginBottom: 16 }}>{pwMsg}</div>}
        <form onSubmit={changePassword}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div><label style={LABEL}>Current Password</label><input type="password" value={pwForm.current} onChange={e => setPwForm(f => ({ ...f, current: e.target.value }))} required style={INPUT} /></div>
            <div><label style={LABEL}>New Password</label><input type="password" value={pwForm.newPassword} onChange={e => setPwForm(f => ({ ...f, newPassword: e.target.value }))} required style={INPUT} /></div>
            <div><label style={LABEL}>Confirm New</label><input type="password" value={pwForm.confirm} onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))} required style={INPUT} /></div>
          </div>
          <button type="submit" style={{ padding: '9px 20px', background: 'linear-gradient(135deg,#4f8ef7,#6c63ff)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Update Password</button>
        </form>
      </div>

      {/* Database Backup */}
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 24, marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>Database Backup</div>
        <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 16, lineHeight: 1.7 }}>Download a complete copy of your SQLite database file. This includes all sales, users, and notifications data. Keep this file safe as your full data backup.</p>
        {backupMsg && <div style={{
          background: backupMsg.includes('fail') || backupMsg.includes('error') ? 'rgba(248,113,113,0.1)' : 'rgba(52,211,153,0.1)',
          border: `1px solid ${backupMsg.includes('fail') || backupMsg.includes('error') ? 'rgba(248,113,113,0.3)' : 'rgba(52,211,153,0.3)'}`,
          borderRadius: 8, padding: '10px 14px',
          color: backupMsg.includes('fail') || backupMsg.includes('error') ? 'var(--red)' : 'var(--green)',
          fontSize: 13, marginBottom: 12
        }}>{backupMsg}</div>}
        <button onClick={downloadBackup} style={{ padding: '9px 20px', background: 'linear-gradient(135deg,#4f8ef7,#6c63ff)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Download Database Backup</button>
      </div>

      {/* Google Sheets Integration */}
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 24, marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>Google Sheets Integration</div>
        <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 16, lineHeight: 1.7 }}>Sync your sales data to a Google Sheet for cloud backup and easy sharing. All sales will be appended as rows. Status changes will also update the sheet in real-time.</p>
        {syncMsg && <div style={{ background: syncMsg.includes('fail') || syncMsg.includes('error') ? 'rgba(248,113,113,0.1)' : 'rgba(52,211,153,0.1)', border: `1px solid ${syncMsg.includes('fail') || syncMsg.includes('error') ? 'rgba(248,113,113,0.3)' : 'rgba(52,211,153,0.3)'}`, borderRadius: 8, padding: '10px 14px', color: syncMsg.includes('fail') || syncMsg.includes('error') ? 'var(--red)' : 'var(--green)', fontSize: 13, marginBottom: 12 }}>{syncMsg}</div>}
        <button onClick={syncToSheets} disabled={syncing} style={{ padding: '9px 20px', background: syncing ? 'var(--bg3)' : 'linear-gradient(135deg,#34d399,#2db583)', border: 'none', borderRadius: 8, color: syncing ? 'var(--muted)' : '#fff', fontSize: 13, fontWeight: 600, cursor: syncing ? 'not-allowed' : 'pointer', marginRight: 10 }}>
          {syncing ? 'Syncing...' : 'Sync to Google Sheets'}
        </button>
      </div>
    </div>
  );
}
