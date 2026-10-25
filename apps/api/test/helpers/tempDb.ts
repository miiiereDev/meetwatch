import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { openDatabase, type DB } from '../../src/db/client.js';

export interface TempDb {
  db: DB;
  file: string;
  cleanup(): void;
}

/** Opens a throwaway SQLite database in the OS temp dir. */
export function createTempDb(options: { autoMigrate?: boolean } = {}): TempDb {
  const dir = mkdtempSync(path.join(tmpdir(), 'meetwatch-test-'));
  const file = path.join(dir, 'test.sqlite3');
  const db = openDatabase(file, { migrate: options.autoMigrate !== false });
  return {
    db,
    file,
    cleanup() {
      db.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}
