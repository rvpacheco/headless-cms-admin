'use client';

import { startTransition, useActionState, useState } from 'react';
import Link from 'next/link';
import type { EntryFormState } from '@/lib/actions/entries';
import {
  validateEntryData,
  type EntryErrors,
  type RawEntryData,
} from '@/lib/domain/entry-validation';
import type { EntryData, Schema } from '@/lib/domain/types';
import type { EntryOption } from '@/lib/entries/reference-labels';
import { useSchemaFreshness } from '@/components/realtime/useSchemaFreshness';
import { StaleSchemaBanner } from '@/components/realtime/StaleSchemaBanner';
import { EntryFieldInput } from './EntryFieldInput';

interface EntryFormProps {
  /** Bound Server Action: create (entryId=null) or update (entryId set). */
  action: (
    prev: EntryFormState,
    raw: RawEntryData,
  ) => Promise<EntryFormState>;
  schema: Schema;
  initialData?: EntryData;
  /** Candidate target entries per reference field name. */
  referenceOptions: Record<string, EntryOption[]>;
  submitLabel: string;
  cancelHref: string;
}

const EMPTY_ERRORS: EntryErrors = {};

/** Seed form control values from stored data (or type-appropriate defaults). */
function initialValues(
  schema: Schema,
  initialData: EntryData | undefined,
): Record<string, string | boolean> {
  const values: Record<string, string | boolean> = {};
  for (const field of schema.fields) {
    const stored = initialData?.[field.name];
    if (field.type === 'boolean') {
      values[field.name] = Boolean(stored);
    } else {
      values[field.name] = stored == null ? '' : String(stored);
    }
  }
  return values;
}

export function EntryForm({
  action,
  schema,
  initialData,
  referenceOptions,
  submitLabel,
  cancelHref,
}: EntryFormProps) {
  const [state, dispatch, isPending] = useActionState(action, null);
  // Snapshot the schema + data at mount. The form renders from this snapshot so
  // a background `router.refresh()` (triggered by real-time events) can't morph
  // the field set under the user. `schema` (the live prop) is used only to
  // detect drift and to reload from.
  const [snapshot, setSnapshot] = useState({ schema, data: initialData });
  const [values, setValues] = useState(() =>
    initialValues(snapshot.schema, snapshot.data),
  );
  const [clientErrors, setClientErrors] = useState<EntryErrors | null>(null);

  const freshness = useSchemaFreshness(
    schema.id,
    snapshot.schema.version,
    schema.version,
  );

  const errors = clientErrors ?? state?.errors ?? EMPTY_ERRORS;

  // Reference validity context, derived from the same options the pickers use.
  const validTargetIds: Record<string, string[]> = {};
  for (const field of snapshot.schema.fields) {
    if (field.type === 'reference') {
      validTargetIds[field.name] = (referenceOptions[field.name] ?? []).map(
        (option) => option.id,
      );
    }
  }

  function updateValue(name: string, value: string | boolean) {
    setValues((current) => ({ ...current, [name]: value }));
  }

  // Adopt the latest server data, discarding unsaved edits (user-initiated).
  function reloadFromLatest() {
    setSnapshot({ schema, data: initialData });
    setValues(initialValues(schema, initialData));
    setClientErrors(null);
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const result = validateEntryData(snapshot.schema, values, { validTargetIds });
    if (!result.valid) {
      setClientErrors(result.errors);
      return;
    }
    setClientErrors(null);
    // Dispatch must run inside a transition so `isPending` updates (see the
    // schema builder for the same pattern).
    startTransition(() => dispatch(values));
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {(freshness.stale || freshness.deleted) && (
        <StaleSchemaBanner
          deleted={freshness.deleted}
          loadedVersion={snapshot.schema.version}
          latestVersion={freshness.latestVersion}
          onReload={reloadFromLatest}
          backHref={cancelHref}
        />
      )}

      {errors._form && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/40">
          {errors._form}
        </p>
      )}

      {snapshot.schema.fields.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 px-6 py-10 text-center dark:border-zinc-700">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            This schema has no fields yet, so there is nothing to fill in.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {snapshot.schema.fields.map((field) => (
            <EntryFieldInput
              key={field.id}
              field={field}
              value={values[field.name] ?? (field.type === 'boolean' ? false : '')}
              error={errors[field.name]}
              disabled={isPending}
              referenceOptions={referenceOptions[field.name]}
              onChange={updateValue}
            />
          ))}
        </div>
      )}

      <div className="flex items-center gap-3 border-t border-zinc-200 pt-6 dark:border-zinc-800">
        <button
          type="submit"
          disabled={
            isPending ||
            snapshot.schema.fields.length === 0 ||
            freshness.deleted
          }
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
