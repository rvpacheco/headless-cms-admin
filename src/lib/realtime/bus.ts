import type { RealtimeEvent } from './events';

// An in-process publish/subscribe bus. Each open SSE connection registers one
// subscriber; Server Actions publish to it after they mutate.
//
// HONEST LIMIT: this is a single-process, in-memory bus. It works because the
// whole app runs as one local Node server, so Server Actions and the SSE route
// handler share this module instance. Running multiple instances would need an
// external pub/sub (e.g. Redis) — intentionally out of scope for this
// zero-external-service take-home.

type Subscriber = (event: RealtimeEvent) => void;

// Cache on `globalThis` so the single Set survives dev hot-reload (same pattern
// as the database connection).
const globalForBus = globalThis as unknown as {
  realtimeSubscribers?: Set<Subscriber>;
};

const subscribers: Set<Subscriber> =
  globalForBus.realtimeSubscribers ??
  (globalForBus.realtimeSubscribers = new Set());

/** Register a subscriber; returns an unsubscribe function. */
export function subscribe(fn: Subscriber): () => void {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

/** Fan an event out to every current subscriber. */
export function publish(event: RealtimeEvent): void {
  for (const fn of subscribers) {
    try {
      fn(event);
    } catch {
      // A dead connection shouldn't break the others; it will be cleaned up on
      // its own abort.
    }
  }
}
