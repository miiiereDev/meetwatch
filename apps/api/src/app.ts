import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { env } from './config.js';
import { healthRoutes } from './routes/health.js';

export interface CreateAppOptions {
  /** Disable request/response logging (useful in tests). */
  quiet?: boolean;
}

export async function createApp(options: CreateAppOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: options.quiet
      ? false
      : {
          level: env.LOG_LEVEL,
          transport:
            process.env.NODE_ENV !== 'production'
              ? { target: 'pino-pretty', options: { translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname,reqId' } }
              : undefined,
        },
  });

  await app.register(cors, {
    origin: env.WEB_ORIGIN,
    credentials: true,
  });

  await app.register(healthRoutes, { prefix: '/api' });

  return app;
}
