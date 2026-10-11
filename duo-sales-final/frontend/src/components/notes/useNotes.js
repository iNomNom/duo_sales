// Notes state store: single source of truth for all notes, with optimistic
// updates, per-note debounced autosave, stale-response protection and
// last-resort flushes. Derived collections are computed by consumers from
// the flat map — never duplicated in state.
import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import {
  fetchNotes, createNoteApi, updateNoteApi, reorderApi, deleteNoteApi,
  emptyTrashApi, updateNoteKeepalive,
} from './notesApi';

const AUTOSAVE_DELAY = 600;
const SAVED_FLASH_MS = 1600;

const initial = { notes: {}, loading: true, error: null, saveState: {} };

function reducer(state, action) {
  switch (action.type) {
    case 'LOADING':
      return { ...state, loading: true, error: null };
    case 'LOADED': {
      const notes = {};
      action.notes.forEach(n => { notes[n.id] = n; });
      return { ...state, notes, loading: false, error: null };
    }
    case 'ERROR':
      return { ...state, loading: false, error: action.error || 'Something went wrong' };
    case 'UPSERT':
      return { ...state, notes: { ...state.notes, [action.note.id]: { ...state.notes[action.note.id], ...action.note } } };
    case 'PATCH': {
      const prev = state.notes[action.id];
      if (!prev) return state;
      const saveState = { ...state.saveState };
      if (action.saving) saveState[action.id] = 'saving';
      else if (action.saved) saveState[action.id] = 'saved';
      else if (action.saveState !== undefined) {
        if (action.saveState) saveState[action.id] = action.saveState;
        else delete saveState[action.id];
      }
      return { ...state, notes: { ...state.notes, [action.id]: { ...prev, ...action.patch } }, saveState };
    }
    case 'SAVE_STATE': {
      const saveState = { ...state.saveState };
      if (action.value) saveState[action.id] = action.value;
      else delete saveState[action.id];
      return { ...state, saveState };
    }
    case 'REMOVE': {
      const notes = { ...state.notes };
      delete notes[action.id];
      const saveState = { ...state.saveState };
      delete saveState[action.id];
      return { ...state, notes, saveState };
    }
    case 'REPLACE_ALL':
      return { ...state, notes: action.notes };
    default:
      return state;
  }
}

function readToken() {
  try { return localStorage.getItem('duo_token') || ''; } catch { return ''; }
}

