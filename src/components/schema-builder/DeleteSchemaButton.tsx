'use client';

import { useState, useTransition } from 'react';
import { unstable_rethrow } from 'next/navigation';

interface DeleteSchemaButtonProps {
  /** Bound Server Action that deletes this schema and redirects home. */
  action: () => Promise<void>;
  schemaName: string;
  /** How many entries will be cascade-deleted along with the schema. */
  entryCount: number;
  /** Names of other schemas whose reference fields target this schema. */
  referencingSchemas: string[];
}

/**
 * Two-step inline confirmation for a destructive action. Calmer than a browser
 * `confirm()` dialog, and keeps red reserved for the actual delete.
 */
export function DeleteSchemaButton({
  action,
  schemaName,
  entryCount,
  referencingSchemas,
}: DeleteSchemaButtonProps) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      try {
        await action();
      } catch (e) {
        // Re-throw framework control-flow (the success redirect); surface only
        // real failures instead of letting them fail silently.
        unstable_rethrow(e);
        setError('Could not delete this schema. Please try again.');
      }
    });
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="rounded-md px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:hover:bg-red-950/40"
      >
        Delete
      </button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1.5 text-sm">
      <div className="flex items-center gap-2">
        <span className="text-zinc-600 dark:text-zinc-400">
          Delete “{schemaName}”?
          {entryCount > 0 && (
            <span className="ml-1 text-red-600">
              This will also delete {entryCount}{' '}
              {entryCount === 1 ? 'entry' : 'entries'}.
            </span>
          )}
        </span>
        <button
          type="button"
          disabled={isPending}
          onClick={handleDelete}
          className="rounded-md bg-red-600 px-3 py-1.5 font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
        >
          {isPending ? 'Deleting…' : 'Confirm'}
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => setConfirming(false)}
          className="rounded-md px-3 py-1.5 font-medium text-zinc-600 transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-800"
        >
          Cancel
        </button>
      </div>

      {referencingSchemas.length > 0 && (
        <p className="max-w-md text-right text-xs text-amber-700 dark:text-amber-400">
          {referencingSchemas.length === 1 ? 'Schema' : 'Schemas'}{' '}
          {referencingSchemas.map((n) => `“${n}”`).join(', ')} reference this
          type — their reference fields will break.
        </p>
      )}
      {error && (
        <p className="text-right text-xs text-red-600">{error}</p>
      )}
    </div>
  );
}
