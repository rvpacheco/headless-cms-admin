'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getSchema } from '@/lib/db/schemas';
import {
  createEntry,
  deleteEntry,
  getEntry,
  listEntries,
  updateEntry,
} from '@/lib/db/entries';
import {
  validateEntryData,
  type EntryErrors,
  type RawEntryData,
} from '@/lib/domain/entry-validation';
import { publish } from '@/lib/realtime/bus';

// UI-driven mutations for entries. These re-validate against the schema on the
// server regardless of any client-side checks.

/** State returned to the entry form. `null` means "no attempt yet". */
export type EntryFormState = { errors: EntryErrors } | null;

/** Build the set of valid target entry ids for each reference field. */
function referenceContext(schemaId: string) {
  const schema = getSchema(schemaId);
  const validTargetIds: Record<string, string[]> = {};
  if (schema) {
    for (const field of schema.fields) {
      if (field.type === 'reference') {
        validTargetIds[field.name] = listEntries(field.targetSchemaId).map(
          (entry) => entry.id,
        );
      }
    }
  }
  return validTargetIds;
}

/**
 * Create or update an entry. `entryId` is bound by the page (null = create).
 * Signature matches `useActionState`: (prevState, payload).
 *
 * On success this redirects to the schema's entry list and never returns; on
 * validation failure it returns the errors for inline display.
 */
export async function saveEntryAction(
  schemaId: string,
  entryId: string | null,
  _prev: EntryFormState,
  raw: RawEntryData,
): Promise<EntryFormState> {
  const schema = getSchema(schemaId);
  if (!schema) {
    return { errors: { _form: 'This schema no longer exists.' } };
  }

  const result = validateEntryData(schema, raw, {
    validTargetIds: referenceContext(schemaId),
  });
  if (!result.valid || !result.data) {
    return { errors: result.errors };
  }

  let savedId: string;
  if (entryId) {
    const updated = updateEntry(entryId, {
      schemaVersion: schema.version,
      data: result.data,
    });
    if (!updated) {
      return { errors: { _form: 'This entry no longer exists.' } };
    }
    savedId = updated.id;
  } else {
    savedId = createEntry({
      schemaId,
      schemaVersion: schema.version,
      data: result.data,
    }).id;
  }

  // Broadcast to connected clients before redirecting (redirect throws).
  publish({
    kind: 'entry.changed',
    schemaId,
    entryId: savedId,
    schemaVersion: schema.version,
  });
  revalidatePath(`/schemas/${schemaId}`);
  redirect(`/schemas/${schemaId}`);
}

/** Delete an entry, then refresh the schema's entry list. */
export async function deleteEntryAction(
  schemaId: string,
  entryId: string,
): Promise<void> {
  // Guard against deleting an entry that belongs to a different schema.
  const entry = getEntry(entryId);
  if (entry && entry.schemaId === schemaId) {
    deleteEntry(entryId);
    publish({ kind: 'entry.deleted', schemaId, entryId });
  }
  // NOTE: this does not clean up references pointing AT this entry — those
  // render as "Missing entry" in the UI. Cascade/referential-integrity cleanup
  // is a deliberate scope cut (it overlaps schema-evolution work in priority 5).
  revalidatePath(`/schemas/${schemaId}`);
}
