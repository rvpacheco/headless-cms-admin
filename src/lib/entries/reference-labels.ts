// Server-side helpers for resolving reference values into readable labels.
// Reference fields store a target entry id; to display or pick them we need the
// target entry's label (see entry-label). These helpers batch the repository
// reads so a list of entries doesn't fan out into per-row queries.

import { getSchema, listSchemas } from '@/lib/db/schemas';
import { listEntries } from '@/lib/db/entries';
import { entryLabel } from '@/lib/domain/entry-label';
import type { Schema } from '@/lib/domain/types';

export interface EntryOption {
  id: string;
  label: string;
}

/** Labeled options for every entry of a target schema (for reference pickers). */
export function labeledEntries(targetSchemaId: string): EntryOption[] {
  const target = getSchema(targetSchemaId);
  if (!target) return [];
  return listEntries(target.id).map((entry) => ({
    id: entry.id,
    label: entryLabel(target, entry),
  }));
}

/**
 * Candidate options for each reference field of a schema, keyed by field name.
 * Feeds the entry form's reference pickers.
 */
export function referenceOptionsForSchema(
  schema: Schema,
): Record<string, EntryOption[]> {
  const options: Record<string, EntryOption[]> = {};
  for (const field of schema.fields) {
    if (field.type === 'reference') {
      options[field.name] = labeledEntries(field.targetSchemaId);
    }
  }
  return options;
}

/**
 * For a schema's reference fields, build `targetSchemaId → (entryId → label)`.
 * Each referenced schema's entries are loaded exactly once.
 */
export function buildReferenceLabelMap(
  schema: Schema,
): Map<string, Map<string, string>> {
  const targetIds = new Set(
    schema.fields
      .filter((field) => field.type === 'reference')
      .map((field) => field.targetSchemaId),
  );

  const byTarget = new Map<string, Map<string, string>>();
  for (const targetId of targetIds) {
    const inner = new Map(
      labeledEntries(targetId).map((option) => [option.id, option.label]),
    );
    byTarget.set(targetId, inner);
  }
  return byTarget;
}

/** Names of all schemas, for any place that needs to resolve a schema name. */
export function schemaNamesById(): Map<string, string> {
  return new Map(listSchemas().map((s) => [s.id, s.name]));
}
