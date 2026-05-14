import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

const nav = [
  { to: '/', label: 'Dashboard', icon: '▦', exact: true },
  { to: '/sales', label: 'All Sales', labelAgent: 'My Sales', icon: '☰' },
  { to: '/new-sale', label: 'New Sale', icon: '+' },
  { to: '/agents', label: 'Agents', icon: '◉', adminOnly: true },
  { to: '/settings', label: 'Settings', icon: '⚙', adminOnly: true },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [showNotif, setShowNotif] = useState(false);

  const handleLogout = () => { logout(); navigate('/login'); };

  const loadNotifications = async () => {
    try {
      const res = await axios.get('/api/notifications');
      setNotifications(res.data);
    } catch {}
  };

  useEffect(() => { loadNotifications(); const iv = setInterval(loadNotifications, 30000); return () => clearInterval(iv); }, []);

  const unreadCount = notifications.filter(n => !n.read).length;
  const markAllRead = async () => {
    try {
      await axios.put('/api/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, read: 1 })));
    } catch {}
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Sidebar */}
      <aside style={{
        width: collapsed ? 60 : 220, flexShrink: 0, background: 'var(--bg2)',
        borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column',
        transition: 'width 0.2s', overflow: 'hidden'
      }}>
        {/* Logo */}
        <div style={{ padding: '20px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg,#4f8ef7,#6c63ff)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#fff' }}>D</div>
          {!collapsed && <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', lineHeight: 1.2 }}>Duo Enterprizes</div>
            <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>Sales Platform</div>
          </div>}
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '12px 8px' }}>
          {nav.filter(n => !n.adminOnly || user?.role === 'admin' || user?.role === 'manager').map(n => (
            <NavLink key={n.to} to={n.to} end={n.exact}
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px',
                borderRadius: 8, marginBottom: 2, textDecoration: 'none', fontSize: 13,
                fontWeight: n.highlight ? 600 : 400, transition: 'all 0.15s',
                background: n.highlight ? 'rgba(79,142,247,0.15)' : isActive ? 'var(--bg3)' : 'transparent',
                color: n.highlight ? 'var(--accent)' : isActive ? 'var(--text)' : 'var(--muted)',
                border: n.highlight ? '1px solid rgba(79,142,247,0.3)' : '1px solid transparent',
              })}>
              <span style={{ fontSize: 16, width: 20, textAlign: 'center', flexShrink: 0 }}>{n.icon}</span>
              {!collapsed && <span>{(n.labelAgent && user?.role === 'agent') ? n.labelAgent : n.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* User + collapse */}
        <div style={{ borderTop: '1px solid var(--border)', padding: '12px 8px' }}>
          {!collapsed && <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', marginBottom: 4 }}>
            <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--accent2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, color: '#fff', flexShrink: 0 }}>
              {user?.name?.[0]?.toUpperCase()}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.name}</div>
              <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'capitalize' }}>{user?.role}</div>
            </div>
          </div>}
          <button onClick={handleLogout} style={{ width: '100%', padding: '8px 10px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--muted)', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, justifyContent: collapsed ? 'center' : 'flex-start' }}>
            <span>⇤</span>{!collapsed && 'Sign out'}
          </button>
          <button onClick={() => setCollapsed(!collapsed)} style={{ width: '100%', marginTop: 4, padding: '6px', background: 'transparent', border: 'none', color: 'var(--muted)', fontSize: 12, cursor: 'pointer' }}>
            {collapsed ? '→' : '← Collapse'}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        {/* Top bar with notifications */}
        <div style={{ padding: '8px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12, background: 'var(--bg2)', flexShrink: 0 }}>
          {/* Notification bell */}
          <div style={{ position: 'relative' }}>
            <button onClick={() => { setShowNotif(!showNotif); if (!showNotif) markAllRead(); }}
              style={{ padding: '6px 10px', background: 'transparent', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--muted)', fontSize: 14, cursor: 'pointer', position: 'relative' }}>
              🔔
              {unreadCount > 0 && (
                <span style={{ position: 'absolute', top: -4, right: -4, background: 'var(--red)', color: '#fff', fontSize: 9, fontWeight: 700, borderRadius: '50%', width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{unreadCount > 9 ? '9+' : unreadCount}</span>
              )}
            </button>
            {showNotif && (
              <div style={{
                position: 'absolute', right: 0, top: '100%', marginTop: 4, width: 320,
                background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10,
                boxShadow: '0 10px 30px rgba(0,0,0,0.4)', zIndex: 100, maxHeight: 400, overflow: 'auto',
              }}>
                <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>Notifications</span>
                  {unreadCount > 0 && <span style={{ fontSize: 10, color: 'var(--muted)' }}>{unreadCount} new</span>}
                </div>
                {notifications.length === 0 ? (
                  <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted)', fontSize: 12 }}>No notifications yet</div>
                ) : notifications.slice(0, 20).map(n => (
                  <div key={n.id} style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', background: n.read ? 'transparent' : 'rgba(79,142,247,0.05)' }}>
                    <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.5 }}>{n.message}</div>
                    <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 3 }}>{new Date(n.created_at).toLocaleString()}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <main style={{ flex: 1, overflow: 'auto' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
