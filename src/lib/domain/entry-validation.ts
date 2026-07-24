// Pure validation for entry data against a schema. Shared by the client
// (instant inline feedback) and the Server Action (the authority). The form
// deals in raw input values (strings from inputs, booleans from checkboxes);
// this module normalizes them into typed `EntryData` or reports errors.

import type { EntryData, Field, Schema } from './types';

/** Raw values as they come off the form controls. */
export type RawEntryData = Record<string, string | boolean | undefined>;

/** Errors keyed by field name. */
export type EntryErrors = Record<string, string>;

export interface EntryValidationContext {
  /** Valid target entry ids per reference field name. */
  validTargetIds: Record<string, string[]>;
}

export interface EntryValidationResult {
  errors: EntryErrors;
  valid: boolean;
  /** Normalized, typed data — present only when `valid` is true. */
  data?: EntryData;
}

type FieldOutcome = { value: EntryData[string] } | { error: string };

function ok(value: EntryData[string]): FieldOutcome {
  return { value };
}

function required(field: Field): FieldOutcome {
  return { error: `${field.name} is required.` };
}

function normalizeField(
  field: Field,
  raw: string | boolean | undefined,
  ctx: EntryValidationContext,
): FieldOutcome {
  switch (field.type) {
    case 'text': {
      const text = typeof raw === 'string' ? raw.trim() : '';
      if (text === '') return field.required ? required(field) : ok(null);
      return ok(text);
    }

    case 'number': {
      const text = typeof raw === 'string' ? raw.trim() : '';
      if (text === '') return field.required ? required(field) : ok(null);
      const num = Number(text);
      if (!Number.isFinite(num)) {
        return { error: `${field.name} must be a number.` };
      }
      return ok(num);
    }

    case 'boolean':
      // A checkbox always yields a concrete value, and `false` is valid, so a
      // `required` boolean is inherently satisfied — we never emit a required
      // error here. This is a deliberate choice, not an oversight.
      return ok(Boolean(raw));

    case 'date': {
      const text = typeof raw === 'string' ? raw.trim() : '';
      if (text === '') return field.required ? required(field) : ok(null);
      if (Number.isNaN(Date.parse(text))) {
        return { error: `${field.name} must be a valid date.` };
      }
      return ok(text);
    }

    case 'reference': {
      const id = typeof raw === 'string' ? raw.trim() : '';
      if (id === '') return field.required ? required(field) : ok(null);
      const validIds = ctx.validTargetIds[field.name] ?? [];
      if (!validIds.includes(id)) {
        return { error: `${field.name} must reference an existing entry.` };
      }
      return ok(id);
    }
  }
}

export function validateEntryData(
  schema: Schema,
  raw: RawEntryData,
  ctx: EntryValidationContext,
): EntryValidationResult {
  const errors: EntryErrors = {};
  const data: EntryData = {};

  // Build data only from the schema's current fields — this drops any stale or
  // unknown keys, protecting stored entries against schema drift.
  for (const field of schema.fields) {
    const outcome = normalizeField(field, raw[field.name], ctx);
    if ('error' in outcome) {
      errors[field.name] = outcome.error;
    } else {
      data[field.name] = outcome.value;
    }
  }

  const valid = Object.keys(errors).length === 0;
  return { errors, valid, data: valid ? data : undefined };
}
