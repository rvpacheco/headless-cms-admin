// Server-side impact analysis: given the current schema, an edited (validated)
// set of fields, and the existing entries, produce an EvolutionPlan describing
// what each change does and, for retypes, exactly which entries won't convert.
//
// Conflict detection here uses the SAME `convertValue` primitive that
// `migrateEntryData` uses to commit, so the review and the commit can never
// disagree about which values convert.

import { listEntries } from '@/lib/db/entries';
import { getSchema } from '@/lib/db/schemas';
import { convertValue } from '@/lib/domain/entry-migration';
import { entryLabel } from '@/lib/domain/entry-label';
import {
  diffSchema,
  type ChangeSeverity,
  type FieldDiff,
  type SchemaDiff,
} from '@/lib/domain/schema-diff';
import type { Entry, FieldType, FieldValue, Schema } from '@/lib/domain/types';

export interface ConflictEntry {
  entryId: string;
  entryLabel: string;
  oldValue: FieldValue;
}

export interface FieldImpact {
  fieldId: string;
  severity: ChangeSeverity;
  /** Human-readable, server-composed description of the change + its impact. */
  summary: string;
  affectedCount: number;
  /** Retype only: entries whose values don't convert and need a user fix. */
  conflicts?: ConflictEntry[];
  /** Retype target type — drives the fix input in the review modal. */
  targetType?: FieldType;
  /** If the retype target is a reference, the entries the user can pick from. */
  referenceOptions?: { id: string; label: string }[];
}

export interface EvolutionPlan {
  /** The schema version the plan was computed against — the concurrency guard. */
  fromVersion: number;
  entryCount: number;
  diff: SchemaDiff;
  impacts: FieldImpact[];
  hasBlockingConflicts: boolean;
}

interface NamedFields {
  name: string;
  fields: Schema['fields'];
}

function isEmptyValue(value: FieldValue | undefined): boolean {
  return value === null || value === undefined || value === '';
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** Compose a human sentence describing a field change and its impact. */
function summarize(fd: FieldDiff, affected: number, entryCount: number): string {
  const clauses: string[] = [];
  const name = fd.after?.name ?? fd.before?.name ?? 'field';

  for (const change of fd.changes) {
    switch (change) {
      case 'removed':
        clauses.push(
          affected > 0
            ? `Removing “${fd.before?.name}” — ${plural(affected, 'entry has', 'entries have')} data here that will be deleted.`
            : `Removing “${fd.before?.name}” — no entries have data here.`,
        );
        break;
      case 'added':
        clauses.push(
          fd.after?.required
            ? `Adding required field “${fd.after?.name}” — ${plural(entryCount, 'existing entry', 'existing entries')} will have no value.`
            : `Adding optional field “${fd.after?.name}”.`,
        );
        break;
      case 'renamed':
        clauses.push(
          `Renaming “${fd.before?.name}” → “${fd.after?.name}” — values migrate to the new name.`,
        );
        break;
      case 'required-tightened':
        clauses.push(
          `“${name}” is now required — ${plural(affected, 'entry has', 'entries have')} no value.`,
        );
        break;
      case 'required-loosened':
        clauses.push(`“${name}” is no longer required.`);
        break;
      case 'reference-retargeted':
        clauses.push(
          `“${name}” now references a different schema — ${plural(affected, 'entry points', 'entries point')} to ids not in the new target, and ${affected === 1 ? "that entry can't" : "those entries can't"} be saved until the reference is fixed.`,
        );
        break;
      // 'retyped' handled by the caller (it needs clean/conflict counts).
    }
  }
  return clauses.join(' ');
}

export function analyzeSchema(
  schema: Schema,
  after: NamedFields,
  entries: Entry[],
): EvolutionPlan {
  const diff = diffSchema(schema, after);
  const impacts: FieldImpact[] = [];

  for (const fd of diff.fields) {
    const isRetype = fd.changes.includes('retyped') && fd.before && fd.after;

    if (isRetype && fd.before && fd.after) {
      const conflicts: ConflictEntry[] = [];
      let clean = 0;
      for (const entry of entries) {
        const oldValue = entry.data[fd.before.name] ?? null;
        if (isEmptyValue(oldValue)) continue; // empty converts to null cleanly
        const result = convertValue(fd.before.type, fd.after.type, oldValue);
        if (result.ok) {
          clean += 1;
        } else {
          conflicts.push({
            entryId: entry.id,
            entryLabel: entryLabel(schema, entry),
            oldValue,
          });
        }
      }
      const affected = clean + conflicts.length;

      const renamePrefix = fd.changes.includes('renamed')
        ? `Renaming “${fd.before.name}” → “${fd.after.name}”. `
        : '';
      const conflictNote =
        conflicts.length > 0
          ? `, ${plural(conflicts.length, 'entry needs', 'entries need')} fixing`
          : '';
      const summary = `${renamePrefix}Changing “${fd.after.name}” from ${fd.before.type} to ${fd.after.type} — ${clean} of ${affected} convert cleanly${conflictNote}.`;

      const referenceOptions =
        fd.after.type === 'reference'
          ? labeledTargetEntries(fd.after.targetSchemaId)
          : undefined;

      impacts.push({
        fieldId: fd.fieldId,
        severity: conflicts.length > 0 ? 'conflict' : 'safe',
        summary,
        affectedCount: affected,
        conflicts,
        targetType: fd.after.type,
        referenceOptions,
      });
      continue;
    }

    // Non-retype changes: count affected entries per change kind.
    let affected = 0;
    if (fd.changes.includes('removed') && fd.before) {
      affected = entries.filter((e) => !isEmptyValue(e.data[fd.before!.name])).length;
    } else if (fd.changes.includes('required-tightened') && fd.before) {
      affected = entries.filter((e) => isEmptyValue(e.data[fd.before!.name])).length;
    } else if (
      fd.changes.includes('reference-retargeted') &&
      fd.before &&
      fd.after &&
      fd.after.type === 'reference'
    ) {
      const validIds = new Set(
        listEntries(fd.after.targetSchemaId).map((e) => e.id),
      );
      affected = entries.filter((e) => {
        const v = e.data[fd.before!.name];
        return !isEmptyValue(v) && !validIds.has(String(v));
      }).length;
    } else if (fd.changes.includes('added') && fd.after?.required) {
      affected = entries.length;
    }

    impacts.push({
      fieldId: fd.fieldId,
      severity: fd.severity,
      summary: summarize(fd, affected, entries.length),
      affectedCount: affected,
    });
  }

  return {
    fromVersion: schema.version,
    entryCount: entries.length,
    diff,
    impacts,
    hasBlockingConflicts: impacts.some((i) => (i.conflicts?.length ?? 0) > 0),
  };
}

function labeledTargetEntries(
  targetSchemaId: string,
): { id: string; label: string }[] {
  const target = getSchema(targetSchemaId);
  if (!target) return [];
  return listEntries(target.id).map((e) => ({
    id: e.id,
    label: entryLabel(target, e),
  }));
}
