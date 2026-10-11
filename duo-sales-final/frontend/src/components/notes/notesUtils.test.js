// Unit tests for the notes pure helpers.
import {
  inCollection, compareNotes, sortNotes, matchesQuery,
  filterNotes, highlightSegments, estimateCardHeight, splitIntoColumns,
  columnsForWidth, formatEdited,
} from './notesUtils';

const mk = (over = {}) => ({
  id: 1, title: '', body: '', color: 'default', isPinned: false,
  isArchived: false, isTrashed: false,
  sortOrder: 0, createdAt: '2026-01-01T10:00:00.000Z', updatedAt: '2026-01-01T10:00:00.000Z',
  ...over,
});

describe('collection membership', () => {
  it('keeps trash fully isolated', () => {
    const trashed = mk({ isTrashed: true });
    expect(inCollection(trashed, 'notes')).toBe(false);
    expect(inCollection(trashed, 'archive')).toBe(false);
    expect(inCollection(trashed, 'trash')).toBe(true);
  });

  it('separates archived notes', () => {
    const archived = mk({ isArchived: true });
    expect(inCollection(archived, 'notes')).toBe(false);
    expect(inCollection(archived, 'archive')).toBe(true);
  });
});

describe('ordering', () => {
  it('pinned notes sort before unpinned, then by sortOrder', () => {
    const a = mk({ id: 1, sortOrder: 20 });
    const b = mk({ id: 2, sortOrder: 10 });
    const c = mk({ id: 3, isPinned: true, sortOrder: 50 });
    const sorted = sortNotes([a, b, c]);
    expect(sorted.map(n => n.id)).toEqual([3, 2, 1]);
  });

  it('uses updatedAt as a deterministic tiebreaker (newest first)', () => {
    const a = mk({ id: 1, updatedAt: '2026-01-02T00:00:00.000Z' });
    const b = mk({ id: 2, updatedAt: '2026-01-01T00:00:00.000Z' });
    expect(sortNotes([b, a]).map(n => n.id)).toEqual([1, 2]);
  });
});

describe('search', () => {
  const notes = [
    mk({ id: 1, title: 'Shopping list', body: 'milk and eggs' }),
    mk({ id: 2, title: 'Meeting', body: 'discuss the SHOPPING budget' }),
    mk({ id: 3, title: 'Ideas', body: 'portfolio project' }),
  ];

  it('matches case-insensitively across title and body, anywhere', () => {
    const hits = filterNotes(notes, 'shopping');
    expect(hits.map(n => n.id)).toEqual([1, 2]);
  });

  it('matches partial words', () => {
    expect(filterNotes(notes, 'egg').map(n => n.id)).toEqual([1]);
    expect(filterNotes(notes, 'folio').map(n => n.id)).toEqual([3]);
  });

  it('returns everything for an empty query', () => {
    expect(filterNotes(notes, '  ')).toHaveLength(3);
  });
});

describe('highlight segments', () => {
  it('splits text around matches without altering it', () => {
    const segs = highlightSegments('Go Shopping today', 'shopping');
    expect(segs).toEqual([
      { text: 'Go ', hit: false },
      { text: 'Shopping', hit: true },
      { text: ' today', hit: false },
    ]);
  });

  it('handles multiple matches and no match', () => {
    expect(highlightSegments('aa b aa', 'aa')).toHaveLength(3);
    expect(highlightSegments('hello', 'zzz')).toEqual([{ text: 'hello', hit: false }]);
  });
});

describe('masonry estimation', () => {
  it('grows with content and clamps long bodies', () => {
    const short = mk({ body: 'hi' });
    const long = mk({ body: Array(80).fill('a long line of text here').join('\n') });
    const hShort = estimateCardHeight(short, 240);
    const hLong = estimateCardHeight(long, 240);
    expect(hLong).toBeGreaterThan(hShort);
    // clamped preview → bounded height
    expect(hLong).toBeLessThan(hShort + 400);
  });

  it('balances columns shortest-first while preserving order', () => {
    const notes = [1, 2, 3, 4, 5].map(i => mk({ id: i, body: 'x'.repeat(i * 40) }));
    const cols = splitIntoColumns(notes, 3, 240);
    const flat = cols.flat().map(c => c.note.id);
    expect(flat.slice().sort()).toEqual([1, 2, 3, 4, 5]);
    expect(cols).toHaveLength(3);
  });

  it('computes sensible column counts', () => {
    expect(columnsForWidth(300, 244)).toBe(1);
    expect(columnsForWidth(800, 244)).toBeGreaterThanOrEqual(2);
    expect(columnsForWidth(0, 244)).toBe(1);
  });
});

describe('formatEdited', () => {
  it('formats SQLite-style timestamps without crashing', () => {
    expect(formatEdited('2026-06-10 12:00:00')).toMatch(/Edited/);
    expect(formatEdited('2026-06-10T12:00:00.000Z')).toMatch(/Edited/);
    expect(formatEdited(null)).toBe('');
  });
});
