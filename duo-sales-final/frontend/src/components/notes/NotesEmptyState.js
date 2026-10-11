// Google Keep-style empty states with a small inline illustration.
import React from 'react';
import Icon from './icons';
import { COLLECTIONS } from './notesUtils';

const COPY = {
  notes: {
    icon: 'lightbulb',
    title: 'Notes you add appear here',
    body: 'Click “Take a note…” at the top to jot down your first thought.',
  },
  archive: {
    icon: 'archive',
    title: 'Your archived notes appear here',
    body: 'Archiving hides a note from the main view without deleting it.',
  },
  trash: {
    icon: 'trash',
    title: 'No notes in Trash',
    body: 'Notes you delete are kept here for 30 days before being removed forever.',
  },
  search: {
    icon: 'search',
    title: 'No matching notes',
    body: null, // body composed by the parent (includes the query)
  },
};

export default function NotesEmptyState({ variant = 'notes', query = '' }) {
  const copy = COPY[variant] || COPY.notes;
  return (
    <div role="status" style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', textAlign: 'center', padding: '72px 24px',
      color: 'var(--muted)', maxWidth: 420, margin: '0 auto',
    }}>
      <div aria-hidden="true" style={{
        width: 110, height: 110, borderRadius: '50%',
        background: 'var(--bg3)', display: 'flex', alignItems: 'center',
        justifyContent: 'center', marginBottom: 20,
      }}>
        <Icon name={copy.icon} size={44} />
      </div>
      <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text)', marginBottom: 6 }}>
        {copy.title}
      </div>
      <div style={{ fontSize: 13, lineHeight: 1.55 }}>
        {variant === 'search' ? <>No notes match “{query}” in this view.</> : copy.body}
      </div>
    </div>
  );
}

export function collectionLabel(collection) {
  return COLLECTIONS[collection] || 'Notes';
}
