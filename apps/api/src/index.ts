import { env } from './config.js';
import { createApp } from './app.js';

async function main(): Promise<void> {
  const app = await createApp();
  try {
    await app.listen({ port: env.PORT, host: env.HOST });
  } catch (err) {
    app.log.error(err, 'failed to start API server');
    process.exit(1);
  }
}

void main();
