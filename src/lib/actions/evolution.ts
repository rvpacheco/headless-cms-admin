'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { transaction } from '@/lib/db';
import { getSchema, listSchemas, updateSchema } from '@/lib/db/schemas';
import { listEntries, updateEntry } from '@/lib/db/entries';
import { validateSchemaDraft, type DraftSchema, type SchemaErrors } from '@/lib/domain/schema-validation';
import { migrateEntryData } from '@/lib/domain/entry-migration';
import { analyzeSchema, type EvolutionPlan } from '@/lib/evolution/analyze';
import { publish } from '@/lib/realtime/bus';
import type { Field, FieldValue } from '@/lib/domain/types';

// Schema evolution: analyze the impact of a schema edit on existing data, then
// apply the schema change + entry migration atomically.

function validationContext(schemaId: string) {
  const existing = listSchemas();
  return {
    takenNamesLower: existing
      .filter((s) => s.id !== schemaId)
      .map((s) => s.name.toLowerCase()),
    knownSchemaIds: existing.map((s) => s.id),
  };
}

export type AnalyzeResult =
  | { ok: true; plan: EvolutionPlan }
  | { ok: false; errors: SchemaErrors };

/** Read-only: compute the impact of applying `draft` to `schemaId`. */
export async function analyzeSchemaChange(
  schemaId: string,
  draft: DraftSchema,
): Promise<AnalyzeResult> {
  const schema = getSchema(schemaId);
  if (!schema) {
    return { ok: false, errors: { fields: {}, name: 'This schema no longer exists.' } };
  }

  const result = validateSchemaDraft(draft, validationContext(schemaId));
  if (!result.valid || !result.fields) {
    return { ok: false, errors: result.errors };
  }

  const after = { name: draft.name.trim(), fields: result.fields };
  const plan = analyzeSchema(schema, after, listEntries(schemaId));
  return { ok: true, plan };
}

/** Normalize a user-supplied fix value into the target field's type. */
function normalizeFix(
  field: Field,
  raw: string | boolean,
  validRefIds?: Set<string>,
): { value: FieldValue } | { error: string } {
  const empty = raw === '' || raw === null || raw === undefined;
  switch (field.type) {
    case 'text':
      return { value: empty ? null : String(raw) };
    case 'number': {
      if (empty) return { value: null };
      const num = Number(raw);
      return Number.isFinite(num) ? { value: num } : { error: 'a fix is not a number' };
    }
    case 'boolean':
      return { value: Boolean(raw) };
    case 'date': {
      if (empty) return { value: null };
      const text = String(raw);
      return Number.isNaN(Date.parse(text))
        ? { error: 'a fix is not a valid date' }
        : { value: text };
    }
    case 'reference': {
      if (empty) return { value: null };
      const id = String(raw);
      return validRefIds?.has(id)
        ? { value: id }
        : { error: 'a fix references a missing entry' };
    }
  }
}

export interface ApplyPayload {
  draft: DraftSchema;
  /** fieldId → entryId → raw fix value (missing = unresolved; '' = explicit clear). */
  fixes: Record<string, Record<string, string | boolean>>;
  /** The version the plan was reviewed against — checked before applying. */
  fromVersion: number;
}

export type ApplyState = { error: string; stale?: boolean } | null;

/**
 * Apply a reviewed schema change. Signature matches `useActionState`:
 * (schemaId is bound, prevState, payload). Redirects on success.
 */
export async function applySchemaChange(
  schemaId: string,
  _prev: ApplyState,
  payload: ApplyPayload,
): Promise<ApplyState> {
  const { draft, fixes, fromVersion } = payload;

  const schema = getSchema(schemaId);
  if (!schema) return { error: 'This schema no longer exists.' };

  // CONCURRENCY GUARD — the crux of the versioning story, the same idea as the
  // priority-4 stale banner: the plan was computed against `fromVersion`. If the
  // schema has moved since (another edit landed), the migration we're about to
  // run was reasoned about stale structure, so refuse and ask for a re-review.
  if (schema.version !== fromVersion) {
    return {
      error: 'This schema changed since you reviewed it. Please review again.',
      stale: true,
    };
  }

  const result = validateSchemaDraft(draft, validationContext(schemaId));
  if (!result.valid || !result.fields) {
    return { error: 'The schema is not valid.' };
  }
  const after = { name: draft.name.trim(), fields: result.fields };
  const entries = listEntries(schemaId);

  // Recompute the plan on the server — never trust the client's numbers.
  const plan = analyzeSchema(schema, after, entries);
  const afterById = new Map(after.fields.map((f) => [f.id, f]));

  // Resolve every retype conflict with the user's fixes. A missing fix is a
  // hard error (the UI blocks apply until all are resolved).
  const fixesByEntry: Record<string, Record<string, FieldValue>> = {};
  for (const impact of plan.impacts) {
    if (!impact.conflicts?.length) continue;
    const field = afterById.get(impact.fieldId);
    if (!field) continue;
    const validRefIds =
      field.type === 'reference'
        ? new Set((impact.referenceOptions ?? []).map((o) => o.id))
        : undefined;

    for (const conflict of impact.conflicts) {
      const raw = fixes?.[impact.fieldId]?.[conflict.entryId];
      if (raw === undefined) {
        return { error: 'Some conflicts are still unresolved.' };
      }
      const normalized = normalizeFix(field, raw, validRefIds);
      if ('error' in normalized) {
        return { error: `“${field.name}”: ${normalized.error}.` };
      }
      (fixesByEntry[conflict.entryId] ??= {})[impact.fieldId] = normalized.value;
    }
  }

  // ATOMIC: the schema update (with version bump) and every entry migration
  // commit together or not at all. `migrateEntryData` is the SAME function the
  // review preview used, so what was reviewed is exactly what commits.
  transaction(() => {
    const updated = updateSchema(schemaId, { name: after.name, fields: after.fields });
    if (!updated) throw new Error('Schema disappeared mid-apply.');
    for (const entry of entries) {
      const migrated = migrateEntryData(
        schema.fields,
        after.fields,
        entry.data,
        fixesByEntry[entry.id] ?? {},
      );
      updateEntry(entry.id, { schemaVersion: updated.version, data: migrated });
    }
  });

  publish({ kind: 'schema.changed', schemaId, version: fromVersion + 1 });
  revalidatePath('/', 'layout');
  redirect(`/schemas/${schemaId}`);
}
