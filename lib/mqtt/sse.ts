/**
 * SSE client registry and broadcaster for real-time device updates.
 * Maintains a map of connected browser clients and sends events to all of them.
 */

type SseController = ReadableStreamDefaultController<Uint8Array>;

const clients = new Map<string, SseController>();

let keepAliveTimer: ReturnType<typeof setInterval> | null = null;

function ensureKeepAlive() {
  if (keepAliveTimer !== null) return;
  keepAliveTimer = setInterval(() => {
    const frame = new TextEncoder().encode(": keep-alive\n\n");
    for (const [id, ctrl] of clients) {
      try {
        ctrl.enqueue(frame);
      } catch {
        // Controller closed — remove stale client
        clients.delete(id);
      }
    }
    if (clients.size === 0) {
      clearInterval(keepAliveTimer!);
      keepAliveTimer = null;
    }
  }, 25_000);
}

export function addClient(id: string, controller: SseController): void {
  clients.set(id, controller);
  ensureKeepAlive();
}

export function removeClient(id: string): void {
  clients.delete(id);
}

export function broadcast(event: string, data: object): void {
  if (clients.size === 0) return;
  const frame = new TextEncoder().encode(
    `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`,
  );
  for (const [id, ctrl] of clients) {
    try {
      ctrl.enqueue(frame);
    } catch {
      clients.delete(id);
    }
  }
}
