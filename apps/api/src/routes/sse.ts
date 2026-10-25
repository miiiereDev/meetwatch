import type { FastifyPluginAsync } from 'fastify';

/**
 * Server-Sent Events stream. One connection per browser tab; the API pushes
 * activity, refresh hints, session changes, and provider status changes.
 */
export const sseRoutes: FastifyPluginAsync = async (app) => {
  app.get('/events/stream', async (_req, reply) => {
    reply.hijack();
    const raw = reply.raw;
    raw.writeHead(200, {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    });
    raw.write(': connected\n\n');

    const client = app.ctx.hub.add({
      write: (chunk: string) => raw.write(chunk),
    });
    app.ctx.hub.send(client, 'hello', { provider: app.ctx.runner.currentName() });

    _req.raw.on('close', () => {
      app.ctx.hub.remove(client);
    });
  });
};
