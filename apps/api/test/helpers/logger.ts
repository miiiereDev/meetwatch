import type { ProviderLogger } from '../../src/providers/types.js';

/** Silent logger for tests. */
export const silentLogger: ProviderLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
};

/** Logger that records calls so tests can assert on warnings/errors. */
export function recordingLogger(): ProviderLogger & {
  calls: { level: string; obj: object; msg?: string }[];
} {
  const calls: { level: string; obj: object; msg?: string }[] = [];
  const log = (level: string) => (obj: object, msg?: string) => {
    calls.push({ level, obj, msg });
  };
  return { calls, info: log('info'), warn: log('warn'), error: log('error'), debug: log('debug') };
}
