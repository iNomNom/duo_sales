// NotesFeature — the Google Keep-style notes page. Owns collection state,
// derived/search views, editor lifecycle, undo toasts, trash actions and
// reminder notifications. All persistence flows through the useNotes store.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import useNotes from './useNotes';
import NotesSidebar from './NotesSidebar';
import NotesToolbar from './NotesToolbar';
import NotesCanvas from './NotesCanvas';
import NoteComposer from './NoteComposer';
import NoteEditor from './NoteEditor';
import NotesEmptyState from './NotesEmptyState';
import Icon from './icons';
import { NOTES_STYLES, RADIUS } from './notesTheme';
import {
  inCollection, sortNotes, filterNotes, titleOf,
} from './notesUtils';

const TRASH_RETENTION_LABEL = 'Notes in Trash are deleted forever after 30 days';

function Skeleton() {
  return (
    <div style={{ display: 'flex', gap: 12 }}>
      {[180, 140, 200].map((h, i) => (
        <div key={i} style={{
          flex: 1, height: h, borderRadius: RADIUS, background: 'var(--bg3)',
          border: '1px solid var(--border)', opacity: 0.7,
        }} />
      ))}
    </div>
  );
}

function Snackbar({ toast, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, toast.duration || (toast.action ? 6000 : 4200));
    return () => clearTimeout(t);
  }, [toast, onClose]);
  return createPortal(
    <div
      className="duo-snackbar"
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed', left: 20, bottom: 20, zIndex: 95,
        background: '#2c3040', color: '#e8eaf0',
        border: '1px solid var(--border2)', borderRadius: 10,
        boxShadow: '0 10px 30px rgba(0,0,0,0.45)',
        padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 16,
        minWidth: 260, maxWidth: 'min(420px, calc(100vw - 40px))', fontSize: 13,
      }}
    >
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{toast.message}</span>
      {toast.action && (
        <button
          type="button"
          onClick={() => { toast.onAction && toast.onAction(); onClose(); }}
          style={{
            background: 'transparent', border: 'none', color: 'var(--accent)',
            fontWeight: 600, fontSize: 13, cursor: 'pointer', padding: '2px 4px',
          }}
        >
          {toast.action}
        </button>
      )}
      <button
        type="button"
        onClick={onClose}
        aria-label="Dismiss"
        style={{ background: 'transparent', border: 'none', color: 'var(--muted)', cursor: 'pointer', display: 'inline-flex', padding: 2 }}
      >
        <Icon name="close" size={14} />
      </button>
    </div>,
    document.body
  );
}

