import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { loadEnv, type Env } from './env.js';
import { buildContext, type BuildContextOptions, type ServerContext } from './context.js';
import { healthRoutes } from './routes/health.js';
import { sseRoutes } from './routes/sse.js';
import { sessionRoutes } from './routes/sessions.js';
import { rosterRoutes } from './routes/roster.js';
import { mappingRoutes } from './routes/mappings.js';
import { settingsRoutes } from './routes/settings.js';

declare module 'fastify' {
  interface FastifyInstance {
    ctx: ServerContext;
  }
}

export interface CreateAppOptions {
  /** Disable request/response logging (useful in tests). */
  quiet?: boolean;
  /** Environment overrides, e.g. { PROVIDER: 'csv' }. */
  envOverrides?: Record<string, string>;
  /** Absolute SQLite file path; defaults from env.DB_PATH. */
  dbFile?: string;
  /** Start the configured provider automatically (default false in tests). */
  startRunner?: boolean;
  /** Extra simulator tuning for tests. */
  simulatorOptions?: BuildContextOptions['simulatorOptions'];
}

export async function createApp(options: CreateAppOptions = {}): Promise<FastifyInstance> {
  const env: Env = loadEnv(options.envOverrides);
  const app = Fastify({
    logger: options.quiet
      ? false
      : {
          level: env.LOG_LEVEL,
          transport:
            process.env.NODE_ENV !== 'production'
              ? {
                  target: 'pino-pretty',
                  options: { translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname,reqId' },
                }
              : undefined,
        },
  });

  const ctx = buildContext({
    env,
    logger: app.log,
    dbFile: options.dbFile,
    simulatorOptions: options.simulatorOptions,
  });
  app.decorate('ctx', ctx);

  await app.register(cors, {
    origin: env.WEB_ORIGIN,
    credentials: true,
  });

  // Raw CSV bodies (roster import, attendance import).
  app.addContentTypeParser(
    ['text/csv', 'application/csv', 'application/vnd.ms-excel'],
    { parseAs: 'string' },
    (_req, body, done) => done(null, body),
  );

  await app.register(healthRoutes, { prefix: '/api' });
  await app.register(sseRoutes, { prefix: '/api' });
  await app.register(sessionRoutes, { prefix: '/api' });
  await app.register(rosterRoutes, { prefix: '/api' });
  await app.register(mappingRoutes, { prefix: '/api' });
  await app.register(settingsRoutes, { prefix: '/api' });

  app.addHook('onClose', async (instance) => {
    await instance.ctx.close();
  });

  if (options.startRunner) {
    await ctx.runner.start();
  }

  return app;
}
