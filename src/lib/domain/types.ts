// The core domain model for the CMS: Schemas, their typed Fields, and Entries.
// These types are pure and dependency-free — everything else builds on them.

export type FieldType = 'text' | 'number' | 'boolean' | 'date' | 'reference';

/** Properties common to every field, regardless of its type. */
interface FieldBase {
  /** Stable identity that survives renames. Used for schema-evolution diffing. */
  id: string;
  /** The key used in an entry's data object; what the user sees and edits. */
  name: string;
  required: boolean;
}

export interface TextField extends FieldBase {
  type: 'text';
}

export interface NumberField extends FieldBase {
  type: 'number';
}

export interface BooleanField extends FieldBase {
  type: 'boolean';
}

export interface DateField extends FieldBase {
  type: 'date';
}

export interface ReferenceField extends FieldBase {
  type: 'reference';
  /** id of the Schema this field points at. */
  targetSchemaId: string;
}

/**
 * A field is a discriminated union on `type`. This enforces at compile time
 * that only a `reference` field carries a `targetSchemaId`, and lets the form
 * generator narrow exhaustively via `switch (field.type)`.
 */
export type Field =
  | TextField
  | NumberField
  | BooleanField
  | DateField
  | ReferenceField;

/** A content type (e.g. "Car"). `version` increments on every structural edit. */
export interface Schema {
  id: string;
  name: string;
  fields: Field[];
  version: number;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

/**
 * One stored value. `date` is held as an ISO string; `reference` is the id of
 * the target Entry. `null` represents an absent/unset value.
 */
export type FieldValue = string | number | boolean | null;

/** An entry's data, keyed by `Field.name`. */
export type EntryData = Record<string, FieldValue>;

export interface Entry {
  id: string;
  schemaId: string;
  /** The schema version this entry was last written against — the hook for evolution. */
  schemaVersion: number;
  data: EntryData;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}