export default function NotesFeature() {
  const store = useNotes();
  const [collection, setCollection] = useState('notes');
  const [viewMode, setViewMode] = useState(() => {
    try { return localStorage.getItem('duo_notes_view') === 'list' ? 'list' : 'grid'; } catch { return 'grid'; }
  });
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('duo_notes_sidebar') === '1'; } catch { return false; }
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [deferredQuery, setDeferredQuery] = useState('');
  const [editor, setEditor] = useState(null); // { noteId: number | null }
  const [toast, setToast] = useState(null);
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(max-width: 768px)').matches
  );

  const originRef = useRef(null);       // where the editor was opened from
  const searchRef = useRef(null);
  const composerRef = useRef(null);
  const notifiedRef = useRef(null);
  const allNotesRef = useRef([]);

  // Persisted prefs
  useEffect(() => { try { localStorage.setItem('duo_notes_view', viewMode); } catch {} }, [viewMode]);
  useEffect(() => { try { localStorage.setItem('duo_notes_sidebar', collapsed ? '1' : '0'); } catch {} }, [collapsed]);

  // Responsive
  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia('(max-width: 768px)');
    const onChange = () => setIsMobile(mq.matches);
    mq.addEventListener ? mq.addEventListener('change', onChange) : mq.addListener(onChange);
    return () => { mq.removeEventListener ? mq.removeEventListener('change', onChange) : mq.removeListener(onChange); };
  }, []);

  // Debounced search (150ms) — keeps typing smooth on large collections.
  useEffect(() => {
    const t = setTimeout(() => setDeferredQuery(query), 150);
    return () => clearTimeout(t);
  }, [query]);

  const showToast = useCallback((message, opts = {}) => {
    setToast({ key: Date.now(), message, ...opts });
  }, []);
  const closeToast = useCallback(() => setToast(null), []);

  // ── Derived collections (single source of truth: store.notes) ──────────────
  const allNotes = useMemo(() => Object.values(store.notes), [store.notes]);
  allNotesRef.current = allNotes;

  const visibleNotes = useMemo(() => {
    const inCol = allNotes.filter(n => inCollection(n, collection));
    const sorted = sortNotes(inCol);
    return filterNotes(sorted, deferredQuery);
  }, [allNotes, collection, deferredQuery]);

  const searching = deferredQuery.trim() !== '';

  // ── Undoable mutations ─────────────────────────────────────────────────────
  const trashNote = useCallback((id) => {
    const prev = store.notes[id];
    if (!prev) return;
    store.mutateNote(id, { isTrashed: true }).then(() => {
      showToast('Note moved to trash', {
        action: 'Undo',
        onAction: () => store.mutateNote(id, {
          isTrashed: false, isPinned: !!prev.isPinned, isArchived: !!prev.isArchived,
        }).catch(() => {}),
      });
    }).catch(() => {});
  }, [store, showToast]);

  const restoreNote = useCallback((id) => {
    store.mutateNote(id, { isTrashed: false }).then(() => {
      showToast('Note restored');
    }).catch(() => {});
  }, [store, showToast]);

  const deleteForever = useCallback((id) => {
    if (!window.confirm('Delete this note forever? This cannot be undone.')) return;
    store.removeNote(id).then(ok => { if (ok) showToast('Note deleted forever'); });
  }, [store, showToast]);

  const emptyTrash = useCallback(() => {
    if (!window.confirm('Permanently delete all notes in Trash? This cannot be undone.')) return;
    store.emptyTrash().then(ok => { if (ok) showToast('Trash emptied'); });
  }, [store, showToast]);

  const archiveNote = useCallback((id, archived) => {
    const prev = store.notes[id];
    store.mutateNote(id, { isArchived: archived }).then(() => {
      showToast(archived ? 'Note archived' : 'Note unarchived', {
        action: 'Undo',
        onAction: () => store.mutateNote(id, {
          isArchived: !archived, isPinned: prev ? !!prev.isPinned : false,
        }).catch(() => {}),
      });
    }).catch(() => {});
  }, [store, showToast]);

  const pinNote = useCallback((id, pinned) => {
    store.mutateNote(id, { isPinned: pinned }).catch(() => {});
  }, [store]);

  const colorNote = useCallback((id, color) => {
    const prev = store.notes[id];
    store.mutateNote(id, { color }).then(() => {
      showToast('Note color updated', {
        action: 'Undo',
        onAction: () => store.mutateNote(id, { color: prev ? prev.color : 'default' }).catch(() => {}),
      });
    }).catch(() => {});
  }, [store, showToast]);

  // ── Editor lifecycle (focus return + origin tracking) ──────────────────────
  const openEditor = useCallback((id) => {
    originRef.current = { type: 'card', id };
    setEditor({ noteId: id });
  }, []);

  const newNote = useCallback(() => {
    originRef.current = { type: 'composer' };
    setEditor({ noteId: null });
  }, []);

  const closeEditor = useCallback(() => {
    setEditor(null);
    // Return focus to where the editor was opened from.
    requestAnimationFrame(() => {
      const origin = originRef.current;
      if (!origin) return;
      if (origin.type === 'card') {
        const el = document.querySelector(`[data-id="${origin.id}"]`);
        if (el) el.focus({ preventScroll: false });
      } else if (composerRef.current) {
        composerRef.current.focus();
      }
    });
  }, []);

  // Surface store errors as toasts.
  useEffect(() => {
    if (store.error) {
      showToast(store.error);
      store.clearError();
    }
  }, [store.error, showToast, store]);

  // ── Ctrl/Cmd+F handled by NotesToolbar (feature-local) ─────────────────────

  const handlers = useMemo(() => ({
    onOpen: openEditor,
    onPin: pinNote,
    onColor: colorNote,
    onArchive: archiveNote,
    onTrash: trashNote,
    onRestore: restoreNote,
    onDeleteForever: deleteForever,
  }), [openEditor, pinNote, colorNote, archiveNote, trashNote, restoreNote, deleteForever]);

  const editingNote = editor
    ? (editor.noteId != null ? store.notes[editor.noteId] : null)
    : null;
  // If the note vanished (deleted elsewhere) while editing, close.
  useEffect(() => {
    if (editor && editor.noteId != null && !store.loading && !store.notes[editor.noteId]) {
      setEditor(null);
    }
  }, [editor, store.notes, store.loading]);

  const contentMax = 1080;

  return (
    <div className="duo-notes" style={{ display: 'flex', height: '100%', minHeight: 0, overflow: 'hidden' }}>
      <style>{NOTES_STYLES}</style>

      {!isMobile && (
        <NotesSidebar
          collection={collection}
          onSelect={setCollection}
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed(c => !c)}
          variant="desktop"
        />
      )}

      <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '14px 14px 48px' : '18px 24px 48px', minWidth: 0 }}>
        <div style={{ maxWidth: contentMax, margin: '0 auto' }}>
          {collection === 'notes' && !searching && (
            <div ref={composerRef} tabIndex={-1} style={{ outline: 'none' }}>
              <NoteComposer onNewNote={newNote} />
            </div>
          )}

          <NotesToolbar
            query={query}
            onQueryChange={setQuery}
            view={{ mode: viewMode, collection }}
            onViewChange={(mode) => setViewMode(mode)}
            onRefresh={() => store.load()}
            refreshing={store.loading && allNotes.length === 0}
            sidebarOpen={!collapsed}
            onToggleSidebar={() => (isMobile ? setMobileOpen(true) : setCollapsed(c => !c))}
            searchRef={searchRef}
          />

          {searching && (
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>Showing results for “{deferredQuery.trim()}” in <b style={{ color: 'var(--text)' }}>{collection === 'notes' ? 'Notes' : collection.charAt(0).toUpperCase() + collection.slice(1)}</b></span>
              <button
                type="button"
                onClick={() => setQuery('')}
                style={{ background: 'transparent', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 12, padding: 0 }}
              >
                Clear
              </button>
            </div>
          )}

          {collection === 'trash' && visibleNotes.length > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              gap: 12, marginBottom: 14, fontSize: 12, color: 'var(--muted)',
            }}>
              <span>{TRASH_RETENTION_LABEL}</span>
              <button
                type="button"
                onClick={emptyTrash}
                style={{
                  background: 'transparent', border: '1px solid var(--border2)', borderRadius: 8,
                  color: 'var(--red)', fontSize: 12, padding: '6px 12px', cursor: 'pointer', whiteSpace: 'nowrap',
                }}
              >
                Empty Trash
              </button>
            </div>
          )}

          {store.loading && allNotes.length === 0 ? (
            <Skeleton />
          ) : visibleNotes.length === 0 ? (
            <NotesEmptyState variant={searching ? 'search' : collection} query={deferredQuery.trim()} />
          ) : (
            <NotesCanvas
              notes={visibleNotes}
              view={viewMode}
              collection={collection}
              query={deferredQuery.trim()}
              draggable={collection === 'notes' && !searching}
              handlers={handlers}
              onCommitOrder={(pinnedIds, otherIds) => store.commitOrder(pinnedIds, otherIds)}
            />
          )}
        </div>
      </div>

      {/* Mobile drawer */}
      {isMobile && (
        <NotesSidebar
          collection={collection}
          onSelect={(key) => { setCollection(key); setMobileOpen(false); }}
          collapsed={false}
          onToggleCollapse={() => {}}
          variant="mobile"
          mobileOpen={mobileOpen}
          onCloseMobile={() => setMobileOpen(false)}
        />
      )}

      {editor && (
        <NoteEditor
          key={editor.noteId == null ? 'new' : `note-${editor.noteId}`}
          note={editingNote}
          collection={collection}
          store={store}
          onClose={closeEditor}
          onToast={showToast}
          onRequestDelete={trashNote}
        />
      )}

      {toast && <Snackbar toast={toast} onClose={closeToast} />}
    </div>
  );
}
