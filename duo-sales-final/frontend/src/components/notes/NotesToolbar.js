// Notes toolbar: search (Ctrl/Cmd+F), grid/list toggle, refresh + sync state.
import React, { useEffect, useRef, useState } from 'react';
import Icon from './icons';
import { CARD_MUTED, RADIUS } from './notesTheme';
import { collectionLabel } from './NotesEmptyState';

export default function NotesToolbar({
  query, onQueryChange, view, onViewChange, onRefresh, refreshing, sidebarOpen, onToggleSidebar, searchRef,
}) {
  const localRef = useRef(null);
  const inputRef = searchRef || localRef;
  const [focused, setFocused] = useState(false);

  // Ctrl/Cmd + F focuses this feature's search while the notes page is open.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault();
        inputRef.current && inputRef.current.focus();
        inputRef.current && inputRef.current.select();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [inputRef]);

  const toggleBtn = (active) => ({
    width: 32, height: 32, borderRadius: 8, border: 'none', cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    background: active ? 'rgba(79,142,247,0.16)' : 'transparent',
    color: active ? 'var(--accent)' : CARD_MUTED,
  });

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
      <button
        type="button"
        onClick={onToggleSidebar}
        aria-label={sidebarOpen ? 'Hide notes menu' : 'Show notes menu'}
        aria-expanded={sidebarOpen}
        title={sidebarOpen ? 'Hide menu' : 'Show menu'}
        style={{
          ...toggleBtn(false), width: 36, height: 36, flexShrink: 0,
          border: '1px solid var(--border)', borderRadius: RADIUS, color: 'var(--muted)',
        }}
      >
        <Icon name="menu" size={18} />
      </button>

      {/* Search */}
      <div style={{
        flex: '1 1 220px', maxWidth: 560, display: 'flex', alignItems: 'center', gap: 8,
        background: 'var(--bg3)', border: `1px solid ${focused ? 'var(--accent)' : 'var(--border2)'}`,
        borderRadius: RADIUS, padding: '0 10px', height: 38, transition: 'border-color 0.15s',
      }}>
        <Icon name="search" size={16} />
        <input
          ref={inputRef}
          type="text"
          value={query}
          placeholder={`Search in ${collectionLabel(view.collection || 'notes').toLowerCase()}…`}
          aria-label={`Search ${collectionLabel(view.collection || 'notes')}`}
          onChange={e => onQueryChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            flex: 1, background: 'transparent', border: 'none', outline: 'none',
            color: 'var(--text)', fontSize: 13, minWidth: 40, fontFamily: 'inherit',
          }}
        />
        {query && (
          <button
            type="button"
            onClick={() => { onQueryChange(''); inputRef.current && inputRef.current.focus(); }}
            aria-label="Clear search"
            title="Clear search"
            style={{ background: 'transparent', border: 'none', color: 'var(--muted)', cursor: 'pointer', display: 'inline-flex', padding: 2 }}
          >
            <Icon name="close" size={15} />
          </button>
        )}
      </div>

      <span aria-live="polite" style={{ fontSize: 11, color: 'var(--muted)', minWidth: 44 }}>
        {refreshing ? <span className="duo-spin" style={{ display: 'inline-flex' }}><Icon name="refresh" size={14} /></span> : ''}
      </span>

      {/* View toggle */}
      <div role="group" aria-label="View" style={{ display: 'flex', gap: 2, background: 'var(--bg3)', borderRadius: RADIUS, padding: 3, border: '1px solid var(--border)' }}>
        <button
          type="button"
          onClick={() => onViewChange('grid')}
          aria-label="Grid view" aria-pressed={view.mode === 'grid'} title="Grid view"
          style={toggleBtn(view.mode === 'grid')}
        >
          <Icon name="grid" size={16} />
        </button>
        <button
          type="button"
          onClick={() => onViewChange('list')}
          aria-label="List view" aria-pressed={view.mode === 'list'} title="List view"
          style={toggleBtn(view.mode === 'list')}
        >
          <Icon name="list" size={16} />
        </button>
      </div>

      {/* Refresh */}
      <button
        type="button"
        onClick={onRefresh}
        aria-label="Refresh notes"
        title="Refresh"
        style={{
          ...toggleBtn(false), width: 36, height: 36, flexShrink: 0,
          border: '1px solid var(--border)', borderRadius: RADIUS, color: 'var(--muted)',
        }}
      >
        <Icon name="refresh" size={17} />
      </button>
    </div>
  );
}
