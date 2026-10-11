// Shared visual tokens for the notes feature, aligned with the app's
// existing dark theme (CSS variables defined in public/index.html).

export const NOTE_COLORS = {
  default: { bg: '#1a1d28', hover: '#20242f', chip: '#7a7f96', label: 'Default' },
  red:     { bg: '#4a2724', hover: '#55302c', chip: '#f28b82', label: 'Red' },
  orange:  { bg: '#4a341d', hover: '#553d25', chip: '#fbbc04', label: 'Orange' },
  yellow:  { bg: '#4d4519', hover: '#585020', chip: '#fff475', label: 'Yellow' },
  green:   { bg: '#25402a', hover: '#2c4b31', chip: '#ccff90', label: 'Green' },
  teal:    { bg: '#1e3f3c', hover: '#264a47', chip: '#a7ffeb', label: 'Teal' },
  blue:    { bg: '#20394e', hover: '#27445c', chip: '#aecbfa', label: 'Blue' },
  purple:  { bg: '#392e52', hover: '#423760', chip: '#d7aefb', label: 'Purple' },
  pink:    { bg: '#472a40', hover: '#52324a', chip: '#fdcfe8', label: 'Pink' },
  gray:    { bg: '#2b2f3a', hover: '#333847', chip: '#c8ccd8', label: 'Gray' },
};

export const COLOR_KEYS = Object.keys(NOTE_COLORS);

// Card text colors (kept constant — every palette shade is dark enough
// for the app's light-on-dark text to remain WCAG-comfortable).
export const CARD_TEXT = '#e8eaf0';
export const CARD_MUTED = 'rgba(232, 234, 240, 0.62)';

export const RADIUS = 10;
export const GAP = 12;
export const MIN_CARD_WIDTH = 244;

// Compact icon-button used across cards, editor and toolbars.
export const iconBtn = {
  width: 32,
  height: 32,
  borderRadius: 999,
  border: 'none',
  background: 'transparent',
  color: CARD_MUTED,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  padding: 0,
  flexShrink: 0,
};

export const iconBtnHover = {
  background: 'rgba(255,255,255,0.08)',
  color: CARD_TEXT,
};

// Popover surface (color picker).
export const popover = {
  position: 'absolute',
  background: '#22252f',
  border: '1px solid var(--border2)',
  borderRadius: 12,
  boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
  padding: 10,
  zIndex: 60,
};

// Scoped stylesheet for the notes feature: focus visibility, animations,
// reduced-motion handling. Namespaced under .duo-notes so it cannot leak
// into the rest of the application.
export const NOTES_STYLES = `
  .duo-notes :focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  .duo-notes [data-dragging='true'] { cursor: grabbing !important; }
  .duo-notes .note-appear { animation: duoNoteIn 0.14s ease-out; }
  @keyframes duoNoteIn {
    from { opacity: 0; transform: scale(0.985); }
    to   { opacity: 1; transform: scale(1); }
  }
  .duo-notes .duo-snackbar { animation: duoSnackIn 0.18s ease-out; }
  @keyframes duoSnackIn {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .duo-notes .duo-spin { animation: duoSpin 0.9s linear infinite; }
  @keyframes duoSpin { to { transform: rotate(360deg); } }
  .duo-notes .note-card .card-actions { opacity: 0; }
  .duo-notes .note-card:hover .card-actions,
  .duo-notes .note-card:focus-within .card-actions { opacity: 1; }
  @media (hover: none) {
    .duo-notes .note-card .card-actions { opacity: 1; }
  }
  @media (prefers-reduced-motion: reduce) {
    .duo-notes *, .duo-notes *::before, .duo-notes *::after {
      animation-duration: 0.001s !important;
      transition-duration: 0.001s !important;
    }
  }
`;
