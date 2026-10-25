import { createApp } from './app.js';

async function main(): Promise<void> {
  const app = await createApp({ startRunner: true });
  try {
    await app.listen({ port: app.ctx.env.PORT, host: app.ctx.env.HOST });
  } catch (err) {
    app.log.error(err, 'failed to start API server');
    process.exit(1);
  }

  const shutdown = async (): Promise<void> => {
    app.log.info('shutting down');
    await app.close();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());
}

void main();
