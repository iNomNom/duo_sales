// Collapsed "Take a note…" composer at the top of the canvas (Keep-style).
import React, { useRef } from 'react';
import Icon from './icons';
import { NOTE_COLORS, CARD_MUTED, RADIUS } from './notesTheme';

export default function NoteComposer({ onNewNote }) {
  const ref = useRef(null);

  return (
    <div
      ref={ref}
      role="button"
      tabIndex={0}
      aria-label="Take a note"
      onClick={() => onNewNote()}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNewNote(); } }}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, maxWidth: 640,
        margin: '0 auto 20px', padding: '12px 16px',
        background: 'var(--bg3)', color: CARD_MUTED,
        border: '1px solid var(--border2)', borderRadius: RADIUS,
        cursor: 'text', boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
        transition: 'box-shadow 0.15s, background 0.15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.35)'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.25)'; }}
    >
      <span style={{ fontSize: 13.5, flex: 1 }}>Take a note…</span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 12, color: CARD_MUTED }} aria-hidden="true">
        {['yellow', 'teal', 'pink'].map(k => (
          <span key={k} style={{ width: 14, height: 14, borderRadius: '50%', background: NOTE_COLORS[k].bg, border: '1px solid var(--border2)' }} />
        ))}
        <Icon name="palette" size={16} />
      </span>
    </div>
  );
}