export default function useNotes() {
  const [state, dispatch] = useReducer(reducer, initial);

  // Autosave machinery lives in refs — never in render state.
  const notesRef = useRef({});
  notesRef.current = state.notes;
  const pendingRef = useRef({});        // id -> { patch, timer }  (queued edits)
  const inflightRef = useRef({});       // id -> Promise (in-flight PUT)
  const sentFieldsRef = useRef({});     // id -> Set(fields sent, not yet applied)
  const creatingRef = useRef(null);     // draft creation promise (single POST)
  const mountedRef = useRef(true);

  useEffect(() => () => { mountedRef.current = false; }, []);

  const load = useCallback(async (silent = false) => {
    if (!silent) dispatch({ type: 'LOADING' });
    try {
      const notes = await fetchNotes();
      if (mountedRef.current) dispatch({ type: 'LOADED', notes });
      return notes;
    } catch (err) {
      if (mountedRef.current) dispatch({ type: 'ERROR', error: err?.response?.data?.error || 'Could not load notes' });
      return [];
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Core flush: send the newest accumulated patch for one note ───────────
  const flushNote = useCallback((id, { keepalive = false } = {}) => {
    const pending = pendingRef.current[id];
    if (!pending || inflightRef.current[id]) return inflightRef.current[id];
    clearTimeout(pending.timer);
    delete pendingRef.current[id];

    const note = notesRef.current[id];
    if (!note) return;
    const patch = {};
    Object.entries(pending.patch).forEach(([k, v]) => { if (v !== undefined) patch[k] = v; });
    if (Object.keys(patch).length === 0) return;

    const payload = { ...patch, expectedUpdatedAt: note.updatedAt };
    if (!sentFieldsRef.current[id]) sentFieldsRef.current[id] = new Set();
    Object.keys(patch).forEach(k => sentFieldsRef.current[id].add(k));

    const request = keepalive
      ? updateNoteKeepalive(id, payload, readToken())
      : updateNoteApi(id, payload);

    const promise = Promise.resolve(request)
      .then(serverNote => {
        if (!mountedRef.current || !serverNote || !serverNote.id) return;
        // Merge the server copy, but never clobber fields that were edited
        // (and are still being sent) after this request started.
        const sent = sentFieldsRef.current[id] || new Set();
        const merged = { ...serverNote };
        sent.forEach(k => { delete merged[k]; });
        const stillPending = pendingRef.current[id] && Object.keys(pendingRef.current[id].patch).length > 0;
        dispatch({ type: 'PATCH', id, patch: merged, saving: stillPending, saved: !stillPending });
        if (!stillPending) {
          sentFieldsRef.current[id] = new Set();
          dispatch({ type: 'SAVE_STATE', id, value: 'saved' });
          setTimeout(() => { if (mountedRef.current) dispatch({ type: 'SAVE_STATE', id, value: null }); }, SAVED_FLASH_MS);
        }
      })
      .catch(err => {
        if (!mountedRef.current) return;
        if (err && err.response && err.response.status === 409) {
          // Another writer saved in between → adopt the server copy for
          // fields the user is not actively editing.
          const serverNote = err.response.data && err.response.data.note;
          if (serverNote) {
            const merged = { ...serverNote };
            (sentFieldsRef.current[id] || new Set()).forEach(k => { delete merged[k]; });
            dispatch({ type: 'PATCH', id, patch: merged });
          }
        } else if (!err || !err.response) {
          dispatch({ type: 'SAVE_STATE', id, value: 'error' });
          dispatch({ type: 'ERROR', error: 'Offline — changes will retry on your next edit' });
        }
      })
      .finally(() => {
        delete inflightRef.current[id];
        if (pendingRef.current[id]) flushNote(id); // edits queued mid-flight
      });

    inflightRef.current[id] = promise;
    return promise;
  }, []);

  // ── Public: schedule a debounced autosave for an existing note ───────────
  const saveNote = useCallback((id, patch, { immediate = false } = {}) => {
    dispatch({ type: 'PATCH', id, patch, saving: true });
    const existing = pendingRef.current[id] || { patch: {} };
    clearTimeout(existing.timer);
    const merged = { ...existing.patch, ...patch };
    if (immediate) {
      pendingRef.current[id] = { patch: merged, timer: null };
      flushNote(id);
    } else {
      const timer = setTimeout(() => flushNote(id), AUTOSAVE_DELAY);
      pendingRef.current[id] = { patch: merged, timer };
    }
  }, [flushNote]);

  // ── Public: autosave the editor draft (create-on-first-content) ──────────
  // Guarantees a single POST even when autosave and close fire together.
  const saveDraft = useCallback((draft, { immediate = false, onCreated } = {}) => {
    const meaningful = (draft.title || '').trim() !== '' || (draft.body || '').trim() !== '' ||
      (draft.color && draft.color !== 'default') || !!draft.isPinned;
    const isTemp = typeof draft.id !== 'number';

    if (isTemp) {
      if (!meaningful) return Promise.resolve(null); // never create empty notes
      const payload = {
        title: draft.title || '', body: draft.body || '', color: draft.color || 'default',
        isPinned: !!draft.isPinned,
      };
      const run = () => createNoteApi(payload)
        .then(created => {
          if (mountedRef.current) {
            dispatch({ type: 'UPSERT', note: created });
            dispatch({ type: 'SAVE_STATE', id: created.id, value: 'saved' });
            setTimeout(() => { if (mountedRef.current) dispatch({ type: 'SAVE_STATE', id: created.id, value: null }); }, SAVED_FLASH_MS);
          }
          onCreated && onCreated(created);
          return created;
        })
        .catch(err => {
          if (mountedRef.current) dispatch({ type: 'ERROR', error: err?.response?.data?.error || 'Could not save note' });
          throw err;
        });

      if (!creatingRef.current) {
        creatingRef.current = run().finally(() => { creatingRef.current = null; });
      } else if (immediate) {
        // Close while creation is still in flight → chain the newest draft
        // content as an immediate update; still exactly one POST (no duplicates).
        const chained = creatingRef.current
          .then(created => {
            if (!created) return null;
            saveNote(created.id, {
              title: draft.title || '', body: draft.body || '', color: draft.color || 'default',
              isPinned: !!draft.isPinned,
            }, { immediate: true });
            return created;
          })
          .catch(() => {})
          .finally(() => { if (creatingRef.current === chained) creatingRef.current = null; });
        creatingRef.current = chained;
      }
      return creatingRef.current;
    }

    // Existing note → normal autosave path.
    saveNote(draft.id, {
      title: draft.title || '', body: draft.body || '', color: draft.color || 'default',
      isPinned: !!draft.isPinned,
    }, { immediate });
    return Promise.resolve(null);
  }, [saveNote]);

  // Wait until a pending draft creation settles (editor close).
  const awaitDraft = useCallback(async () => {
    if (creatingRef.current) { try { await creatingRef.current; } catch {} }
  }, []);

  // ── One-shot mutations with optimistic UI + rollback on failure ──────────
  const mutateNote = useCallback(async (id, patch) => {
    const prev = notesRef.current[id];
    dispatch({ type: 'PATCH', id, patch });
    const pending = pendingRef.current[id];
    if (pending) { clearTimeout(pending.timer); delete pendingRef.current[id]; }
    try {
      const serverNote = await updateNoteApi(id, patch);
      if (mountedRef.current) dispatch({ type: 'PATCH', id, patch: { ...serverNote }, saved: true });
      setTimeout(() => { if (mountedRef.current) dispatch({ type: 'SAVE_STATE', id, value: null }); }, SAVED_FLASH_MS);
      return serverNote;
    } catch (err) {
      if (mountedRef.current && prev) {
        dispatch({ type: 'PATCH', id, patch: { ...prev } });
        dispatch({ type: 'ERROR', error: err?.response?.data?.error || 'Could not update note' });
      }
      throw err;
    }
  }, []);

  const removeNote = useCallback(async (id) => {
    const prev = notesRef.current[id];
    dispatch({ type: 'REMOVE', id });
    try {
      await deleteNoteApi(id);
      return true;
    } catch (err) {
      if (mountedRef.current && prev) {
        dispatch({ type: 'UPSERT', note: prev });
        dispatch({ type: 'ERROR', error: err?.response?.data?.error || 'Could not delete note' });
      }
      return false;
    }
  }, []);

  const emptyTrash = useCallback(async () => {
    const all = notesRef.current;
    const trashed = Object.values(all).filter(n => n.isTrashed);
    dispatch({ type: 'REPLACE_ALL', notes: Object.fromEntries(
      Object.entries(all).filter(([, n]) => !n.isTrashed)
    ) });
    try {
      await emptyTrashApi();
      return true;
    } catch (err) {
      if (mountedRef.current) {
        trashed.forEach(n => dispatch({ type: 'UPSERT', note: n }));
        dispatch({ type: 'ERROR', error: err?.response?.data?.error || 'Could not empty trash' });
      }
      return false;
    }
  }, []);

  // ── Drag-and-drop persistence ─────────────────────────────────────────────
  const commitOrder = useCallback((pinnedIds, otherIds) => {
    const entries = [];
    pinnedIds.forEach((id, i) => entries.push({ id, sortOrder: (i + 1) * 10, isPinned: true }));
    otherIds.forEach((id, i) => entries.push({ id, sortOrder: (i + 1) * 10, isPinned: false }));

    const notes = { ...notesRef.current };
    entries.forEach(({ id, sortOrder, isPinned }) => {
      if (notes[id]) notes[id] = { ...notes[id], sortOrder, isPinned };
    });
    dispatch({ type: 'REPLACE_ALL', notes });

    reorderApi(entries)
      .catch(() => {
        dispatch({ type: 'ERROR', error: 'Could not save the new order' });
        load(true);
      });
  }, [load]);

  // Flush everything pending (editor close / tab hidden / unload).
  const flushAll = useCallback(({ keepalive = false } = {}) => {
    Object.keys(pendingRef.current).forEach(id => flushNote(id, { keepalive }));
  }, [flushNote]);

  // Flush when the tab is hidden; keepalive on final unload so pending
  // edits are not silently discarded.
  useEffect(() => {
    const onVisibility = () => { if (document.visibilityState === 'hidden') flushAll(); };
    const onPageHide = () => flushAll({ keepalive: true });
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, [flushAll]);

  return useMemo(() => ({
    notes: state.notes,
    loading: state.loading,
    error: state.error,
    saveState: state.saveState,
    load,
    saveNote,
    saveDraft,
    awaitDraft,
    mutateNote,
    removeNote,
    emptyTrash,
    commitOrder,
    flushAll,
    clearError: () => dispatch({ type: 'ERROR', error: null }),
  }), [state.notes, state.loading, state.error, state.saveState, load, saveNote, saveDraft, awaitDraft, mutateNote, removeNote, emptyTrash, commitOrder, flushAll]);
}
