import '@testing-library/jest-dom/vitest';

// jsdom has no EventSource; components subscribe on mount (App -> useLiveEvents),
// so provide a minimal stub that records subscriptions without network access.
class EventSourceStub {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 2;

  readonly CONNECTING = 0;
  readonly OPEN = 1;
  readonly CLOSED = 2;

  readyState = 0;
  url: string;
  onopen: ((ev: unknown) => void) | null = null;
  onmessage: ((ev: unknown) => void) | null = null;
  onerror: ((ev: unknown) => void) | null = null;

  #listeners = new Map<string, ((ev: unknown) => void)[]>();
  #closed = false;

  constructor(url: string) {
    this.url = url;
    queueMicrotask(() => {
      if (!this.#closed) this.readyState = 1;
    });
  }

  addEventListener(type: string, listener: (ev: unknown) => void): void {
    const list = this.#listeners.get(type) ?? [];
    list.push(listener);
    this.#listeners.set(type, list);
  }

  removeEventListener(type: string, listener: (ev: unknown) => void): void {
    const list = this.#listeners.get(type) ?? [];
    this.#listeners.set(
      type,
      list.filter((l) => l !== listener),
    );
  }

  dispatchEvent(): boolean {
    return true;
  }

  close(): void {
    this.#closed = true;
    this.readyState = 2;
  }
}

if (typeof globalThis.EventSource === 'undefined') {
  (globalThis as { EventSource: unknown }).EventSource = EventSourceStub;
}
