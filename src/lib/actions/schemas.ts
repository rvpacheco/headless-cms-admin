'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  createSchema,
  deleteSchema,
  listSchemas,
  updateSchema,
} from '@/lib/db/schemas';
import {
  validateSchemaDraft,
  type DraftSchema,
  type SchemaErrors,
} from '@/lib/domain/schema-validation';
import { publish } from '@/lib/realtime/bus';

// UI-driven mutations for schemas. These are the only writers of schema data,
// and they re-validate on the server regardless of any client-side checks.

/** State returned to the builder. `null` means "no attempt yet". */
export type SchemaFormState = { errors: SchemaErrors } | null;

/**
 * Create or update a schema. `schemaId` is bound by the page (null = create).
 * Signature matches React's `useActionState`: (prevState, payload).
 *
 * On success this redirects to the schema and never returns; on validation
 * failure it returns the errors for inline display.
 */
export async function saveSchemaAction(
  schemaId: string | null,
  _prev: SchemaFormState,
  draft: DraftSchema,
): Promise<SchemaFormState> {
  const existing = listSchemas();

  // Build validation context from the current data. On update, exclude the
  // schema itself from the name-uniqueness check and allow it as a reference
  // target (self-references are permitted).
  const takenNamesLower = existing
    .filter((s) => s.id !== schemaId)
    .map((s) => s.name.toLowerCase());
  const knownSchemaIds = existing.map((s) => s.id);

  const result = validateSchemaDraft(draft, { takenNamesLower, knownSchemaIds });
  if (!result.valid || !result.fields) {
    return { errors: result.errors };
  }

  const name = draft.name.trim();
  const fields = result.fields;

  let id: string;
  let version: number;
  if (schemaId) {
    const updated = updateSchema(schemaId, { name, fields });
    if (!updated) {
      // The schema was deleted between load and save.
      return { errors: { fields: {}, name: 'This schema no longer exists.' } };
    }
    id = updated.id;
    version = updated.version;
  } else {
    const created = createSchema({ name, fields });
    id = created.id;
    version = created.version;
  }

  // Broadcast to connected clients before redirecting (redirect throws).
  publish({ kind: 'schema.changed', schemaId: id, version });
  // Refresh every route under the root layout so the sidebar reflects the change.
  revalidatePath('/', 'layout');
  redirect(`/schemas/${id}`);
}

/** Delete a schema (and its entries), then return to the landing page. */
export async function deleteSchemaAction(schemaId: string): Promise<void> {
  const deleted = deleteSchema(schemaId);
  // Only broadcast if a schema was actually removed.
  if (deleted) {
    publish({ kind: 'schema.deleted', schemaId });
  }
  revalidatePath('/', 'layout');
  redirect('/');
}
