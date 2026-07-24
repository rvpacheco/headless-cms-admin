'use client';

import { useState, useTransition } from 'react';

interface DeleteSchemaButtonProps {
  /** Bound Server Action that deletes this schema and redirects home. */
  action: () => Promise<void>;
  schemaName: string;
  /** How many entries will be cascade-deleted along with the schema. */
  entryCount: number;
}

/**
 * Two-step inline confirmation for a destructive action. Calmer than a browser
 * `confirm()` dialog, and keeps red reserved for the actual delete.
 */
export function DeleteSchemaButton({
  action,
  schemaName,
  entryCount,
}: DeleteSchemaButtonProps) {
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();

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
    <div className="flex items-center gap-2 text-sm">
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
        onClick={() => startTransition(() => action())}
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
  );
}
