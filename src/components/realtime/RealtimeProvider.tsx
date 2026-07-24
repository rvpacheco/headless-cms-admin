'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import type { RealtimeEvent } from '@/lib/realtime/events';

type Listener = (event: RealtimeEvent) => void;

interface RealtimeContextValue {
  /** Subscribe to raw events; returns an unsubscribe function. */
  subscribe: (fn: Listener) => () => void;
}

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

const REFRESH_DEBOUNCE_MS = 150;

/**
 * Owns the single EventSource for the whole app. On any event it re-fetches
 * server state via `router.refresh()` (coalesced) so the sidebar and every
 * server-rendered list stay live — refresh preserves client `useState`, so open
 * forms keep their edits. Components that need targeted reactions (the editor's
 * stale-schema banner) subscribe via context.
 */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const listeners = useRef(new Set<Listener>());
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const subscribe = useCallback((fn: Listener) => {
    listeners.current.add(fn);
    return () => {
      listeners.current.delete(fn);
    };
  }, []);

  useEffect(() => {
    const scheduleRefresh = () => {
      if (refreshTimer.current) return;
      refreshTimer.current = setTimeout(() => {
        refreshTimer.current = null;
        router.refresh();
      }, REFRESH_DEBOUNCE_MS);
    };

    const source = new EventSource('/api/events');

    // Fires on initial connect and on every auto-reconnect: refresh to resync
    // any state that changed while we were connecting/disconnected.
    source.onopen = () => scheduleRefresh();

    source.onmessage = (message) => {
      let event: RealtimeEvent;
      try {
        event = JSON.parse(message.data) as RealtimeEvent;
      } catch {
        return;
      }
      for (const fn of listeners.current) fn(event);
      scheduleRefresh();
    };

    // EventSource reconnects automatically on error (using the server's `retry`
    // hint); no manual handling needed here.

    return () => {
      source.close();
      if (refreshTimer.current) {
        clearTimeout(refreshTimer.current);
        refreshTimer.current = null;
      }
    };
  }, [router]);

  return (
    <RealtimeContext.Provider value={{ subscribe }}>
      {children}
    </RealtimeContext.Provider>
  );
}

/** Subscribe to real-time events from within a Client Component. */
export function useRealtime(): RealtimeContextValue {
  const ctx = useContext(RealtimeContext);
  if (!ctx) {
    throw new Error('useRealtime must be used within a RealtimeProvider');
  }
  return ctx;
}
