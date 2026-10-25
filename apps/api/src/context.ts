import path from 'node:path';
import { mkdirSync } from 'node:fs';
import type { DB } from './db/client.js';
import { openDatabase } from './db/client.js';
import { ensureSeed } from './db/seed.js';
import type { ClassSession } from './domain/types.js';
import type { Env } from './env.js';
import type { SessionStatusReport } from './domain/status.js';
import { computeSessionReport, sessionEffectiveNow } from './domain/status.js';
import { IntervalRepo } from './repositories/intervals.js';
import { MappingRepo } from './repositories/mappings.js';
import { SessionRepo } from './repositories/sessions.js';
import { SettingRepo } from './repositories/settings.js';
import { StudentRepo } from './repositories/students.js';
import { IngestService } from './services/ingest.js';
import { ProviderRunner } from './services/providerRunner.js';
import { GoogleAuthService } from './services/googleAuth.js';
import { SseHub } from './services/sse.js';
import type { ProviderLogger, ProviderName } from './providers/types.js';
import type { SimulatorOptions } from './providers/simulator.js';

export interface ServerContext {
  env: Env;
  db: DB;
  students: StudentRepo;
  sessions: SessionRepo;
  intervals: IntervalRepo;
  mappings: MappingRepo;
  settings: SettingRepo;
  hub: SseHub;
  ingest: IngestService;
  runner: ProviderRunner;
  googleAuth: GoogleAuthService;
  /** Computes the live report for a session at an effective "now". */
  report(session: ClassSession, wallMs?: number): SessionStatusReport;
  close(): Promise<void>;
}

export interface BuildContextOptions {
  env: Env;
  logger: ProviderLogger;
  /** Absolute path for the SQLite file; defaults next to apps/api. */
  dbFile?: string;
  simulatorOptions?: SimulatorOptions;
  /** Skip automatic provider startup (tests start it manually). */
  autostart?: boolean;
}

/** Resolves DB_PATH relative to the api package root (works from src and dist). */
export function resolveDbPath(env: Env): string {
  return path.resolve(import.meta.dirname, '..', env.DB_PATH);
}

export function buildContext(options: BuildContextOptions): ServerContext {
  const { env, logger } = options;
  const dbFile = options.dbFile ?? resolveDbPath(env);
  mkdirSync(path.dirname(dbFile), { recursive: true });
  const db = openDatabase(dbFile);

  // Demo content only makes sense for the simulator; roster is always seeded.
  ensureSeed(db, {
    rosterSize: env.SIMULATOR_ROSTER_SIZE,
    lateThresholdMinutes: env.LATE_THRESHOLD_MINUTES,
    minAttendancePct: env.MIN_ATTENDANCE_PCT,
    simulatorSpeed: env.SIMULATOR_SPEED,
    seedSessions: env.PROVIDER === 'simulator',
  });

  const students = new StudentRepo(db);
  const sessions = new SessionRepo(db);
  const intervals = new IntervalRepo(db);
  const mappings = new MappingRepo(db);
  const settings = new SettingRepo(db);
  const hub = new SseHub();

  const ingest = new IngestService({ sessions, intervals, students, mappings, hub, logger });
  const services = { ingest, hub, sessions, intervals, students, settings, logger };
  const googleAuth = new GoogleAuthService(env, settings);

  if (settings.get('provider') === null) {
    settings.set('provider', env.PROVIDER);
  }
  const providerName = (settings.get('provider') ?? env.PROVIDER) as ProviderName;
  const runner = new ProviderRunner(services, providerName, env);

  return {
    env,
    db,
    students,
    sessions,
    intervals,
    mappings,
    settings,
    hub,
    ingest,
    runner,
    googleAuth,
    report(session: ClassSession, wallMs = Date.now()): SessionStatusReport {
      const now = sessionEffectiveNow(session, wallMs);
      return computeSessionReport({
        session,
        students: students.list(),
        intervals: intervals.listBySession(session.id),
        mappings: mappings.list(),
        now,
      });
    },
    async close() {
      await runner.stop();
      hub.stop();
      db.close();
    },
  };
}
