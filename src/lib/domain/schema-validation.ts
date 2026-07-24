// Pure validation for the schema builder. Shared by the client (instant inline
// feedback) and the Server Action (the authority — it re-runs this and never
// trusts the client). No I/O here: the caller supplies context (taken names,
// known schema ids) so the same code runs in both environments.

import type { Field, FieldType } from './types';

export const FIELD_TYPES: readonly FieldType[] = [
  'text',
  'number',
  'boolean',
  'date',
  'reference',
];

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: 'Text',
  number: 'Number',
  boolean: 'Boolean',
  date: 'Date',
  reference: 'Reference',
};

/**
 * A field while it is being edited in the builder. Looser than the domain
 * `Field`: the name may be blank and a `reference` may not have a target yet.
 * `rowId` is a stable React list key; `id` is the persisted field id.
 */
export interface DraftField {
  rowId: string;
  id: string;
  name: string;
  type: FieldType;
  required: boolean;
  /** Empty unless `type === 'reference'` and a target has been chosen. */
  targetSchemaId: string;
}

export interface DraftSchema {
  name: string;
  fields: DraftField[];
}

/** Errors for a single field row, keyed for inline display. */
export interface FieldErrors {
  name?: string;
  targetSchemaId?: string;
}

export interface SchemaErrors {
  /** Error on the schema name. */
  name?: string;
  /** Per-row field errors, keyed by `DraftField.rowId`. */
  fields: Record<string, FieldErrors>;
}

/** Context the validator needs but cannot know on its own. */
export interface ValidationContext {
  /** Lowercased names of *other* schemas — for case-insensitive uniqueness. */
  takenNamesLower: string[];
  /** Ids of schemas a reference field may target (may include the schema itself). */
  knownSchemaIds: string[];
}

export interface ValidationResult {
  errors: SchemaErrors;
  valid: boolean;
  /** The normalized domain fields — present only when `valid` is true. */
  fields?: Field[];
}

/** True when an errors object carries no messages. */
function isEmpty(errors: SchemaErrors): boolean {
  if (errors.name) return false;
  return Object.values(errors.fields).every(
    (f) => !f.name && !f.targetSchemaId,
  );
}

/** Convert a valid draft field into the strict domain `Field`. */
function toField(draft: DraftField): Field {
  const base = {
    id: draft.id,
    name: draft.name.trim(),
    required: draft.required,
  };
  if (draft.type === 'reference') {
    return { ...base, type: 'reference', targetSchemaId: draft.targetSchemaId };
  }
  return { ...base, type: draft.type };
}

export function validateSchemaDraft(
  draft: DraftSchema,
  ctx: ValidationContext,
): ValidationResult {
  const errors: SchemaErrors = { fields: {} };

  // --- Schema name: required + case-insensitive uniqueness ---
  const name = draft.name.trim();
  if (!name) {
    errors.name = 'Name is required.';
  } else if (ctx.takenNamesLower.includes(name.toLowerCase())) {
    errors.name = `A schema named "${name}" already exists.`;
  }

  // --- Fields ---
  const seenNames = new Set<string>();
  for (const field of draft.fields) {
    const fieldErrors: FieldErrors = {};
    const fieldName = field.name.trim();

    if (!fieldName) {
      fieldErrors.name = 'Field name is required.';
    } else {
      const key = fieldName.toLowerCase();
      if (seenNames.has(key)) {
        fieldErrors.name = 'Field names must be unique within a schema.';
      }
      seenNames.add(key);
    }

    if (field.type === 'reference') {
      if (!field.targetSchemaId) {
        fieldErrors.targetSchemaId = 'Choose a target schema.';
      } else if (!ctx.knownSchemaIds.includes(field.targetSchemaId)) {
        fieldErrors.targetSchemaId = 'That target schema no longer exists.';
      }
    }

    if (fieldErrors.name || fieldErrors.targetSchemaId) {
      errors.fields[field.rowId] = fieldErrors;
    }
  }

  const valid = isEmpty(errors);
  return {
    errors,
    valid,
    fields: valid ? draft.fields.map(toField) : undefined,
  };
}
