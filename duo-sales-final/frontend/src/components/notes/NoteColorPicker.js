// Color palette popover (Google Keep-inspired, dark-theme tuned).
import React, { useEffect, useRef } from 'react';
import Icon from './icons';
import { NOTE_COLORS, COLOR_KEYS, popover } from './notesTheme';

export default function NoteColorPicker({ value, onSelect, onClose, anchorStyle }) {
  const ref = useRef(null);

  useEffect(() => {
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Note background color"
      style={{ ...popover, bottom: 'calc(100% + 6px)', left: anchorStyle || 0, display: 'grid', gridTemplateColumns: 'repeat(5, 30px)', gap: 8 }}
    >
      {COLOR_KEYS.map(key => {
        const c = NOTE_COLORS[key];
        const selected = value === key;
        return (
          <button
            key={key}
            type="button"
            title={c.label}
            aria-label={`${c.label} background${selected ? ' (selected)' : ''}`}
            aria-pressed={selected}
            onClick={() => onSelect(key)}
            style={{
              width: 30, height: 30, borderRadius: '50%',
              background: c.bg, cursor: 'pointer', position: 'relative',
              border: selected ? '2px solid var(--accent)' : '1px solid var(--border2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: c.chip, transition: 'transform 0.1s',
            }}
          >
            {selected && <Icon name="check" size={14} />}
          </button>
        );
      })}
    </div>
  );
}
