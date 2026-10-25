import Database from 'better-sqlite3';
import path from 'node:path';
import { migrate } from './migrate.js';

export type DB = Database.Database;

export const DEFAULT_MIGRATIONS_DIR = path.join(import.meta.dirname, '../../migrations');

export interface DatabaseOptions {
  /** Directory containing NNN_name.sql migration files. */
  migrationsDir?: string;
  fileMustExist?: boolean;
  /** Set false to open the raw database without running migrations. */
  migrate?: boolean;
}

export function openDatabase(file: string, options: DatabaseOptions = {}): DB {
  const db = new Database(file, { fileMustExist: options.fileMustExist ?? false });
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  if (options.migrate !== false) {
    migrate(db, options.migrationsDir ?? DEFAULT_MIGRATIONS_DIR);
  }
  return db;
}
