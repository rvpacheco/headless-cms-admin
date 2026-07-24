// Pure entry-data migration for schema evolution.
//
// `migrateEntryData` is the SINGLE SOURCE OF TRUTH for what an entry's data
// becomes after a schema change. It is used by BOTH the review preview (so the
// user sees exactly what will happen) AND by applySchemaChange (which commits
// it) — so "what you review is what commits" is guaranteed by construction, not
// by two parallel implementations that could drift.

import type { Field, FieldType, FieldValue, EntryData } from './types';

export type ConversionResult =
  | { ok: true; value: FieldValue }
  | { ok: false }; // conflict — the value can't be converted; needs a user fix

/**
 * Convert a single value from one field type to another. An empty/null value
 * always converts cleanly to null, so only non-empty values can conflict.
 */
export function convertValue(
  from: FieldType,
  to: FieldType,
  value: FieldValue,
): ConversionResult {
  if (value === null || value === undefined || value === '') {
    return { ok: true, value: null };
  }
  if (from === to) return { ok: true, value };

  switch (to) {
    case 'text':
      if (from === 'boolean') return { ok: true, value: value ? 'true' : 'false' };
      return { ok: true, value: String(value) };

    case 'number': {
      const num = Number(typeof value === 'string' ? value.trim() : value);
      return Number.isFinite(num) ? { ok: true, value: num } : { ok: false };
    }

    case 'boolean': {
      if (from === 'number') {
        if (value === 0) return { ok: true, value: false };
        if (value === 1) return { ok: true, value: true };
        return { ok: false };
      }
      const token = String(value).trim().toLowerCase();
      if (['true', '1', 'yes'].includes(token)) return { ok: true, value: true };
      if (['false', '0', 'no'].includes(token)) return { ok: true, value: false };
      return { ok: false };
    }

    case 'date': {
      const text = String(value).trim();
      return Number.isNaN(Date.parse(text)) ? { ok: false } : { ok: true, value: text };
    }

    case 'reference':
      // DETECT-AND-CLEAR: a reference is an entry id, not an arbitrary value, so
      // there is nothing sensible to auto-convert to. Always a conflict; the
      // user re-picks (or clears) it.
      return { ok: false };
  }
}

/**
 * Compute an entry's data after a schema change.
 *
 * - added field       → null (no prior value to carry)
 * - removed field     → dropped (not copied into the result)
 * - renamed field     → value carried to the new name (key migration, via id)
 * - retyped field     → user fix if provided, else auto-convert (null if it
 *                        couldn't convert — apply guards against reaching here
 *                        with an unresolved conflict)
 * - unchanged field   → value carried over
 *
 * `fixes` is keyed by field id and holds user-resolved values for conflicting
 * retypes of THIS entry.
 */
export function migrateEntryData(
  beforeFields: Field[],
  afterFields: Field[],
  data: EntryData,
  fixes: Record<string, FieldValue> = {},
): EntryData {
  const beforeById = new Map(beforeFields.map((f) => [f.id, f]));
  const result: EntryData = {};

  for (const after of afterFields) {
    const before = beforeById.get(after.id);

    if (!before) {
      result[after.name] = null; // added field
      continue;
    }

    const oldValue = data[before.name] ?? null;

    if (before.type !== after.type) {
      if (after.id in fixes) {
        result[after.name] = fixes[after.id];
      } else {
        const converted = convertValue(before.type, after.type, oldValue);
        result[after.name] = converted.ok ? converted.value : null;
      }
    } else {
      // Same type: value carries over. Because we write under `after.name` while
      // reading from `before.name`, this also performs a rename.
      result[after.name] = oldValue;
    }
  }

  return result;
}
