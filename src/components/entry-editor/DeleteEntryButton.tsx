'use client';

import { useState, useTransition } from 'react';
import { unstable_rethrow } from 'next/navigation';

interface DeleteEntryButtonProps {
  /** Bound Server Action that deletes this entry and refreshes the list. */
  action: () => Promise<void>;
  entryLabel: string;
}

/**
 * Two-step inline confirmation, matching the schema builder's delete pattern.
 * Red is reserved for the actual destructive action.
 */
export function DeleteEntryButton({ action, entryLabel }: DeleteEntryButtonProps) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      try {
        await action();
      } catch (e) {
        unstable_rethrow(e);
        setError('Could not delete.');
      }
    });
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="rounded-md px-2.5 py-1 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:hover:bg-red-950/40"
      >
        Delete
      </button>
    );
  }

  return (
    <div className="flex items-center justify-end gap-2 text-sm">
      {error ? (
        <span className="text-red-600">{error}</span>
      ) : (
        <span className="text-zinc-500 dark:text-zinc-400">Delete?</span>
      )}
      <button
        type="button"
        disabled={isPending}
        onClick={handleDelete}
        aria-label={`Confirm delete ${entryLabel}`}
        className="rounded-md bg-red-600 px-2.5 py-1 font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
      >
        {isPending ? 'Deleting…' : 'Confirm'}
      </button>
      <button
        type="button"
        disabled={isPending}
        onClick={() => setConfirming(false)}
        className="rounded-md px-2.5 py-1 font-medium text-zinc-600 transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-800"
      >
        Cancel
      </button>
    </div>
  );
}
