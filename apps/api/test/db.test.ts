import { describe, it, expect, afterEach } from 'vitest';
import { migrate } from '../src/db/migrate.js';
import { DEFAULT_MIGRATIONS_DIR } from '../src/db/client.js';
import { createTempDb, type TempDb } from './helpers/tempDb.js';
import { StudentRepo } from '../src/repositories/students.js';
import { SessionRepo } from '../src/repositories/sessions.js';
import { IntervalRepo } from '../src/repositories/intervals.js';
import { MappingRepo } from '../src/repositories/mappings.js';
import { SettingRepo } from '../src/repositories/settings.js';

const dbs: TempDb[] = [];
afterEach(() => {
  while (dbs.length) dbs.pop()?.cleanup();
});

function tempDb(options?: { autoMigrate?: boolean }): TempDb {
  const t = createTempDb(options);
  dbs.push(t);
  return t;
}

describe('migrations', () => {
  it('applies migrations and is idempotent', () => {
    const { db } = tempDb({ autoMigrate: false });
    const first = migrate(db, DEFAULT_MIGRATIONS_DIR);
    expect(first.length).toBeGreaterThan(0);
    const second = migrate(db, DEFAULT_MIGRATIONS_DIR);
    expect(second).toEqual([]);
  });
});

describe('StudentRepo', () => {
  it('creates, finds by email (case-insensitive), and upserts', () => {
    const { db } = tempDb();
    const repo = new StudentRepo(db);

    const created = repo.create({
      name: 'Ava Thompson',
      email: 'Ava.T@school.edu',
      section: '10-A',
    });
    expect(repo.get(created.id)?.name).toBe('Ava Thompson');
    expect(repo.getByEmail('ava.t@SCHOOL.edu')?.id).toBe(created.id);
    expect(repo.getByEmail('nobody@school.edu')).toBeNull();

    const upserted = repo.upsert({ name: 'Ava T.', email: 'ava.t@school.edu', section: '10-B' });
    expect(upserted.id).toBe(created.id);
    expect(upserted.name).toBe('Ava T.');
    expect(upserted.section).toBe('10-B');
    expect(repo.count()).toBe(1);

    expect(repo.delete(created.id)).toBe(true);
    expect(repo.get(created.id)).toBeNull();
  });
});

describe('SessionRepo', () => {
  it('creates, updates, and looks up by meeting code on a day', () => {
    const { db } = tempDb();
    const repo = new SessionRepo(db);

    const created = repo.create({
      title: 'Science',
      meetingCode: 'abc-defg-hij',
      startsAt: '2026-05-01T01:00:00.000Z',
      endsAt: '2026-05-01T01:45:00.000Z',
      lateThresholdMinutes: 10,
      minAttendancePct: 75,
      status: 'scheduled',
      timeScale: 20,
    });

    expect(repo.get(created.id)?.meetingCode).toBe('abc-defg-hij');
    expect(repo.getByMeetingCodeOnDay('abc-defg-hij', '2026-05-01T09:30:00.000Z')?.id).toBe(
      created.id,
    );
    expect(repo.getByMeetingCodeOnDay('abc-defg-hij', '2026-05-02T09:30:00.000Z')).toBeNull();

    repo.setStatus(created.id, 'active');
    expect(repo.get(created.id)?.status).toBe('active');

    const updated = repo.update(created.id, { lateThresholdMinutes: 5, title: 'Science lab' });
    expect(updated?.lateThresholdMinutes).toBe(5);
    expect(updated?.minAttendancePct).toBe(75);

    expect(repo.delete(created.id)).toBe(true);
    expect(repo.get(created.id)).toBeNull();
  });
});

describe('IntervalRepo', () => {
  it('inserts intervals, dedupes, closes single and all open rows', () => {
    const { db } = tempDb();
    const sessions = new SessionRepo(db);
    const intervals = new IntervalRepo(db);
    const session = sessions.create({
      meetingCode: 'abc-defg-hij',
      startsAt: '2026-05-01T01:00:00.000Z',
      status: 'active',
    });

    const first = intervals.insert({
      sessionId: session.id,
      participantKey: 'ava.thompson@student.myschool.edu',
      email: 'ava.thompson@student.myschool.edu',
      displayName: 'Ava Thompson',
      joinedAt: '2026-05-01T01:00:10.000Z',
      source: 'simulator',
    });
    expect(first).not.toBeNull();

    const duplicate = intervals.insert({
      sessionId: session.id,
      participantKey: 'ava.thompson@student.myschool.edu',
      email: 'ava.thompson@student.myschool.edu',
      displayName: 'Ava Thompson',
      joinedAt: '2026-05-01T01:00:10.000Z',
      source: 'simulator',
    });
    expect(duplicate).toBeNull();
    expect(intervals.countBySession(session.id)).toBe(1);

    const rejoin = intervals.insert({
      sessionId: session.id,
      participantKey: 'ava.thompson@student.myschool.edu',
      email: 'ava.thompson@student.myschool.edu',
      displayName: 'Ava Thompson',
      joinedAt: '2026-05-01T01:20:00.000Z',
    });
    expect(rejoin).not.toBeNull();

    expect(intervals.close(first!.id, '2026-05-01T01:10:00.000Z')).toBe(true);
    expect(intervals.close(first!.id, '2026-05-01T01:11:00.000Z')).toBe(false);

    const open = intervals.listOpenBySession(session.id);
    expect(open).toHaveLength(1);
    expect(open[0]!.id).toBe(rejoin!.id);

    expect(intervals.closeAllOpen(session.id, '2026-05-01T01:45:00.000Z')).toBe(1);
    expect(intervals.listOpenBySession(session.id)).toHaveLength(0);
    expect(intervals.listBySession(session.id)).toHaveLength(2);
  });
});

describe('MappingRepo', () => {
  it('upserts by raw key and deletes', () => {
    const { db } = tempDb();
    const students = new StudentRepo(db);
    const mappings = new MappingRepo(db);
    const student = students.create({ name: 'Ava Thompson', email: 'ava@school.edu' });

    mappings.upsert({
      rawKey: 'ava t',
      rawName: 'ava t',
      rawEmail: 'ava.t@gmail.com',
      studentId: student.id,
    });
    expect(mappings.getByKey('ava t')?.studentId).toBe(student.id);

    const other = students.create({ name: 'Ava Two', email: 'ava2@school.edu' });
    mappings.upsert({ rawKey: 'ava t', rawName: 'ava t', studentId: other.id });
    expect(mappings.getByKey('ava t')?.studentId).toBe(other.id);
    expect(mappings.list()).toHaveLength(1);

    expect(mappings.deleteByKey('ava t')).toBe(true);
    expect(mappings.getByKey('ava t')).toBeNull();
  });
});

describe('SettingRepo', () => {
  it('stores strings and JSON values', () => {
    const { db } = tempDb();
    const repo = new SettingRepo(db);
    expect(repo.get('provider')).toBeNull();
    repo.set('provider', 'simulator');
    repo.set('provider', 'google');
    expect(repo.get('provider')).toBe('google');

    repo.setJSON('google.tokens', { refreshToken: 'r1' });
    expect(repo.getJSON<{ refreshToken: string }>('google.tokens')?.refreshToken).toBe('r1');

    const all = repo.getAll();
    expect(all['provider']).toBe('google');
  });
});
