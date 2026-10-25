import { describe, it, expect, afterEach } from 'vitest';
import { IngestService } from '../src/services/ingest.js';
import { SseHub, type SseClient } from '../src/services/sse.js';
import { ensureSeed } from '../src/db/seed.js';
import { SessionRepo } from '../src/repositories/sessions.js';
import { IntervalRepo } from '../src/repositories/intervals.js';
import { MappingRepo } from '../src/repositories/mappings.js';
import { StudentRepo } from '../src/repositories/students.js';
import { createTempDb, type TempDb } from './helpers/tempDb.js';
import { silentLogger } from './helpers/logger.js';

const dbs: TempDb[] = [];
afterEach(() => {
  while (dbs.length) dbs.pop()?.cleanup();
});

function setup() {
  const t = createTempDb();
  dbs.push(t);
  ensureSeed(t.db, { seedSessions: false });
  const sessions = new SessionRepo(t.db);
  const intervals = new IntervalRepo(t.db);
  const mappings = new MappingRepo(t.db);
  const students = new StudentRepo(t.db);
  const hub = new SseHub();
  const frames: string[] = [];
  hub.add({ write: (chunk) => frames.push(chunk) });
  const ingest = new IngestService({
    sessions,
    intervals,
    students,
    mappings,
    hub,
    logger: silentLogger,
  });
  const session = sessions.create({
    title: 'Science',
    meetingCode: 'abc-defg-hij',
    startsAt: '2026-05-04T09:00:00.000Z',
    endsAt: '2026-05-04T09:45:00.000Z',
    status: 'active',
  });
  return { t, sessions, intervals, mappings, students, hub, frames, ingest, session };
}

describe('IngestService', () => {
  it('persists a join, matches the roster by email, and broadcasts activity', () => {
    const { intervals, ingest, frames, students, session } = setup();
    const ava = students.list()[0]!;

    const result = ingest.ingestEvent({
      meetingCode: 'abc-defg-hij',
      studentEmail: ava.email,
      displayName: 'Ava Thompson',
      joinedAt: '2026-05-04T09:00:10.000Z',
      leftAt: null,
      source: 'simulator',
    });
    expect(result?.sessionId).toBe(session.id);

    const stored = intervals.listBySession(session.id);
    expect(stored).toHaveLength(1);
    expect(stored[0]!.participantKey).toBe(ava.email);

    const activity = frames.filter((f) => f.includes('event: activity'));
    expect(activity).toHaveLength(1);
    expect(activity[0]).toContain('"' + ava.name + '"');
  });

  it('closes an open interval when a matching leave event arrives (no duplicate row)', () => {
    const { intervals, ingest, session } = setup();
    ingest.ingestEvent({
      meetingCode: 'abc-defg-hij',
      studentEmail: 'ava.thompson@student.myschool.edu',
      displayName: 'Ava Thompson',
      joinedAt: '2026-05-04T09:00:10.000Z',
      leftAt: null,
      source: 'simulator',
    });
    ingest.ingestEvent({
      meetingCode: 'abc-defg-hij',
      studentEmail: 'ava.thompson@student.myschool.edu',
      displayName: 'Ava Thompson',
      joinedAt: '2026-05-04T09:00:10.000Z',
      leftAt: '2026-05-04T09:12:00.000Z',
      source: 'simulator',
    });
    const stored = intervals.listBySession(session.id);
    expect(stored).toHaveLength(1);
    expect(stored[0]!.leftAt).toBe('2026-05-04T09:12:00.000Z');
  });

  it('stores unknown participants under a name key', () => {
    const { intervals, ingest, session } = setup();
    ingest.ingestEvent({
      meetingCode: 'abc-defg-hij',
      studentEmail: null,
      displayName: 'Guest 424242',
      joinedAt: '2026-05-04T09:05:00.000Z',
      leftAt: null,
      source: 'simulator',
    });
    const stored = intervals.listBySession(session.id);
    expect(stored[0]!.participantKey).toBe('guest 424242');
  });

  it('ignores events for unknown meeting codes', () => {
    const { intervals, ingest } = setup();
    const result = ingest.ingestEvent({
      meetingCode: 'nope-nope-nope',
      studentEmail: null,
      displayName: 'Ghost',
      joinedAt: '2026-05-04T09:05:00.000Z',
      leftAt: null,
      source: 'simulator',
    });
    expect(result).toBeNull();
    expect(intervals.countBySession('none')).toBe(0);
  });

  it('closeSession closes open intervals and marks the session ended', () => {
    const { intervals, ingest, sessions, session, frames } = setup();
    ingest.ingestEvent({
      meetingCode: 'abc-defg-hij',
      studentEmail: 'ava.thompson@student.myschool.edu',
      displayName: 'Ava Thompson',
      joinedAt: '2026-05-04T09:00:10.000Z',
      leftAt: null,
      source: 'simulator',
    });
    ingest.closeSession(session.id, '2026-05-04T09:45:00.000Z');
    expect(intervals.listOpenBySession(session.id)).toHaveLength(0);
    expect(sessions.get(session.id)?.status).toBe('ended');
    expect(frames.some((f) => f.includes('event: sessions'))).toBe(true);
  });
});

describe('SseHub', () => {
  it('fans events out to clients and cleans up on remove', () => {
    const hub = new SseHub();
    const writes: string[] = [];
    const client: SseClient = hub.add({ write: (c) => writes.push(c) });
    hub.publish('activity', { sessionId: 's1' });
    expect(writes.some((w) => w.includes('event: activity'))).toBe(true);
    expect(hub.count()).toBe(1);
    hub.send(client, 'hello', { a: 1 });
    expect(writes.some((w) => w.includes('event: hello'))).toBe(true);
    hub.remove(client);
    expect(hub.count()).toBe(0);
  });
});
