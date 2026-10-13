// Modal note editor (Google Keep-style). Autosaves with a short debounce,
// creates the note on first meaningful content, flushes on close, discards
// never-meaningful drafts, and manages focus (trap + restore).
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Icon from './icons';
import NoteColorPicker from './NoteColorPicker';
import { NOTE_COLORS, CARD_TEXT, CARD_MUTED, RADIUS, iconBtn, iconBtnHover } from './notesTheme';

const AUTOSAVE_DELAY = 600;

export default function NoteEditor({
  note,                       // server note object or null for a new draft
  collection = 'notes',
  store,                      // useNotes() api
  onClose,                    // ({ id } | null) => void
  onDraftCreated,             // (createdNote) => void (lets parent track the id)
  onToast,                    // (message, opts) => void
  onRequestDelete,            // (id, snapshot) => void  (trash from editor)
}) {
  const isNew = !note;
  const [draftId, setDraftId] = useState(note ? note.id : null);
  const [title, setTitle] = useState(note ? note.title : '');
  const [body, setBody] = useState(note ? note.body : '');
  const [color, setColor] = useState(note ? note.color : 'default');
  const [isPinned, setIsPinned] = useState(note ? !!note.isPinned : false);
  const [menu, setMenu] = useState(null);

  // Resizable state
  const [editorWidth, setEditorWidth] = useState(() => {
    const saved = localStorage.getItem('duo_notes_editor_width');
    return saved ? parseInt(saved, 10) : 620;
  });
  const [editorHeight, setEditorHeight] = useState(() => {
    const saved = localStorage.getItem('duo_notes_editor_height');
    if (saved) return parseInt(saved, 10);
    return Math.min(window.innerHeight * 0.5, 500);
  });
  const [isResizing, setIsResizing] = useState(null); // 'width' | 'height' | 'both' | null

  const dialogRef = useRef(null);
  const titleRef = useRef(null);
  const bodyRef = useRef(null);
  const saveTimerRef = useRef(null);
  const lastSavedRef = useRef({ title: note?.title || '', body: note?.body || '', color: note?.color || 'default', isPinned: !!note?.isPinned });
  const draftRef = useRef({});
  draftRef.current = { id: draftId, title, body, color, isPinned };

  const palette = NOTE_COLORS[color] || NOTE_COLORS.default;

  // Persist editor dimensions
  useEffect(() => {
    localStorage.setItem('duo_notes_editor_width', editorWidth.toString());
  }, [editorWidth]);
  useEffect(() => {
    localStorage.setItem('duo_notes_editor_height', editorHeight.toString());
  }, [editorHeight]);

  // ── Focus management ───────────────────────────────────────────────────────
  const restoreFocusRef = useRef(null);
  useEffect(() => {
    restoreFocusRef.current = document.activeElement;
    if (isNew && titleRef.current) titleRef.current.focus();
    else if (dialogRef.current) dialogRef.current.focus();
    return () => {
      const el = restoreFocusRef.current;
      if (el && document.contains(el)) el.focus();
    };
  }, [isNew]);

  useEffect(() => {
    const node = dialogRef.current;
    if (!node) return;
    const trap = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); closeRef.current && closeRef.current(); return; }
      if (e.key !== 'Tab') return;
      const focusables = node.querySelectorAll(
        'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    node.addEventListener('keydown', trap);
    return () => node.removeEventListener('keydown', trap);
  }, []);

  // ── Autosave ───────────────────────────────────────────────────────────────
  const scheduleSave = useCallback((immediate = false) => {
    if (saveTimerRef.current) { clearTimeout(saveTimerRef.current); saveTimerRef.current = null; }
    const doSave = () => {
      const d = draftRef.current;
      const changed = d.title !== lastSavedRef.current.title
        || d.body !== lastSavedRef.current.body
        || d.color !== lastSavedRef.current.color
        || d.isPinned !== lastSavedRef.current.isPinned;
      if (!changed) return;
      const hasContent = d.title.trim() !== '' || d.body.trim() !== '';
      if (typeof d.id !== 'number' && !hasContent) return; // hold until meaningful
      store.saveDraft(d, { immediate: true, onCreated: (created) => {
        setDraftId(created.id);
        onDraftCreated && onDraftCreated(created);
      } });
      lastSavedRef.current = { title: d.title, body: d.body, color: d.color, isPinned: d.isPinned };
    };
    if (immediate) doSave();
    else saveTimerRef.current = setTimeout(doSave, AUTOSAVE_DELAY);
  }, [store, onDraftCreated]);

  // Auto-grow textarea
  const growBody = useCallback(() => {
    const el = bodyRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, window.innerHeight - 200)}px`;
  }, []);
  useEffect(() => { growBody(); }, [body, growBody]);

  // ── Close: flush, discard empty, hand focus back ───────────────────────────
  const close = useCallback(async () => {
    if (saveTimerRef.current) { clearTimeout(saveTimerRef.current); saveTimerRef.current = null; }
    const d = draftRef.current;
    const hasContent = d.title.trim() !== '' || d.body.trim() !== '';

    if (typeof d.id === 'number' && !hasContent) {
      // Emptied note → remove it (Keep behavior), offer undo.
      const prev = store.notes[d.id];
      store.removeNote(d.id).then(ok => {
        if (ok && prev) {
          onToast && onToast('Note deleted', {
            action: 'Undo',
            onAction: () => { store.saveDraft({ id: d.id, ...prev }, { immediate: true }); },
          });
        }
      });
      onClose && onClose(null);
      return;
    }

    if (typeof d.id !== 'number' && !hasContent) {
      onClose && onClose(null); // never-meaningful draft → discard silently
      return;
    }

    scheduleSave(true);           // flush now (create or update, dedup-safe)
    await store.awaitDraft();
    onClose && onClose({ id: draftRef.current.id });
  }, [store, onClose, onToast, scheduleSave]);

  // ── Actions inside the editor ──────────────────────────────────────────────
  const togglePin = () => {
    setIsPinned(p => !p);
    scheduleSave();
  };
  const pickColor = (key) => { setColor(key); setMenu(null); scheduleSave(); };

  const trashFromEditor = () => {
    const d = draftRef.current;
    if (typeof d.id !== 'number') { onClose && onClose(null); return; }
    const prev = store.notes[d.id];
    onRequestDelete && onRequestDelete(d.id, prev);
    onClose && onClose(null);
  };

  const archiveFromEditor = () => {
    const d = draftRef.current;
    if (typeof d.id !== 'number') { onClose && onClose(null); return; }
    scheduleSave(true);
    store.awaitDraft().then(() => {
      store.mutateNote(d.id, { isArchived: true });
      onToast && onToast('Note archived', {
        action: 'Undo',
        onAction: () => store.mutateNote(d.id, { isArchived: false }).catch(() => {}),
      });
    });
    onClose && onClose({ id: d.id });
  };

  const saveState = typeof draftId === 'number' ? store.saveState[draftId] : null;
  const closeRef = useRef(null);
  closeRef.current = close;

  // ── Resize handlers ───────────────────────────────────────────────────────
  const handleResizeStart = useCallback((e, direction) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(direction);
    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = editorWidth;
    const startHeight = editorHeight;

    const handleMouseMove = (moveEvent) => {
      if (direction === 'width' || direction === 'both') {
        const newWidth = Math.max(400, Math.min(window.innerWidth - 32, startWidth + (moveEvent.clientX - startX)));
        setEditorWidth(newWidth);
      }
      if (direction === 'height' || direction === 'both') {
        const newHeight = Math.max(200, Math.min(window.innerHeight - 64, startHeight + (moveEvent.clientY - startY)));
        setEditorHeight(newHeight);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(null);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [editorWidth, editorHeight]);

  return createPortal(
    <div
      onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 90,
        background: 'rgba(8,9,13,0.6)', backdropFilter: 'blur(2px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={isNew ? 'New note' : 'Edit note'}
        tabIndex={-1}
        className="note-appear"
        style={{
          width: `${editorWidth}px`,
          height: `${editorHeight}px`,
          maxHeight: 'calc(100vh - 32px)',
          display: 'flex',
          flexDirection: 'column',
          background: palette.bg,
          color: CARD_TEXT,
          borderRadius: 12,
          border: '1px solid var(--border2)',
          boxShadow: '0 18px 60px rgba(0,0,0,0.55)',
          padding: '14px 16px 8px',
          position: 'relative',
          outline: 'none',
          resize: 'none',
          cursor: isResizing ? (isResizing === 'width' ? 'e-resize' : isResizing === 'height' ? 's-resize' : 'se-resize') : 'default',
        }}
      >
        {/* Title + pin */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <input
            ref={titleRef}
            value={title}
            onChange={(e) => { setTitle(e.target.value); scheduleSave(); }}
            placeholder="Title"
            aria-label="Note title"
            maxLength={1000}
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              color: CARD_TEXT, fontSize: 16, fontWeight: 600, padding: '4px 0',
              fontFamily: 'inherit', minWidth: 0,
            }}
          />
          <button
            type="button"
            onClick={togglePin}
            aria-label={isPinned ? 'Unpin note' : 'Pin note'}
            aria-pressed={isPinned}
            title={isPinned ? 'Unpin' : 'Pin'}
            style={{ ...iconBtn, color: isPinned ? palette.chip : CARD_MUTED }}
          >
            <Icon name={isPinned ? 'pinFilled' : 'pin'} size={18} />
          </button>
        </div>

        {/* Body */}
        <textarea
          ref={bodyRef}
          value={body}
          onChange={(e) => { setBody(e.target.value); scheduleSave(); }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); close(); }
          }}
          placeholder="Take a note…"
          aria-label="Note body"
          rows={isNew && !body ? 8 : 4}
          style={{
            flex: 1, background: 'transparent', border: 'none', outline: 'none',
            color: CARD_TEXT, fontSize: 13.5, lineHeight: 1.6, resize: 'none',
            padding: '6px 0 10px', fontFamily: 'inherit', minHeight: 100,
            overflowY: 'auto', whiteSpace: 'pre-wrap',
          }}
        />

        {/* Footer actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, borderTop: '1px solid var(--border)', paddingTop: 6 }}>
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setMenu(menu === 'color' ? null : 'color')}
              aria-label="Background color options" aria-expanded={menu === 'color'}
              title="Background options" style={iconBtn}
              onMouseEnter={e => Object.assign(e.currentTarget.style, iconBtnHover)}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = CARD_MUTED; }}
            >
              <Icon name="palette" size={18} />
            </button>
            {menu === 'color' && (
              <NoteColorPicker value={color} onSelect={pickColor} onClose={() => setMenu(null)} />
            )}
          </div>

          {!isNew && collection !== 'archive' && (
            <button
              type="button"
              onClick={archiveFromEditor}
              aria-label="Archive note" title="Archive" style={iconBtn}
              onMouseEnter={e => Object.assign(e.currentTarget.style, iconBtnHover)}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = CARD_MUTED; }}
            >
              <Icon name="archive" size={18} />
            </button>
          )}

          {!isNew && collection !== 'trash' && (
            <button
              type="button"
              onClick={trashFromEditor}
              aria-label="Delete note" title="Delete" style={iconBtn}
              onMouseEnter={e => Object.assign(e.currentTarget.style, iconBtnHover)}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = CARD_MUTED; }}
            >
              <Icon name="trash" size={18} />
            </button>
          )}

          <div style={{ flex: 1 }} />

          <span aria-live="polite" style={{ fontSize: 11, color: CARD_MUTED, marginRight: 8 }}>
            {saveState === 'saving' ? 'Saving…'
              : saveState === 'error' ? 'Offline — retrying soon'
              : saveState === 'saved' ? 'Saved' : ''}
          </span>

          <button
            type="button"
            onClick={close}
            style={{
              padding: '7px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 600,
            }}
          >
            Done
          </button>
        </div>

        {/* Resize handles */}
        <div
          onMouseDown={(e) => handleResizeStart(e, 'both')}
          style={{
            position: 'absolute',
            bottom: 2,
            right: 2,
            width: 24,
            height: 24,
            cursor: 'se-resize',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'flex-end',
            padding: '4px',
            zIndex: 10,
            borderRadius: 4,
            transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.08)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          <div style={{
            width: 0,
            height: 0,
            borderStyle: 'solid',
            borderWidth: '0 0 10px 10px',
            borderColor: 'transparent transparent var(--muted) transparent',
            opacity: 0.6,
          }} />
        </div>

        <div
          onMouseDown={(e) => handleResizeStart(e, 'width')}
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: 6,
            height: '100%',
            cursor: 'e-resize',
            borderTopRightRadius: 12,
            borderBottomRightRadius: 12,
            zIndex: 5,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.05)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        />

        <div
          onMouseDown={(e) => handleResizeStart(e, 'height')}
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            width: '100%',
            height: 6,
            cursor: 's-resize',
            borderBottomLeftRadius: 12,
            borderBottomRightRadius: 12,
            zIndex: 5,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.05)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        />
      </div>
    </div>,
    document.body
  );
}
