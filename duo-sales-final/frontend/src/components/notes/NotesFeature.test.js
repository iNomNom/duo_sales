// Integration tests for the notes feature UI (create, edit, collections,
// search). axios is mocked; the store and components run for real.
import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import NotesFeature from './NotesFeature';
import axios from 'axios';

jest.mock('axios');

let seq = 100;
const serverNote = (body, id = ++seq) => ({
  id,
  title: body.title || '',
  body: body.body || '',
  color: body.color || 'default',
  isPinned: !!body.isPinned,
  isArchived: !!body.isArchived,
  isTrashed: !!body.isTrashed,
  sortOrder: 0,
  createdAt: '2026-06-01T10:00:00.000Z',
  updatedAt: '2026-06-01T10:00:00.000Z',
});

beforeEach(() => {
  seq = 100;
  localStorage.clear();
  axios.get.mockReset();
  axios.post.mockReset();
  axios.put.mockReset();
  axios.delete.mockReset();
  axios.get.mockResolvedValue({ data: [] });
  axios.post.mockImplementation((url, payload) =>
    Promise.resolve({ data: serverNote(payload) }));
  axios.put.mockImplementation((url, payload) => {
    const id = Number(url.split('/').pop());
    return Promise.resolve({ data: serverNote({ ...payload }, id) });
  });
  axios.delete.mockResolvedValue({ data: { message: 'ok' } });
});

async function renderNotes() {
  const utils = render(<NotesFeature />);
  await waitFor(() => expect(axios.get).toHaveBeenCalledWith('/api/notes'));
  // Let the loaded state settle into the DOM before returning.
  await waitFor(() => expect(utils.container.querySelector('.note-card, [role="status"]')).toBeTruthy());
  return utils;
}

test('renders the composer and empty state when there are no notes', async () => {
  await renderNotes();
  expect(screen.getByText('Take a note…')).toBeInTheDocument();
  expect(await screen.findByText('Notes you add appear here')).toBeInTheDocument();
});

test('creates a note through the editor: close flushes a single POST', async () => {
  await renderNotes();

  fireEvent.click(screen.getByRole('button', { name: /take a note/i }));
  const dialog = await screen.findByRole('dialog', { name: /new note/i });
  expect(dialog).toBeInTheDocument();

  const title = within(dialog).getByLabelText('Note title');
  const body = within(dialog).getByLabelText('Note body');
  fireEvent.change(title, { target: { value: 'Ideas' } });
  fireEvent.change(body, { target: { value: 'Build a treehouse' } });

  fireEvent.click(within(dialog).getByRole('button', { name: /done/i }));

  await waitFor(() => expect(axios.post).toHaveBeenCalledTimes(1));
  const [url, payload] = axios.post.mock.calls[0];
  expect(url).toBe('/api/notes');
  expect(payload.title).toBe('Ideas');
  expect(payload.body).toBe('Build a treehouse');

  // The card appears in the canvas
  await waitFor(() => expect(screen.getByText('Build a treehouse')).toBeInTheDocument());
});

test('closing an untouched empty editor creates nothing', async () => {
  await renderNotes();
  fireEvent.click(screen.getByRole('button', { name: /take a note/i }));
  const dialog = await screen.findByRole('dialog', { name: /new note/i });
  fireEvent.click(within(dialog).getByRole('button', { name: /done/i }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(axios.post).not.toHaveBeenCalled();
});

test('existing notes load, open for editing, and autosave on close', async () => {
  axios.get.mockResolvedValue({
    data: [serverNote({ title: 'Groceries', body: 'milk' }, 7)],
  });
  await renderNotes();

  fireEvent.click(await screen.findByText('milk'));
  const dialog = await screen.findByRole('dialog', { name: /edit note/i });
  const bodyInput = within(dialog).getByLabelText('Note body');
  fireEvent.change(bodyInput, { target: { value: 'milk and honey' } });
  fireEvent.click(within(dialog).getByRole('button', { name: /done/i }));

  await waitFor(() => expect(axios.put).toHaveBeenCalled());
  const [url, payload] = axios.put.mock.calls[0];
  expect(url).toBe('/api/notes/7');
  expect(payload.body).toBe('milk and honey');
});

test('collection switching shows the right empty states', async () => {
  await renderNotes();
  fireEvent.click(screen.getByRole('button', { name: 'Archive' }));
  expect(await screen.findByText('Your archived notes appear here')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Trash' }));
  expect(await screen.findByText('No notes in Trash')).toBeInTheDocument();
});

test('search filters within the current collection and shows a no-results state', async () => {
  axios.get.mockResolvedValue({
    data: [
      serverNote({ title: 'Groceries', body: 'milk' }, 1),
      serverNote({ title: 'Work', body: 'email the team' }, 2),
    ],
  });
  await renderNotes();

  const input = screen.getByPlaceholderText(/search in notes/i);
  fireEvent.change(input, { target: { value: 'milk' } });
  expect(await screen.findByText(/showing results for/i)).toBeInTheDocument();
  expect(screen.getByText('Groceries')).toBeInTheDocument();
  expect(screen.queryByText('email the team')).not.toBeInTheDocument();

  fireEvent.change(input, { target: { value: 'zzz-not-there' } });
  expect(await screen.findByText(/no notes match/i)).toBeInTheDocument();
});

test('pin action persists and the Pinned section appears', async () => {
  axios.get.mockResolvedValue({
    data: [serverNote({ title: 'A', body: 'note a' }, 1)],
  });
  await renderNotes();

  const pinBtn = await screen.findByRole('button', { name: /pin note/i });
  fireEvent.click(pinBtn);
  await waitFor(() => expect(axios.put).toHaveBeenCalledWith('/api/notes/1', expect.objectContaining({ isPinned: true })));
  expect(await screen.findByText('Pinned')).toBeInTheDocument();
});

test('trash then restore round-trips through the API', async () => {
  axios.get.mockResolvedValue({
    data: [serverNote({ title: 'Doomed', body: 'bye' }, 5)],
  });
  await renderNotes();

  fireEvent.click(screen.getByRole('button', { name: /delete note/i }));
  await waitFor(() => expect(axios.put).toHaveBeenCalledWith('/api/notes/5', expect.objectContaining({ isTrashed: true })));

  // toast offers undo
  const undo = await screen.findByRole('button', { name: /undo/i });
  fireEvent.click(undo);
  await waitFor(() =>
    expect(axios.put).toHaveBeenCalledWith('/api/notes/5', expect.objectContaining({ isTrashed: false }))
  );
});

test('grid/list toggle persists the choice', async () => {
  await renderNotes();
  fireEvent.click(screen.getByRole('button', { name: /list view/i }));
  await waitFor(() => expect(localStorage.getItem('duo_notes_view')).toBe('list'));
  fireEvent.click(screen.getByRole('button', { name: /grid view/i }));
  await waitFor(() => expect(localStorage.getItem('duo_notes_view')).toBe('grid'));
});
