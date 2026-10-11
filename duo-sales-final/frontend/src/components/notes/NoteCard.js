// Note card: Google Keep-style card with pin, color, reminder, archive and
// trash actions, search highlighting and full drag-and-drop support.
// Memoized — only re-renders when its note (or query/collection) changes.
//
// Exports:
//   CardShell — pure presentational card (used by the grid and the drag overlay)
//   NoteCard  — sortable wrapper around CardShell
import React, { memo, useCallback, useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import Icon from './icons';
import NoteColorPicker from './NoteColorPicker';
import {
  NOTE_COLORS, CARD_TEXT, CARD_MUTED, RADIUS, iconBtn, iconBtnHover,
} from './notesTheme';
import {
  formatEdited, highlightSegments,
} from './notesUtils';

function Highlighted({ text, query }) {
  if (!query) return <>{text}</>;
  return (
    <>
      {highlightSegments(text, query).map((seg, i) => (
        seg.hit
          ? <span key={i} style={{ background: 'rgba(255, 213, 79, 0.28)', borderRadius: 2 }}>{seg.text}</span>
          : <span key={i}>{seg.text}</span>
      ))}
    </>
  );
}

export function CardShell({
  note, query = '', view = 'grid', collection = 'notes',
  onOpen, onPin, onColor, onArchive, onTrash, onRestore, onDeleteForever,
  // drag plumbing (absent in the drag overlay clone)
  setNodeRef, dragAttributes, dragPointerListeners, dragHandleListeners, isDragging,
  interactive = true, style,
}) {
  const [menu, setMenu] = useState(null); // 'color' | null
  const color = NOTE_COLORS[note.color] || NOTE_COLORS.default;
  const title = (note.title || '').trim();
  const body = note.body || '';
  const draggable = !!dragPointerListeners;

  const open = useCallback((e) => {
    if (isDragging) return;
    if (e && e.target && e.target.closest && e.target.closest('button')) return;
    onOpen(note.id);
  }, [isDragging, note.id, onOpen]);

  const onKeyDown = useCallback((e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      open();
    }
  }, [open]);

  const btnHover = e => { Object.assign(e.currentTarget.style, iconBtnHover); };
  const btnOut = e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = CARD_MUTED; };

  const previewMax = view === 'grid' ? 200 : 40;

  return (
    <div
      ref={setNodeRef}
      {...(interactive ? dragPointerListeners || {} : {})}
      {...(interactive ? dragAttributes || {} : {})}
      role="button"
      tabIndex={interactive ? 0 : -1}
      aria-label={`Open note ${title || body.slice(0, 40) || '(untitled)'}`}
      data-id={note.id}
      data-dragging={isDragging || undefined}
      onClick={interactive ? open : undefined}
      onKeyDown={interactive ? onKeyDown : undefined}
      className="note-card"
      style={{
        background: color.bg,
        color: CARD_TEXT,
        borderRadius: RADIUS,
        border: '1px solid var(--border2)',
        padding: '12px 12px 6px',
        cursor: draggable ? 'grab' : 'default',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        transform: (style && style.transform) || undefined,
        transition: (style && style.transition) || 'box-shadow 0.15s ease',
        boxShadow: isDragging ? '0 8px 24px rgba(0,0,0,0.4)' : 'none',
        position: 'relative',
        minHeight: 40,
        opacity: isDragging ? 0.35 : 1,
        outline: isDragging ? '2px dashed var(--border2)' : undefined,
        outlineOffset: 2,
      }}
    >
      {(title || note.isPinned) && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: body ? 4 : 8 }}>
          <div style={{
            flex: 1, fontSize: 14, fontWeight: 600, lineHeight: 1.4,
            wordBreak: 'break-word', whiteSpace: 'pre-wrap',
          }}>
            <Highlighted text={title} query={query} />
          </div>
          {dragHandleListeners && (
            <button
              type="button"
              {...dragHandleListeners}
              aria-label="Reorder note. Press space to pick up, arrow keys to move, space to drop."
              title="Drag to reorder"
              onClick={e => e.stopPropagation()}
              style={{ ...iconBtn, cursor: 'grab', color: 'transparent', width: 24, height: 24 }}
              onMouseEnter={e => { e.currentTarget.style.color = 'rgba(232,234,240,0.4)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'transparent'; }}
            >
              <Icon name="drag" size={18} />
            </button>
          )}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onPin(note.id, !note.isPinned); }}
            aria-label={note.isPinned ? 'Unpin note' : 'Pin note'}
            aria-pressed={!!note.isPinned}
            title={note.isPinned ? 'Unpin' : 'Pin'}
            style={{ ...iconBtn, color: note.isPinned ? color.chip : CARD_MUTED, width: 28, height: 28 }}
            onMouseEnter={btnHover}
            onMouseLeave={btnOut}
          >
            <Icon name={note.isPinned ? 'pinFilled' : 'pin'} size={17} />
          </button>
        </div>
      )}

      {body && (
        <div style={{
          fontSize: 13, lineHeight: '20px', whiteSpace: 'pre-wrap',
          wordBreak: 'break-word', maxHeight: previewMax, overflow: 'hidden',
          marginBottom: 6,
        }}>
          <Highlighted text={body} query={query} />
        </div>
      )}
      {!title && !body && (
        <div style={{ fontSize: 13, color: CARD_MUTED, fontStyle: 'italic', padding: '8px 0 12px' }}>Empty note</div>
      )}

      {(view === 'list' || body || title) && (
        <div style={{ fontSize: 10.5, color: CARD_MUTED, margin: '2px 0 6px' }}>
          {formatEdited(note.updatedAt)}
        </div>
      )}

      <div className="card-actions" style={{
        display: 'flex', alignItems: 'center', gap: 2,
      }}>
        {collection !== 'trash' && (
          <>
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setMenu(menu === 'color' ? null : 'color'); }}
                aria-label="Background color options" aria-expanded={menu === 'color'}
                title="Background options" style={iconBtn}
                onMouseEnter={btnHover} onMouseLeave={btnOut}
              >
                <Icon name="palette" size={17} />
              </button>
              {menu === 'color' && (
                <NoteColorPicker
                  value={note.color}
                  onSelect={(key) => { onColor(note.id, key); setMenu(null); }}
                  onClose={() => setMenu(null)}
                />
              )}
            </div>

            {collection === 'archive' ? (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onArchive(note.id, false); }}
                aria-label="Unarchive note" title="Unarchive" style={iconBtn}
                onMouseEnter={btnHover} onMouseLeave={btnOut}
              >
                <Icon name="archiveOut" size={17} />
              </button>
            ) : (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onArchive(note.id, true); }}
                aria-label="Archive note" title="Archive" style={iconBtn}
                onMouseEnter={btnHover} onMouseLeave={btnOut}
              >
                <Icon name="archive" size={17} />
              </button>
            )}

            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onTrash(note.id); }}
              aria-label="Delete note" title="Delete" style={iconBtn}
              onMouseEnter={btnHover} onMouseLeave={btnOut}
            >
              <Icon name="trash" size={17} />
            </button>
          </>
        )}

        {collection === 'trash' && (
          <>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onRestore(note.id); }}
              aria-label="Restore note from trash" title="Restore" style={iconBtn}
              onMouseEnter={btnHover} onMouseLeave={btnOut}
            >
              <Icon name="restore" size={17} />
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onDeleteForever(note.id); }}
              aria-label="Delete note forever" title="Delete forever" style={{ ...iconBtn, color: 'rgba(248,113,113,0.75)' }}
              onMouseEnter={btnHover} onMouseLeave={btnOut}
            >
              <Icon name="trashForever" size={17} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function NoteCard(props) {
  const { note, draggable = true, ...rest } = props;
  const {
    attributes, listeners, setNodeRef, transform: sortableTransform,
    transition, isDragging,
  } = useSortable({ id: note.id, disabled: !draggable });

  const pointerListeners = (draggable && listeners)
    ? { onPointerDown: listeners.onPointerDown, onTouchStart: listeners.onTouchStart }
    : {};
  const handleListeners = (draggable && listeners) ? listeners : undefined;

  return (
    <CardShell
      {...rest}
      note={note}
      setNodeRef={setNodeRef}
      dragAttributes={attributes}
      dragPointerListeners={pointerListeners}
      dragHandleListeners={handleListeners}
      isDragging={isDragging}
      style={{
        transform: isDragging ? undefined : CSS.Translate.toString(sortableTransform),
        transition: isDragging ? 'none' : transition,
      }}
    />
  );
}

function areEqual(prev, next) {
  return (
    prev.note === next.note &&
    prev.query === next.query &&
    prev.view === next.view &&
    prev.collection === next.collection &&
    prev.draggable === next.draggable
  );
}

export default memo(NoteCard, areEqual);
