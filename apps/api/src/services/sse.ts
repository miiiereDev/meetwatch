export interface SseClient {
  id: number;
  /** Writes one SSE frame; must not throw on closed connections. */
  write(chunk: string): void;
}

/**
 * Fans Server-Sent Events out to all connected dashboard clients.
 * Message kinds:
 *  - activity  { sessionId, item }      one join/leave event
 *  - refresh   { sessionId, kind }      hint to refetch a query
 *  - sessions  {}                       the session list changed
 *  - provider  { name, status }         provider status changed
 * Heartbeats are comment lines so proxies keep the stream alive.
 */
export class SseHub {
  private clients = new Map<number, SseClient>();
  private nextId = 1;
  private heartbeat: NodeJS.Timeout | null = null;

  add(client: Omit<SseClient, 'id'>): SseClient {
    const withId: SseClient = { ...client, id: this.nextId++ };
    this.clients.set(withId.id, withId);
    this.ensureHeartbeat();
    return withId;
  }

  remove(client: SseClient): void {
    this.clients.delete(client.id);
    if (this.clients.size === 0 && this.heartbeat) {
      clearInterval(this.heartbeat);
      this.heartbeat = null;
    }
  }

  count(): number {
    return this.clients.size;
  }

  /** Sends a named event with a JSON payload to every client. */
  publish(event: string, payload: unknown = {}): void {
    const data = JSON.stringify(payload);
    this.broadcast(`event: ${event}\ndata: ${data}\n\n`);
  }

  /** Sends a named event to a single client (e.g. a snapshot on connect). */
  send(client: SseClient, event: string, payload: unknown = {}): void {
    client.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
  }

  broadcast(chunk: string): void {
    for (const client of this.clients.values()) {
      try {
        client.write(chunk);
      } catch {
        this.remove(client);
      }
    }
  }

  clientIds(): number[] {
    return [...this.clients.keys()];
  }

  stop(): void {
    if (this.heartbeat) {
      clearInterval(this.heartbeat);
      this.heartbeat = null;
    }
  }

  private ensureHeartbeat(): void {
    if (this.heartbeat) return;
    this.heartbeat = setInterval(() => {
      this.broadcast(': ping\n\n');
    }, 15_000);
    this.heartbeat.unref();
  }
}
