import { randomUUID } from 'node:crypto';
import { db } from '@/lib/db';
import type { Entry, EntryData } from '@/lib/domain/types';

// Repository for entries. Like the schema repository, this is the only place
// rows are mapped to/from the typed domain model.

/** The shape of a row in the `entries` table (JSON columns still stringified). */
interface EntryRow {
  id: string;
  schema_id: string;
  schema_version: number;
  data: string;
  created_at: string;
  updated_at: string;
}

function rowToEntry(row: EntryRow): Entry {
  return {
    id: row.id,
    schemaId: row.schema_id,
    schemaVersion: row.schema_version,
    data: JSON.parse(row.data) as EntryData,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listEntries(schemaId: string): Entry[] {
  const rows = db
    .prepare(
      'SELECT * FROM entries WHERE schema_id = ? ORDER BY created_at DESC',
    )
    .all(schemaId) as EntryRow[];
  return rows.map(rowToEntry);
}

export function getEntry(id: string): Entry | null {
  const row = db.prepare('SELECT * FROM entries WHERE id = ?').get(id) as
    | EntryRow
    | undefined;
  return row ? rowToEntry(row) : null;
}

/** Data needed to create an entry. Caller supplies the schema version it targets. */
export interface CreateEntryInput {
  schemaId: string;
  schemaVersion: number;
  data: EntryData;
}

export function createEntry(input: CreateEntryInput): Entry {
  const now = new Date().toISOString();
  const entry: Entry = {
    id: randomUUID(),
    schemaId: input.schemaId,
    schemaVersion: input.schemaVersion,
    data: input.data,
    createdAt: now,
    updatedAt: now,
  };

  db.prepare(
    `INSERT INTO entries (id, schema_id, schema_version, data, created_at, updated_at)
     VALUES (@id, @schemaId, @schemaVersion, @data, @createdAt, @updatedAt)`,
  ).run({ ...entry, data: JSON.stringify(entry.data) });

  return entry;
}

/**
 * Update an entry's data. `schemaVersion` is re-stamped so it records the
 * version the entry was last written against.
 */
export interface UpdateEntryInput {
  schemaVersion: number;
  data: EntryData;
}

export function updateEntry(
  id: string,
  input: UpdateEntryInput,
): Entry | null {
  const now = new Date().toISOString();
  const row = db
    .prepare(
      `UPDATE entries
         SET data = @data,
             schema_version = @schemaVersion,
             updated_at = @updatedAt
       WHERE id = @id
       RETURNING *`,
    )
    .get({
      id,
      data: JSON.stringify(input.data),
      schemaVersion: input.schemaVersion,
      updatedAt: now,
    }) as EntryRow | undefined;

  return row ? rowToEntry(row) : null;
}

export function deleteEntry(id: string): boolean {
  const result = db.prepare('DELETE FROM entries WHERE id = ?').run(id);
  return result.changes > 0;
}
