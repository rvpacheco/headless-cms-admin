'use client';

import { useEffect, useState } from 'react';
import { useRealtime } from './RealtimeProvider';

export interface SchemaFreshness {
  /** A newer schema version exists than the one this editor loaded. */
  stale: boolean;
  /** The schema was deleted while this editor was open. */
  deleted: boolean;
  latestVersion: number;
}

/**
 * Detect whether the schema an editor is working against has changed underneath
 * it. Combines two signals so it survives a dropped connection:
 *  - live SSE events (`schema.changed` / `schema.deleted`), and
 *  - `propVersion`, the version from the server props — which `router.refresh()`
 *    updates on reconnect, catching changes missed while disconnected.
 */
export function useSchemaFreshness(
  schemaId: string,
  loadedVersion: number,
  propVersion: number,
): SchemaFreshness {
  const [seenVersion, setSeenVersion] = useState(loadedVersion);
  const [deleted, setDeleted] = useState(false);
  const { subscribe } = useRealtime();

  useEffect(() => {
    return subscribe((event) => {
      if (event.kind === 'schema.changed' && event.schemaId === schemaId) {
        setSeenVersion((current) => Math.max(current, event.version));
      } else if (
        event.kind === 'schema.deleted' &&
        event.schemaId === schemaId
      ) {
        setDeleted(true);
      }
    });
  }, [subscribe, schemaId]);

  const latestVersion = Math.max(seenVersion, propVersion);
  return {
    stale: latestVersion > loadedVersion,
    deleted,
    latestVersion,
  };
}
