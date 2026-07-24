// The "readable label" for an entry. Entries have no fixed title field, so we
// derive a human-readable label with a deterministic heuristic. Used everywhere
// an entry must be shown as text: the entry list, reference pickers, and
// reference chips.
//
// NOTE: this is a heuristic. The productionized version would let the user
// designate a "display field" per schema in the builder; that is intentionally
// deferred (see priority-2 plan).

import type { Entry, Field, FieldValue, Schema } from './types';

const MAX_LABEL_LENGTH = 60;

function truncate(text: string): string {
  return text.length > MAX_LABEL_LENGTH
    ? `${text.slice(0, MAX_LABEL_LENGTH - 1)}…`
    : text;
}

/** Render a value as label text, or null if it is empty / unusable. */
function asLabelText(field: Field, value: FieldValue): string | null {
  if (value === null || value === undefined) return null;
  switch (field.type) {
    case 'text':
    case 'date': {
      const text = String(value).trim();
      return text === '' ? null : text;
    }
    case 'number':
      return Number.isFinite(value as number) ? String(value) : null;
    case 'boolean':
      return value ? 'Yes' : 'No';
    case 'reference':
      // References are ids, not readable, and could recurse — never a label.
      return null;
  }
}

export function entryLabel(schema: Schema, entry: Entry): string {
  // 1. First text field (in schema order) with a non-empty value.
  for (const field of schema.fields) {
    if (field.type !== 'text') continue;
    const text = asLabelText(field, entry.data[field.name]);
    if (text) return truncate(text);
  }

  // 2. First non-reference field with a non-empty value.
  for (const field of schema.fields) {
    if (field.type === 'reference') continue;
    const text = asLabelText(field, entry.data[field.name]);
    if (text) return truncate(text);
  }

  // 3. Fallback: a stable, recognizable id-based label.
  return `Entry ${entry.id.slice(0, 8)}`;
}
