// Pure structural diff between the current schema and an edited draft. Fields
// are matched by their STABLE id, so a rename reads as a rename (not a
// delete + add) and a retype is spotted on the same field. No data is touched
// here — this only classifies what changed and how risky each change is.

import type { Field } from './types';

export type FieldChangeKind =
  | 'added'
  | 'removed'
  | 'renamed'
  | 'retyped'
  | 'required-tightened'
  | 'required-loosened'
  | 'reference-retargeted';

// safe:     applied automatically, no possible data conflict
// warning:  applied as-is, but existing data may be dropped/left incomplete
// conflict: a retype whose values may not convert — needs per-entry review
export type ChangeSeverity = 'safe' | 'warning' | 'conflict';

export interface FieldDiff {
  fieldId: string;
  before?: Field; // undefined when the field was added
  after?: Field; // undefined when the field was removed
  changes: FieldChangeKind[];
  severity: ChangeSeverity;
}

export interface SchemaDiff {
  /** Schema rename is safe for data (entries key by schemaId, not name). */
  schemaRename?: { before: string; after: string };
  fields: FieldDiff[];
  /** True when any field-level change exists (i.e. entry data may be affected). */
  hasStructuralChange: boolean;
}

interface NamedFields {
  name: string;
  fields: Field[];
}

/** Highest severity wins when a field carries several changes. */
function maxSeverity(a: ChangeSeverity, b: ChangeSeverity): ChangeSeverity {
  const rank: Record<ChangeSeverity, number> = {
    safe: 0,
    warning: 1,
    conflict: 2,
  };
  return rank[a] >= rank[b] ? a : b;
}

export function diffSchema(before: NamedFields, after: NamedFields): SchemaDiff {
  const beforeById = new Map(before.fields.map((f) => [f.id, f]));
  const afterById = new Map(after.fields.map((f) => [f.id, f]));

  const fields: FieldDiff[] = [];

  // Removed fields (present before, absent after) — destructive.
  for (const beforeField of before.fields) {
    if (!afterById.has(beforeField.id)) {
      fields.push({
        fieldId: beforeField.id,
        before: beforeField,
        changes: ['removed'],
        severity: 'warning',
      });
    }
  }

  // Added and modified fields.
  for (const afterField of after.fields) {
    const beforeField = beforeById.get(afterField.id);

    if (!beforeField) {
      // Added: required-added is a warning (existing entries lack a value).
      fields.push({
        fieldId: afterField.id,
        after: afterField,
        changes: ['added'],
        severity: afterField.required ? 'warning' : 'safe',
      });
      continue;
    }

    const changes: FieldChangeKind[] = [];
    let severity: ChangeSeverity = 'safe';

    if (beforeField.name !== afterField.name) {
      changes.push('renamed'); // safe: data key is migrated on apply
    }
    if (beforeField.type !== afterField.type) {
      changes.push('retyped');
      severity = maxSeverity(severity, 'conflict');
    }
    if (beforeField.required !== afterField.required) {
      if (afterField.required) {
        changes.push('required-tightened');
        severity = maxSeverity(severity, 'warning');
      } else {
        changes.push('required-loosened');
      }
    }
    if (
      beforeField.type === 'reference' &&
      afterField.type === 'reference' &&
      beforeField.targetSchemaId !== afterField.targetSchemaId
    ) {
      changes.push('reference-retargeted');
      severity = maxSeverity(severity, 'warning');
    }

    if (changes.length > 0) {
      fields.push({
        fieldId: afterField.id,
        before: beforeField,
        after: afterField,
        changes,
        severity,
      });
    }
  }

  return {
    schemaRename:
      before.name !== after.name
        ? { before: before.name, after: after.name }
        : undefined,
    fields,
    hasStructuralChange: fields.length > 0,
  };
}
