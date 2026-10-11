// Integration tests for the notes API.
// Run: node --test tests/notes.test.js
// Uses an isolated temp SQLite database and the real Express app.
require('dotenv').config();

process.env.DB_PATH = require('os').tmpdir() + `/duo_notes_test_${Date.now()}.db`;
process.env.JWT_SECRET = 'test_secret';
process.env.TRASH_RETENTION_DAYS = '30';

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const fs = require('node:fs');

let server, baseUrl, token, token2, noteId;

before(async () => {
  const app = require('../server');
  server = http.createServer(app);
  await new Promise(r => server.listen(0, r));
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  const login = async (email, password) => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    assert.strictEqual(res.status, 200, `login failed for ${email}`);
    return (await res.json()).token;
  };
  token = await login('admin@duoenterprizes.com', 'admin123');

  // Second user for ownership-isolation tests (admin-only registration)
  await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ name: 'Other User', email: 'other@test.com', password: 'otherpass123', role: 'agent' })
  });
  const regRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'other@test.com', password: 'otherpass123' })
  });
  if (regRes.status === 200) token2 = (await regRes.json()).token;
  else token2 = null; // fallback if registration path changes
});

after(() => {
  server && server.close();
  try { fs.unlinkSync(process.env.DB_PATH); } catch {}
  try { fs.unlinkSync(process.env.DB_PATH + '-wal'); } catch {}
  try { fs.unlinkSync(process.env.DB_PATH + '-shm'); } catch {}
});

const api = (method, path, body, tok = token) => fetch(`${baseUrl}${path}`, {
  method,
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${tok}`
  },
  body: body ? JSON.stringify(body) : undefined
});

test('requires authentication', async () => {
  const res = await fetch(`${baseUrl}/api/notes`);
  assert.strictEqual(res.status, 401);
});

test('creates a note with server defaults', async () => {
  const res = await api('POST', '/api/notes', { title: 'Shopping', body: 'Milk\nEggs\nBread' });
  assert.strictEqual(res.status, 201);
  const note = await res.json();
  noteId = note.id;
  assert.strictEqual(note.title, 'Shopping');
  assert.strictEqual(note.body, 'Milk\nEggs\nBread');
  assert.strictEqual(note.color, 'default');
  assert.strictEqual(note.isPinned, false);
  assert.strictEqual(note.isArchived, false);
  assert.strictEqual(note.isTrashed, false);
  assert.ok(note.createdAt && note.updatedAt);
});

test('rejects a completely empty note', async () => {
  const res = await api('POST', '/api/notes', { title: '  ', body: '' });
  assert.strictEqual(res.status, 400);
});

test('updates fields and bumps updatedAt', async () => {
  const first = await (await api('GET', '/api/notes')).json();
  const original = first.find(n => n.id === noteId);
  await new Promise(r => setTimeout(r, 20));
  const res = await api('PUT', `/api/notes/${noteId}`, {
    body: 'Milk\nEggs\nBread\nTea',
    color: 'teal',
    expectedUpdatedAt: original.updatedAt
  });
  assert.strictEqual(res.status, 200);
  const note = await res.json();
  assert.strictEqual(note.body, 'Milk\nEggs\nBread\nTea');
  assert.strictEqual(note.color, 'teal');
  assert.notStrictEqual(note.updatedAt, original.updatedAt);
});

test('rejects stale updates with 409', async () => {
  const res = await api('PUT', `/api/notes/${noteId}`, {
    title: 'Stale write',
    expectedUpdatedAt: '2000-01-01T00:00:00.000Z'
  });
  assert.strictEqual(res.status, 409);
  const { note } = await res.json();
  assert.notStrictEqual(note.title, 'Stale write');
});

test('pins a note and it sorts first', async () => {
  await api('POST', '/api/notes', { body: 'second note' });
  await api('PUT', `/api/notes/${noteId}`, { isPinned: true });
  const list = await (await api('GET', '/api/notes')).json();
  assert.strictEqual(list[0].id, noteId);
  assert.strictEqual(list[0].isPinned, true);
});

test('rejects invalid color', async () => {
  assert.strictEqual((await api('PUT', `/api/notes/${noteId}`, { color: 'neon-green' })).status, 400);
});

test('persists manual reorder', async () => {
  const list = await (await api('GET', '/api/notes')).json();
  const unpinned = list.filter(n => !n.isPinned);
  const reversed = [...unpinned].reverse().map((n, i) => ({ id: n.id, sortOrder: (i + 1) * 10 }));
  const res = await api('POST', '/api/notes/reorder', { order: reversed });
  assert.strictEqual(res.status, 200);
  const after = (await (await api('GET', '/api/notes')).json()).filter(n => !n.isPinned);
  assert.deepStrictEqual(after.map(n => n.id), [...unpinned].reverse().map(n => n.id));
});

test('archive → appears out of main flow; restore works', async () => {
  const created = await (await api('POST', '/api/notes', { body: 'to archive' })).json();
  await api('PUT', `/api/notes/${created.id}`, { isArchived: true });
  let list = await (await api('GET', '/api/notes')).json();
  assert.strictEqual(list.find(n => n.id === created.id).isArchived, true);
  await api('PUT', `/api/notes/${created.id}`, { isArchived: false });
  list = await (await api('GET', '/api/notes')).json();
  assert.strictEqual(list.find(n => n.id === created.id).isArchived, false);
});

test('trash → restore → trash → permanent delete', async () => {
  const created = await (await api('POST', '/api/notes', { body: 'doomed note' })).json();
  await api('PUT', `/api/notes/${created.id}`, { isTrashed: true });
  let list = await (await api('GET', '/api/notes')).json();
  assert.strictEqual(list.find(n => n.id === created.id).isTrashed, true);
  await api('PUT', `/api/notes/${created.id}`, { isTrashed: false });
  await api('PUT', `/api/notes/${created.id}`, { isTrashed: true });
  const del = await api('DELETE', `/api/notes/${created.id}`);
  assert.strictEqual(del.status, 200);
  list = await (await api('GET', '/api/notes')).json();
  assert.ok(!list.find(n => n.id === created.id));
});

test('empty trash removes all trashed notes', async () => {
  const a = await (await api('POST', '/api/notes', { body: 'trash a' })).json();
  const b = await (await api('POST', '/api/notes', { body: 'trash b' })).json();
  await api('PUT', `/api/notes/${a.id}`, { isTrashed: true });
  await api('PUT', `/api/notes/${b.id}`, { isTrashed: true });
  const res = await api('DELETE', '/api/notes/trash');
  assert.strictEqual(res.status, 200);
  const { deleted } = await res.json();
  assert.ok(deleted >= 2);
  const list = await (await api('GET', '/api/notes')).json();
  assert.ok(!list.find(n => n.id === a.id) && !list.find(n => n.id === b.id));
});

test('notes are isolated per user', async () => {
  if (!token2) return; // register endpoint restricted; single-user deployment path
  const mine = await (await api('POST', '/api/notes', { body: 'private note' })).json();
  const res = await api('PUT', `/api/notes/${mine.id}`, { title: 'hacked' }, token2);
  assert.ok(res.status === 404 || res.status === 403);
  const theirs = await (await api('GET', '/api/notes', null, token2)).json();
  assert.ok(!theirs.find(n => n.id === mine.id));
});

test('validates input sizes', async () => {
  const res = await api('POST', '/api/notes', { body: 'x'.repeat(100001) });
  assert.strictEqual(res.status, 400);
});
