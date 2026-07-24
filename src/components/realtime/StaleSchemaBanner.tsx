'use client';

import { useState } from 'react';
import Link from 'next/link';

interface StaleSchemaBannerProps {
  deleted: boolean;
  loadedVersion: number;
  latestVersion: number;
  /** Adopt the latest server data, discarding unsaved edits. */
  onReload: () => void;
  /** Where "Go back" leads when the schema was deleted. */
  backHref: string;
}

/**
 * Non-destructive notice shown when the schema changed (or was deleted) while
 * an editor is open. It NEVER auto-discards edits or morphs the form — the user
 * always chooses Reload vs. Keep editing.
 *
 * PHASE-5 BOUNDARY: this is only the graceful detection + choice. Surfacing all
 * affected entries, previewing the impact, and migrating data is priority 5.
 */
export function StaleSchemaBanner({
  deleted,
  loadedVersion,
  latestVersion,
  onReload,
  backHref,
}: StaleSchemaBannerProps) {
  // "Keep editing" hides the banner until a *newer* change arrives.
  const [dismissedVersion, setDismissedVersion] = useState(0);

  if (deleted) {
    return (
      <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm dark:border-amber-800/60 dark:bg-amber-950/30">
        <p className="font-medium text-amber-900 dark:text-amber-200">
          This content type was deleted.
        </p>
        <p className="mt-0.5 text-amber-800 dark:text-amber-300/90">
          You can no longer save here.
        </p>
        <Link
          href={backHref}
          className="mt-2 inline-block rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-amber-700"
        >
          Go back
        </Link>
      </div>
    );
  }

  if (dismissedVersion >= latestVersion) return null;

  return (
    <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm dark:border-amber-800/60 dark:bg-amber-950/30">
      <p className="font-medium text-amber-900 dark:text-amber-200">
        This content type changed while you were editing (v{loadedVersion} → v
        {latestVersion}).
      </p>
      <p className="mt-0.5 text-amber-800 dark:text-amber-300/90">
        Your unsaved changes are preserved, but the form may be out of date.
      </p>
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={onReload}
          className="rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-amber-700"
        >
          Reload form
        </button>
        <button
          type="button"
          onClick={() => setDismissedVersion(latestVersion)}
          className="rounded-md px-3 py-1.5 text-sm font-medium text-amber-800 transition-colors hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-900/30"
        >
          Keep editing
        </button>
      </div>
    </div>
  );
}
