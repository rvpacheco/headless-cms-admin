'use client';

import { startTransition, useActionState, useState } from 'react';
import Link from 'next/link';
import type { SchemaFormState } from '@/lib/actions/schemas';
import {
  validateSchemaDraft,
  type DraftField,
  type DraftSchema,
  type SchemaErrors,
} from '@/lib/domain/schema-validation';
import { useSchemaFreshness } from '@/components/realtime/useSchemaFreshness';
import { StaleSchemaBanner } from '@/components/realtime/StaleSchemaBanner';
import { FieldRow, type SchemaOption } from './FieldRow';

interface SchemaBuilderProps {
  /** Bound Server Action: create (schemaId=null) or update (schemaId set). */
  action: (
    prev: SchemaFormState,
    draft: DraftSchema,
  ) => Promise<SchemaFormState>;
  initialName?: string;
  initialFields?: DraftField[];
  /** Schemas a reference field may target (includes the current one on edit). */
  availableTargets: SchemaOption[];
  /** Lowercased names of other schemas, for client-side uniqueness feedback. */
  takenNamesLower: string[];
  submitLabel: string;
  /** Where "Cancel" goes back to. */
  cancelHref: string;
  /** Edit mode only: the schema being edited, for the stale-schema banner. */
  schemaId?: string;
  version?: number;
}

const EMPTY_ERRORS: SchemaErrors = { fields: {} };

function newDraftField(): DraftField {
  return {
    rowId: crypto.randomUUID(),
    id: crypto.randomUUID(),
    name: '',
    type: 'text',
    required: false,
    targetSchemaId: '',
  };
}

const inputClass =
  'w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:ring-zinc-700';

export function SchemaBuilder({
  action,
  initialName = '',
  initialFields = [],
  availableTargets,
  takenNamesLower,
  submitLabel,
  cancelHref,
  schemaId,
  version = 0,
}: SchemaBuilderProps) {
  const [state, dispatch, isPending] = useActionState(action, null);
  const [name, setName] = useState(initialName);
  const [fields, setFields] = useState<DraftField[]>(initialFields);
  // Client-side errors (instant feedback). Server errors arrive via `state`.
  const [clientErrors, setClientErrors] = useState<SchemaErrors | null>(null);
  // Snapshot the loaded version so the stale banner can compare against it.
  // Empty schemaId (create mode) never matches an event, so this stays inert.
  const [loadedVersion, setLoadedVersion] = useState(version);

  const freshness = useSchemaFreshness(schemaId ?? '', loadedVersion, version);

  const errors = clientErrors ?? state?.errors ?? EMPTY_ERRORS;
  const knownSchemaIds = availableTargets.map((s) => s.id);

  // Adopt the latest server data, discarding unsaved edits (user-initiated).
  function reloadFromLatest() {
    setName(initialName);
    setFields(initialFields);
    setClientErrors(null);
    setLoadedVersion(version);
  }

  function updateField(rowId: string, patch: Partial<DraftField>) {
    setFields((current) =>
      current.map((field) => {
        if (field.rowId !== rowId) return field;
        const next = { ...field, ...patch };
        // Changing away from `reference` clears any stale target.
        if (patch.type && patch.type !== 'reference') {
          next.targetSchemaId = '';
        }
        return next;
      }),
    );
  }

  function addField() {
    setFields((current) => [...current, newDraftField()]);
  }

  function removeField(rowId: string) {
    setFields((current) => current.filter((field) => field.rowId !== rowId));
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const draft: DraftSchema = { name, fields };
    // Validate on the client first for instant feedback; the Server Action
    // re-validates authoritatively (and catches races we can't see here).
    const result = validateSchemaDraft(draft, {
      takenNamesLower,
      knownSchemaIds,
    });
    if (!result.valid) {
      setClientErrors(result.errors);
      return;
    }
    setClientErrors(null);
    // `useActionState`'s dispatch is an async action: it must run inside a
    // transition, otherwise `isPending` won't update. We can't use the form's
    // `action` prop here because that hands us FormData, and our payload is a
    // nested field array — so we wrap the dispatch in `startTransition`, which
    // still drives the hook's `isPending`.
    startTransition(() => dispatch(draft));
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-8">
      {schemaId && (freshness.stale || freshness.deleted) && (
        <StaleSchemaBanner
          deleted={freshness.deleted}
          loadedVersion={loadedVersion}
          latestVersion={freshness.latestVersion}
          onReload={reloadFromLatest}
          backHref={cancelHref}
        />
      )}

      {/* Schema name */}
      <div>
        <label
          htmlFor="schema-name"
          className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Schema name
        </label>
        <input
          id="schema-name"
          type="text"
          value={name}
          placeholder="e.g. Car"
          disabled={isPending}
          aria-invalid={Boolean(errors.name)}
          className={`${inputClass} max-w-md`}
          onChange={(e) => setName(e.target.value)}
        />
        {errors.name && (
          <p className="mt-1 text-xs text-red-600">{errors.name}</p>
        )}
      </div>

      {/* Fields */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Fields
          </h2>
          <button
            type="button"
            onClick={addField}
            disabled={isPending}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Add field
          </button>
        </div>

        {fields.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-300 px-6 py-10 text-center dark:border-zinc-700">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              No fields yet — add one to get started.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {fields.map((field) => (
              <FieldRow
                key={field.rowId}
                field={field}
                availableTargets={availableTargets}
                errors={errors.fields[field.rowId]}
                disabled={isPending}
                onChange={updateField}
                onRemove={removeField}
              />
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 border-t border-zinc-200 pt-6 dark:border-zinc-800">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
        >
          {isPending ? 'Saving…' : submitLabel}
        </button>
        <Link
          href={cancelHref}
          className="rounded-md px-4 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
