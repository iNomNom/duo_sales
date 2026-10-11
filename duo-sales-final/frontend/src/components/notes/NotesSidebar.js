// In-page collection navigation (Notes / Reminders / Archive / Trash),
// Keep-style. Collapses to an icon rail on desktop; drawer on mobile.
import React from 'react';
import Icon from './icons';

const ITEMS = [
  { key: 'notes', label: 'Notes', icon: 'lightbulb' },
  { key: 'archive', label: 'Archive', icon: 'archive' },
  { key: 'trash', label: 'Trash', icon: 'trash' },
];

function NavButton({ item, active, collapsed, onSelect, onNavigate }) {
  return (
    <button
      type="button"
      onClick={() => { onSelect(item.key); onNavigate && onNavigate(); }}
      aria-current={active ? 'page' : undefined}
      title={collapsed ? item.label : undefined}
      aria-label={collapsed ? item.label : undefined}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        width: '100%', padding: collapsed ? '10px 0' : '9px 14px',
        justifyContent: collapsed ? 'center' : 'flex-start',
        borderRadius: '0 999px 999px 0',
        border: 'none', cursor: 'pointer', fontSize: 13, textAlign: 'left',
        background: active ? 'rgba(79,142,247,0.16)' : 'transparent',
        color: active ? 'var(--accent)' : 'var(--muted)',
        fontWeight: active ? 600 : 400,
        transition: 'background 0.12s, color 0.12s',
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--bg3)'; }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
    >
      <Icon name={item.icon} size={18} />
      {!collapsed && <span>{item.label}</span>}
    </button>
  );
}

export default function NotesSidebar({
  collection, onSelect, collapsed, onToggleCollapse,
  variant = 'desktop', mobileOpen, onCloseMobile,
}) {
  // ── Mobile drawer ──────────────────────────────────────────────────────────
  if (variant === 'mobile') {
    if (!mobileOpen) return null;
    return (
      <div
        onMouseDown={(e) => { if (e.target === e.currentTarget) onCloseMobile(); }}
        style={{
          position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(8,9,13,0.55)',
          display: 'flex', alignItems: 'stretch',
        }}
      >
        <div
          role="dialog"
          aria-label="Notes collections"
          className="duo-snackbar"
          style={{
            width: 220, background: 'var(--bg2)', borderRight: '1px solid var(--border)',
            paddingTop: 14,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 14px 10px' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Menu</span>
            <button
              type="button"
              onClick={onCloseMobile}
              aria-label="Close menu"
              style={{ background: 'transparent', border: 'none', color: 'var(--muted)', cursor: 'pointer', display: 'inline-flex', padding: 4 }}
            >
              <Icon name="close" size={18} />
            </button>
          </div>
          <nav aria-label="Notes collections">
            {ITEMS.map(item => (
              <NavButton
                key={item.key}
                item={item}
                active={collection === item.key}
                collapsed={false}
                onSelect={onSelect}
                onNavigate={onCloseMobile}
              />
            ))}
          </nav>
        </div>
      </div>
    );
  }

  // ── Desktop rail ───────────────────────────────────────────────────────────
  return (
    <nav
      aria-label="Notes collections"
      style={{
        width: collapsed ? 56 : 200, flexShrink: 0,
        paddingTop: 8, overflowY: 'auto', overflowX: 'hidden',
        borderRight: '1px solid var(--border)', background: 'var(--bg2)',
        transition: 'width 0.18s ease',
      }}
    >
      {ITEMS.map(item => (
        <NavButton
          key={item.key}
          item={item}
          active={collection === item.key}
          collapsed={collapsed}
          onSelect={onSelect}
        />
      ))}
      <button
        type="button"
        onClick={onToggleCollapse}
        aria-label={collapsed ? 'Expand menu labels' : 'Collapse menu to icons'}
        title={collapsed ? 'Expand menu' : 'Collapse menu'}
        style={{
          marginTop: 10, width: '100%', padding: '8px 0', border: 'none',
          background: 'transparent', color: 'var(--muted)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          fontSize: 12,
        }}
      >
        <Icon name="menu" size={16} />
        {!collapsed && <span>Hide labels</span>}
      </button>
    </nav>
  );
}
