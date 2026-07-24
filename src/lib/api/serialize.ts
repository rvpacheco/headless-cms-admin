// Shapes an Entry into the public read-API JSON. Both content routes use this
// so the single-entry and list responses stay identical.
//
// Entry data is nested under `data` (keyed by field name) rather than flattened
// onto the envelope: field names are arbitrary user input, so a field named
// `id` or `createdAt` would otherwise collide with envelope keys.
//
// Reference field values are returned as their raw target id — truthful to
// storage and unambiguous. (A future `?expand=` option could resolve them.)

import type { Entry, EntryData, Schema } from '@/lib/domain/types';

export interface SerializedEntry {
  id: string;
  type: string;
  data: EntryData;
  schemaVersion: number;
  createdAt: string;
  updatedAt: string;
}

export function serializeEntry(schema: Schema, entry: Entry): SerializedEntry {
  return {
    id: entry.id,
    type: schema.name,
    data: entry.data,
    schemaVersion: entry.schemaVersion,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  };
}
