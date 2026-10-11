// Notes canvas: responsive masonry grid + list layouts with Pinned/Others
// sections and full drag-and-drop reordering (mouse, touch and keyboard).
//
// Ordering model: one flattened order per section (pinned / others).
// Columns are a rendering detail derived from that order; drag operations
// reorder the flattened arrays and are persisted on drop.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext, DragOverlay, PointerSensor, TouchSensor, KeyboardSensor,
  useSensor, useSensors, MeasuringStrategy, pointerWithin, useDroppable,
} from '@dnd-kit/core';
import {
  SortableContext, rectSortingStrategy, verticalListSortingStrategy,
  sortableKeyboardCoordinates, arrayMove,
} from '@dnd-kit/sortable';
import NoteCard, { CardShell } from './NoteCard';
import { GAP, MIN_CARD_WIDTH } from './notesTheme';
import { columnsForWidth, splitIntoColumns } from './notesUtils';

function SectionDroppable({ id, children }) {
  const { setNodeRef, isOver } = useDroppable({ id, data: { section: id } });
  return (
    <div
      ref={setNodeRef}
      style={{
        minHeight: 8, borderRadius: 8, transition: 'background 0.12s',
        background: isOver ? 'rgba(79,142,247,0.05)' : 'transparent',
      }}
    >
      {children}
    </div>
  );
}

