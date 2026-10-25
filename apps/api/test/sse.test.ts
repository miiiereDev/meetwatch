import { describe, it, expect, afterEach } from 'vitest';
import { createApp } from '../src/app.js';
import { createTempDb, type TempDb } from './helpers/tempDb.js';

const dbs: TempDb[] = [];
const apps: { close(): Promise<void> }[] = [];
afterEach(async () => {
  while (apps.length) await apps.pop()?.close();
  while (dbs.length) dbs.pop()?.cleanup();
});

async function readChunk(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  ms = 2000,
): Promise<string> {
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), ms));
  const chunk = await Promise.race([reader.read(), timeout]);
  if (chunk === null || chunk.done || !chunk.value) return '';
  return new TextDecoder().decode(chunk.value);
}

describe('GET /api/events/stream (SSE)', () => {
  it('streams hub events to connected clients', async () => {
    const t = createTempDb();
    dbs.push(t);
    const app = await createApp({ quiet: true, dbFile: t.file });
    apps.push(app);
    await app.listen({ port: 0, host: '127.0.0.1' });
    const address = app.server.address();
    if (address === null || typeof address === 'string') throw new Error('no port');
    const url = `http://127.0.0.1:${address.port}/api/events/stream`;

    const res = await fetch(url, { headers: { accept: 'text/event-stream' } });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/event-stream');
    if (!res.body) throw new Error('no body');

    const reader = res.body.getReader();
    const first = await readChunk(reader);
    expect(first).toContain(': connected');
    expect(first).toContain('event: hello');

    app.ctx.hub.publish('activity', { sessionId: 's1', item: { kind: 'join' } });
    const second = await readChunk(reader);
    expect(second).toContain('event: activity');
    expect(second).toContain('s1');

    app.ctx.hub.publish('refresh', { sessionId: 's1', kind: 'statuses' });
    const third = await readChunk(reader);
    expect(third).toContain('event: refresh');

    await reader.cancel();
  });

  it('tracks client connections', async () => {
    const t = createTempDb();
    dbs.push(t);
    const app = await createApp({ quiet: true, dbFile: t.file });
    apps.push(app);
    await app.listen({ port: 0, host: '127.0.0.1' });
    const address = app.server.address();
    if (address === null || typeof address === 'string') throw new Error('no port');

    expect(app.ctx.hub.count()).toBe(0);
    const controller = new AbortController();
    const res = await fetch(`http://127.0.0.1:${address.port}/api/events/stream`, {
      signal: controller.signal,
    });
    await res.body!.getReader().read();
    expect(app.ctx.hub.count()).toBe(1);

    controller.abort();
    await new Promise((r) => setTimeout(r, 100));
    expect(app.ctx.hub.count()).toBe(0);
  });
});
