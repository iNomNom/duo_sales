# Notes Feature (Google Keep–style)

A plain-text notes feature embedded in the Duo Sales platform, closely modeled
on Google Keep's layout, interactions and behavior. It is reachable at
**/notes** via the “Notes” item in the app sidebar.

## Scope

Plain text only: title (optional), body (optional), background color, pin,
archive, trash, manual ordering. No checklists,
images, drawings, or attachments by design.

## Where things live

```
backend/
  models/db.js            notes table + indexes (auto-created on startup)
  routes/notes.js         REST API: CRUD, reorder, empty trash, retention purge
  tests/notes.test.js     integration tests (node --test tests/notes.test.js)
frontend/src/
  pages/Notes.js          route target
  components/notes/
    NotesFeature.js       page container (collections, search, toasts)
    NotesSidebar.js       Notes / Archive / Trash navigation
    NotesToolbar.js       search (Ctrl/Cmd+F), grid/list toggle, refresh
    NotesCanvas.js        masonry grid + list layouts, drag-and-drop
    NoteCard.js           card (pin, color, archive, trash actions)
    NoteEditor.js         modal editor with autosave + focus management
    NoteComposer.js       collapsed “Take a note…” bar
    NoteColorPicker.js    10-color Keep-inspired palette (dark-theme tuned)
    useNotes.js           state store: optimistic updates, debounced autosave,
                          stale-response protection, flush on close/hide/unload
    notesApi.js           axios API layer (+ keepalive flush on page hide)
    notesUtils.js         pure helpers (ordering, search, masonry)
    notesTheme.js         design tokens shared with the app's CSS variables
```

## API

| Method | Path                 | Purpose                                    |
|--------|----------------------|--------------------------------------------|
| GET    | /api/notes           | All notes for the signed-in user           |
| POST   | /api/notes           | Create (rejects fully empty notes)         |
| PUT    | /api/notes/:id       | Partial update; optional `expectedUpdatedAt` for optimistic concurrency (409 on stale) |
| POST   | /api/notes/reorder   | Persist manual order `{ order: [{id, sortOrder, isPinned}] }` |
| DELETE | /api/notes/trash     | Empty trash                                |
| DELETE | /api/notes/:id       | Permanently delete one note                |

All operations are scoped to `user_id` from the JWT — users can never see or
touch another user's notes.

## Persistence details

- Autosave: 600 ms debounce while typing; flushed on editor close, tab hide
  (`visibilitychange`) and page unload (fetch `keepalive`).
- New notes are created on first meaningful content — closing an empty draft
  creates nothing; emptying an existing note deletes it (Keep behavior).
- Ordering: pinned first, then `sort_order`, newest-edit tiebreak. Drag
  renumbering is deterministic and persisted server-side.
- Trash retention: notes trashed more than
  `TRASH_RETENTION_DAYS` (env var, default **30**) days are purged
  automatically when notes are loaded.

## Keyboard & accessibility

- Ctrl/Cmd + F focuses the notes search (while on the notes page).
- Escape closes the editor (changes are saved first).
- Tab reaches every control; Enter/Space activates; focus returns to the
  originating card or composer when the editor closes.
- Drag-and-drop has a keyboard alternative: focus a card's drag handle,
  press Space to lift, arrows to move, Space to drop.
- Icon-only buttons have aria-labels and tooltips; the drag pointer listener
  requires 6 px of travel (touch: 180 ms hold) so clicks and text never
  trigger drags accidentally.

## Tests

```
# backend (uses a throwaway SQLite db in tmp)
cd backend && node --test tests/notes.test.js

# frontend
cd frontend && CI=true npm test
```