function MasonryColumns({ ids, notesById, cols, width, query, collection, draggable, handlers }) {
  const colWidth = cols > 1 ? Math.floor((width - GAP * (cols - 1)) / cols) : width;
  const ordered = ids.map(id => notesById[id]).filter(Boolean);
  const columns = splitIntoColumns(ordered, cols, colWidth);

  return (
    <div style={{ display: 'flex', gap: GAP, alignItems: 'flex-start' }}>
      {columns.map((col, ci) => (
        <div key={ci} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: GAP }}>
          {col.map(({ note }) => (
            <NoteCard
              key={note.id}
              note={note}
              query={query}
              view="grid"
              collection={collection}
              draggable={draggable}
              {...handlers}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function ListRows({ ids, notesById, query, collection, draggable, handlers }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: GAP }}>
      {ids.map(id => {
        const note = notesById[id];
        if (!note) return null;
        return (
          <NoteCard
            key={note.id}
            note={note}
            query={query}
            view="list"
            collection={collection}
            draggable={draggable}
            {...handlers}
          />
        );
      })}
    </div>
  );
}

export default function NotesCanvas({
  notes,               // collection-filtered, sorted (pinned first for the Notes view)
  view,                // 'grid' | 'list'
  collection,
  query,
  draggable,           // DnD enabled (main Notes collection only)
  handlers,
  onCommitOrder,       // (pinnedIds, otherIds) => void
}) {
  const containerRef = useRef(null);
  const [width, setWidth] = useState(0);
  const [drag, setDrag] = useState(null); // { activeId, pinned, others, changed }
  const [overlayWidth, setOverlayWidth] = useState(280);

  const cols = view === 'grid' ? columnsForWidth(width, MIN_CARD_WIDTH) : 1;

  // Measure canvas width → drives the column count (responsive masonry).
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let raf = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setWidth(el.clientWidth));
    });
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => { ro.disconnect(); cancelAnimationFrame(raf); };
  }, []);

  const notesById = useMemo(() => {
    const map = {};
    notes.forEach(n => { map[n.id] = n; });
    return map;
  }, [notes]);

  const basePinned = useMemo(() => notes.filter(n => n.isPinned).map(n => n.id), [notes]);
  const baseOthers = useMemo(() => notes.filter(n => !n.isPinned).map(n => n.id), [notes]);
  const pinned = drag ? drag.pinned : basePinned;
  const others = drag ? drag.others : baseOthers;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const findSection = useCallback((id) => {
    if (pinned.includes(id)) return 'pinned';
    if (others.includes(id)) return 'others';
    return null;
  }, [pinned, others]);

  const onDragStart = useCallback((event) => {
    const activeId = event.active.id;
    const node = document.querySelector(`[data-id="${activeId}"]`);
    if (node) setOverlayWidth(node.getBoundingClientRect().width);
    setDrag({ activeId, pinned: [...basePinned], others: [...baseOthers], changed: false });
  }, [basePinned, baseOthers]);

  const onDragOver = useCallback((event) => {
    const { active, over } = event;
    if (!over || !drag) return;
    const activeId = active.id;
    const overId = over.id;
    if (activeId === overId) return;

    const activeSection = findSection(activeId);
    if (!activeSection) return;

    const next = { pinned: [...pinned], others: [...others] };
    const isSectionId = overId === 'section-pinned' || overId === 'section-others';
    const targetSection = isSectionId
      ? (overId === 'section-pinned' ? 'pinned' : 'others')
      : findSection(overId);
    if (!targetSection) return;

    if (activeSection === targetSection) {
      const arr = next[activeSection];
      const fromIndex = arr.indexOf(activeId);
      const toIndex = isSectionId ? arr.length - 1 : arr.indexOf(overId);
      if (fromIndex === -1 || toIndex === -1) return;
      next[activeSection] = arrayMove(arr, fromIndex, toIndex);
    } else {
      const fromArr = next[activeSection];
      const fromIndex = fromArr.indexOf(activeId);
      if (fromIndex === -1) return;
      fromArr.splice(fromIndex, 1);
      const insertArr = next[targetSection];
      const idx = isSectionId ? insertArr.length : insertArr.indexOf(overId);
      insertArr.splice(Math.max(0, Math.min(idx, insertArr.length)), 0, activeId);
    }

    const changed = next.pinned.join(',') !== basePinned.join(',') ||
      next.others.join(',') !== baseOthers.join(',');
    if (changed || drag.changed) setDrag({ activeId: drag.activeId, pinned: next.pinned, others: next.others, changed });
  }, [drag, findSection, pinned, others, basePinned, baseOthers]);

  const finishDrag = useCallback((cancelled = false) => {
    if (!drag) { setDrag(null); return; }
    if (!cancelled && drag.changed) onCommitOrder(drag.pinned, drag.others);
    setDrag(null);
  }, [drag, onCommitOrder]);

  const strategy = view === 'list' ? verticalListSortingStrategy : rectSortingStrategy;
  const showSections = collection === 'notes';

  const renderItems = (ids) => (
    <SortableContext items={ids} strategy={strategy}>
      {view === 'grid' ? (
        <MasonryColumns
          ids={ids} notesById={notesById} cols={cols} width={width}
          query={query} collection={collection} draggable={draggable} handlers={handlers}
        />
      ) : (
        <ListRows
          ids={ids} notesById={notesById} query={query}
          collection={collection} draggable={draggable} handlers={handlers}
        />
      )}
    </SortableContext>
  );

  const label = {
    fontSize: 11, fontWeight: 600, letterSpacing: 0.8, color: 'var(--muted)',
    textTransform: 'uppercase', margin: '2px 0 10px 2px',
  };

  return (
    <div ref={containerRef} style={{ minWidth: 0 }}>
      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={() => finishDrag(false)}
        onDragCancel={() => finishDrag(true)}
      >
        {showSections && pinned.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <div style={label}>Pinned</div>
            <SectionDroppable id="section-pinned">
              {renderItems(pinned)}
            </SectionDroppable>
          </div>
        )}

        {showSections && pinned.length > 0 && <div style={{ ...label, marginTop: 4 }}>Others</div>}
        <SectionDroppable id="section-others">
          {showSections
            ? renderItems(others)
            : renderItems(notes.map(n => n.id))}
        </SectionDroppable>

        <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)' }}>
          {drag && notesById[drag.activeId] ? (
            <div style={{ width: overlayWidth, opacity: 0.95, pointerEvents: 'none', transform: 'rotate(1.5deg)' }}>
              <CardShell
                note={notesById[drag.activeId]}
                view={view}
                collection={collection}
                interactive={false}
                {...handlers}
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
