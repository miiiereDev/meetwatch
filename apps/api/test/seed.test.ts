import { describe, it, expect, afterEach } from 'vitest';
import { ensureSeed, SEED_STUDENTS } from '../src/db/seed.js';
import { StudentRepo } from '../src/repositories/students.js';
import { SessionRepo } from '../src/repositories/sessions.js';
import { createTempDb, type TempDb } from './helpers/tempDb.js';

const dbs: TempDb[] = [];
afterEach(() => {
  while (dbs.length) dbs.pop()?.cleanup();
});

function tempDb() {
  const t = createTempDb();
  dbs.push(t);
  return t;
}

describe('ensureSeed', () => {
  it('seeds roster and three sessions on a fresh database', () => {
    const { db } = tempDb();
    const result = ensureSeed(db, {
      rosterSize: 25,
      simulatorSpeed: 20,
      now: new Date('2026-05-04T08:00:00Z'),
    });

    expect(result.seededStudents).toBe(25);
    expect(result.seededSessions).toBe(3);

    const sessions = new SessionRepo(db).list();
    // Today's session is seeded as scheduled; the ingest scheduler activates it
    // when its window starts.
    expect(sessions.map((s) => s.status).sort()).toEqual(
      ['ended', 'scheduled', 'scheduled'].sort(),
    );

    const students = new StudentRepo(db).list();
    expect(students).toHaveLength(25);
    expect(students.every((s) => s.email.includes('@'))).toBe(true);
  });

  it('is idempotent across repeated runs', () => {
    const { db } = tempDb();
    const now = new Date('2026-05-04T08:00:00Z');
    ensureSeed(db, { now });
    const again = ensureSeed(db, { now });
    expect(again).toEqual({ seededStudents: 0, seededSessions: 0 });
    expect(new SessionRepo(db).count()).toBe(3);
    expect(new StudentRepo(db).count()).toBe(25);
  });

  it('supports a smaller roster size', () => {
    const { db } = tempDb();
    ensureSeed(db, { rosterSize: 10, now: new Date() });
    expect(new StudentRepo(db).count()).toBe(10);
    expect(SEED_STUDENTS.length).toBeGreaterThanOrEqual(25);
  });
});
