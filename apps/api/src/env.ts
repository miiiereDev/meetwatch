import { z } from 'zod';

const envSchema = z.object({
  PROVIDER: z.enum(['simulator', 'google', 'csv']).default('simulator'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  HOST: z.string().default('127.0.0.1'),
  LOG_LEVEL: z.string().default('info'),
  WEB_ORIGIN: z.string().default('http://localhost:5173'),
  DB_PATH: z.string().default('data/meetwatch.sqlite3'),
  SIMULATOR_SPEED: z.coerce.number().min(1).max(600).default(20),
  SIMULATOR_ROSTER_SIZE: z.coerce.number().int().min(1).max(100).default(25),
  LATE_THRESHOLD_MINUTES: z.coerce.number().int().min(0).max(240).default(10),
  MIN_ATTENDANCE_PCT: z.coerce.number().int().min(0).max(100).default(75),
  MEET_POLL_INTERVAL_MS: z.coerce.number().int().min(1000).default(15000),
  GOOGLE_CLIENT_ID: z.string().default(''),
  GOOGLE_CLIENT_SECRET: z.string().default(''),
  GOOGLE_REDIRECT_URI: z.string().default('http://localhost:4000/api/google/callback'),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

export function loadEnv(overrides: Partial<Record<string, string>> = {}): Env {
  if (cached && Object.keys(overrides).length === 0) return cached;
  const parsed = envSchema.safeParse({ ...process.env, ...overrides });
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid environment configuration: ${issues}`);
  }
  const env = parsed.data;
  if (Object.keys(overrides).length === 0) cached = env;
  return env;
}

/** Test helper: forget the cached env so overrides take effect. */
export function resetEnvCache(): void {
  cached = undefined;
}
