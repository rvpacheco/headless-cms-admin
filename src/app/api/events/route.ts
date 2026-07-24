import { encodeEvent } from '@/lib/realtime/events';
import { subscribe } from '@/lib/realtime/bus';

// GET /api/events — Server-Sent Events stream. Clients connect with a single
// EventSource; the stream stays open, pushing events published on the in-process
// bus. Uses the Web ReadableStream API directly (per the Next.js route docs).

// Never cache or buffer a live stream.
export const dynamic = 'force-dynamic';

const HEARTBEAT_MS = 25_000;

export async function GET(request: Request) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      // Set the client's auto-reconnect delay, and confirm the connection.
      controller.enqueue(encoder.encode('retry: 3000\n'));
      controller.enqueue(encoder.encode(': connected\n\n'));

      // Forward every published event to this client.
      const unsubscribe = subscribe((event) => {
        try {
          controller.enqueue(encoder.encode(encodeEvent(event)));
        } catch {
          cleanup();
        }
      });

      // Heartbeat comment keeps intermediaries from idling the socket and
      // surfaces a dead connection via a failing write.
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': ping\n\n'));
        } catch {
          cleanup();
        }
      }, HEARTBEAT_MS);

      let closed = false;
      function cleanup() {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // Already closed.
        }
      }

      // The client disconnected (tab closed, navigated away, network dropped).
      request.signal.addEventListener('abort', cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
