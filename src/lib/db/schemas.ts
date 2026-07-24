import { randomUUID } from 'node:crypto';
import { db } from '@/lib/db';
import type { Field, Schema } from '@/lib/domain/types';

// Repository for schemas. This is the single place raw rows are mapped to/from
// the typed domain model, so the rest of the app only ever sees `Schema`.

/** The shape of a row in the `schemas` table (JSON columns still stringified). */
interface SchemaRow {
  id: string;
  name: string;
  version: number;
  fields: string;
  created_at: string;
  updated_at: string;
}

function rowToSchema(row: SchemaRow): Schema {
  return {
    id: row.id,
    name: row.name,
    version: row.version,
    fields: JSON.parse(row.fields) as Field[],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listSchemas(): Schema[] {
  const rows = db
    .prepare('SELECT * FROM schemas ORDER BY name')
    .all() as SchemaRow[];
  return rows.map(rowToSchema);
}

export function getSchema(id: string): Schema | null {
  const row = db.prepare('SELECT * FROM schemas WHERE id = ?').get(id) as
    | SchemaRow
    | undefined;
  return row ? rowToSchema(row) : null;
}

/**
 * Look up a schema by name, case-insensitively. Safe because schema names are
 * unique case-insensitively, so at most one row can match. Used by the read
 * API to resolve `{type}` (e.g. "car", "Car", "CAR" all match the "Car" schema).
 */
export function getSchemaByName(name: string): Schema | null {
  const row = db
    .prepare('SELECT * FROM schemas WHERE name = ? COLLATE NOCASE')
    .get(name) as SchemaRow | undefined;
  return row ? rowToSchema(row) : null;
}

/** Data needed to create a schema. Server assigns id, version, timestamps. */
export interface CreateSchemaInput {
  name: string;
  fields: Field[];
}

export function createSchema(input: CreateSchemaInput): Schema {
  const now = new Date().toISOString();
  const schema: Schema = {
    id: randomUUID(),
    name: input.name,
    fields: input.fields,
    version: 1,
    createdAt: now,
    updatedAt: now,
  };

  db.prepare(
    `INSERT INTO schemas (id, name, version, fields, created_at, updated_at)
     VALUES (@id, @name, @version, @fields, @createdAt, @updatedAt)`,
  ).run({ ...schema, fields: JSON.stringify(schema.fields) });

  return schema;
}

/** A structural edit: replaces name/fields and bumps `version` by one. */
export interface UpdateSchemaInput {
  name: string;
  fields: Field[];
}

export function updateSchema(
  id: string,
  input: UpdateSchemaInput,
): Schema | null {
  const now = new Date().toISOString();
  const row = db
    .prepare(
      `UPDATE schemas
         SET name = @name,
             fields = @fields,
             version = version + 1,
             updated_at = @updatedAt
       WHERE id = @id
       RETURNING *`,
    )
    .get({
      id,
      name: input.name,
      fields: JSON.stringify(input.fields),
      updatedAt: now,
    }) as SchemaRow | undefined;

  return row ? rowToSchema(row) : null;
}

export function deleteSchema(id: string): boolean {
  const result = db.prepare('DELETE FROM schemas WHERE id = ?').run(id);
  return result.changes > 0;
}
