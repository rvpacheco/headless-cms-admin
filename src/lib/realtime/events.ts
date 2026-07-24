// The real-time event union broadcast over SSE, plus the SSE wire encoder.
// Events are coarse-grained ("something about this schema/entry changed") — the
// client reacts by re-fetching server state, so payloads stay minimal.

export type RealtimeEvent =
  | { kind: 'schema.changed'; schemaId: string; version: number }
  | { kind: 'schema.deleted'; schemaId: string }
  | { kind: 'entry.changed'; schemaId: string; entryId: string; schemaVersion: number }
  | { kind: 'entry.deleted'; schemaId: string; entryId: string };

/** Encode an event as an SSE `data:` frame (default `message` channel). */
export function encodeEvent(event: RealtimeEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}
