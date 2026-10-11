// Thin axios wrapper around the notes API. All requests rely on the
// Authorization header already set by AuthContext and the CRA dev proxy
// (or same-origin in production).
import axios from 'axios';

const unwrap = res => res.data;

export function fetchNotes() {
  return axios.get('/api/notes').then(unwrap);
}

export function createNoteApi(payload) {
  return axios.post('/api/notes', payload).then(unwrap);
}

export function updateNoteApi(id, payload) {
  return axios.put(`/api/notes/${id}`, payload).then(unwrap);
}

export function reorderApi(order) {
  return axios.post('/api/notes/reorder', { order }).then(unwrap);
}

export function deleteNoteApi(id) {
  return axios.delete(`/api/notes/${id}`).then(unwrap);
}

export function emptyTrashApi() {
  return axios.delete('/api/notes/trash').then(unwrap);
}

// Last-resort flush used on pagehide: fetch keepalive lets the request
// outlive the page so pending edits are not silently discarded.
export function updateNoteKeepalive(id, payload, token) {
  try {
    return fetch(`/api/notes/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
      keepalive: true,
    });
  } catch {
    return Promise.resolve();
  }
}
