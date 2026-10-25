import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { DB } from './client.js';

/**
 * Runs all pending SQL migrations in filename order inside a transaction.
 * Idempotent: applied migrations are tracked in schema_migrations.
 */
export function migrate(db: DB, migrationsDir: string): string[] {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  const appliedRows = db.prepare('SELECT id FROM schema_migrations').all() as { id: string }[];
  const applied = new Set(appliedRows.map((r) => r.id));

  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const apply = db.transaction((id: string, sql: string) => {
    db.exec(sql);
    db.prepare('INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)').run(
      id,
      new Date().toISOString(),
    );
  });

  const newlyApplied: string[] = [];
  for (const file of files) {
    const id = file.replace(/\.sql$/, '');
    if (applied.has(id)) continue;
    apply(id, readFileSync(path.join(migrationsDir, file), 'utf8'));
    newlyApplied.push(id);
  }
  return newlyApplied;
}
