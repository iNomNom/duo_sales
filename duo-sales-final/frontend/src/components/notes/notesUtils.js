// Pure helpers for the notes feature: ordering, search, masonry estimation,
// reminder date math and search highlighting. Unit-tested in
// src/components/notes/notesUtils.test.js.

// ── Collections ──────────────────────────────────────────────────────────────
export const COLLECTIONS = {
  notes: 'Notes',
  archive: 'Archive',
  trash: 'Trash',
};

// Which notes belong to a collection. Search always stays inside the
// selected collection; trash is fully isolated from the other views.
export function inCollection(note, collection) {
  if (note.isTrashed) return collection === 'trash';
  switch (collection) {
    case 'notes': return !note.isArchived;
    case 'archive': return note.isArchived;
    default: return false;
  }
}

// ── Ordering ─────────────────────────────────────────────────────────────────
// Pinned before unpinned; within a section, manual order (sortOrder asc),
// newest-edited as a deterministic tiebreaker.
export function compareNotes(a, b) {
  if (!!a.isPinned !== !!b.isPinned) return a.isPinned ? -1 : 1;
  const ao = a.sortOrder != null ? a.sortOrder : 0;
  const bo = b.sortOrder != null ? b.sortOrder : 0;
  if (ao !== bo) return ao - bo;
  return String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''));
}

export function sortNotes(list) {
  return [...list].sort(compareNotes);
}

// ── Search ───────────────────────────────────────────────────────────────────
// Case-insensitive substring match against title + body.
export function matchesQuery(note, query) {
  const q = (query || '').trim().toLowerCase();
  if (!q) return true;
  const title = (note.title || '').toLowerCase();
  const body = (note.body || '').toLowerCase();
  return title.includes(q) || body.includes(q);
}

export function filterNotes(list, query) {
  return query && query.trim() ? list.filter(n => matchesQuery(n, query)) : list;
}

// Split text into highlight segments for a query (no HTML injection — the
// result is a list of plain strings the UI renders as React nodes).
export function highlightSegments(text, query) {
  const str = String(text || '');
  const q = (query || '').trim().toLowerCase();
  if (!q) return [{ text: str, hit: false }];
  const segments = [];
  const lower = str.toLowerCase();
  let i = 0;
  while (i < str.length) {
    const hit = lower.indexOf(q, i);
    if (hit === -1) { segments.push({ text: str.slice(i), hit: false }); break; }
    if (hit > i) segments.push({ text: str.slice(i, hit), hit: false });
    segments.push({ text: str.slice(hit, hit + q.length), hit: true });
    i = hit + q.length;
  }
  return segments.length ? segments : [{ text: str, hit: false }];
}

// ── Masonry estimation ───────────────────────────────────────────────────────
// Rough card height (px) from content, used only to distribute cards across
// columns so the masonry stays balanced. Values tuned for the card styles.
export function estimateCardHeight(note, width) {
  const inner = Math.max(120, width - 32);
  const charsPerLine = Math.max(12, Math.floor(inner / 7.6));
  const title = note.title || '';
  const body = note.body || '';
  const lines = text => text.split('\n').reduce((n, l) => n + Math.max(1, Math.ceil((l.length || 1) / charsPerLine)), 0);
  const titleLines = title ? lines(title) : 0;
  const bodyLines = body ? Math.min(lines(body), 10) : 1; // preview clamps at ~10 lines
  const footer = 40; // action row
  const edited = 22;
  return 44 + titleLines * 21 + bodyLines * 20 + footer + edited;
}

// Distribute ordered notes into `cols` columns, shortest column first,
// preserving reading order. Returns an array of column arrays.
export function splitIntoColumns(ordered, cols, width) {
  const columns = Array.from({ length: cols }, () => []);
  const heights = new Array(cols).fill(0);
  ordered.forEach((note, index) => {
    let target = 0;
    for (let c = 1; c < cols; c++) if (heights[c] < heights[target]) target = c;
    columns[target].push({ note, index });
    heights[target] += estimateCardHeight(note, width);
  });
  return columns;
}

export function columnsForWidth(width, minCardWidth) {
  if (width <= 0) return 1;
  return Math.max(1, Math.min(6, Math.floor((width + 12) / (minCardWidth + 12))));
}

// ── Misc ─────────────────────────────────────────────────────────────────────
function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function formatEdited(iso) {
  if (!iso) return '';
  const d = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z');
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  if (sameDay(startOfDay(d), startOfDay(now))) {
    return `Edited ${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  }
  return `Edited ${d.toLocaleDateString([], { day: 'numeric', month: 'short' })}`;
}

export function titleOf(note) {
  return (note.title || '').trim();
}

export function previewOf(note) {
  return (note.title || '').trim()
    ? (note.body || '')
    : (note.body || '');
}
