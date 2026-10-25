import { describe, it, expect, afterEach } from 'vitest';
import { SimulatorProvider } from '../src/providers/simulator.js';
import { SseHub } from '../src/services/sse.js';
import { IngestService } from '../src/services/ingest.js';
import { ensureSeed } from '../src/db/seed.js';
import { SessionRepo } from '../src/repositories/sessions.js';
import { IntervalRepo } from '../src/repositories/intervals.js';
import { MappingRepo } from '../src/repositories/mappings.js';
import { StudentRepo } from '../src/repositories/students.js';
import { SettingRepo } from '../src/repositories/settings.js';
import { createTempDb, type TempDb } from './helpers/tempDb.js';
import { silentLogger } from './helpers/logger.js';

const dbs: TempDb[] = [];
afterEach(() => {
  while (dbs.length) dbs.pop()?.cleanup();
});

const T0 = Date.parse('2026-05-04T09:00:00.000Z');

interface Rig {
  sessions: SessionRepo;
  intervals: IntervalRepo;
  provider: SimulatorProvider;
  frames: string[];
  /** Advances the fake wall clock and runs one simulator tick. */
  advance(ms: number): void;
}

/**
 * Simulator rig with an injectable clock. The session starts `startOffsetMs`
 * after T0 and lasts 45 sim minutes at the given time scale.
 */
function rig(timeScale: number, startOffsetMs = 15_000): Rig {
  const t = createTempDb();
  dbs.push(t);
  ensureSeed(t.db, { seedSessions: false });

  let now = T0;
  const clock = () => now;

  const sessions = new SessionRepo(t.db);
  const intervals = new IntervalRepo(t.db);
  const mappings = new MappingRepo(t.db);
  const students = new StudentRepo(t.db);
  const settings = new SettingRepo(t.db);
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

  sessions.create({
    title: 'Science',
    meetingCode: 'abc-defg-hij',
    startsAt: new Date(T0 + startOffsetMs).toISOString(),
    endsAt: new Date(T0 + startOffsetMs + 45 * 60_000).toISOString(),
    lateThresholdMinutes: 10,
    status: 'scheduled',
    timeScale,
  });

  const provider = new SimulatorProvider({ clock, autoStart: false });
  void provider.start({
    ingest,
    hub,
    sessions,
    intervals,
    students,
    settings,
    logger: silentLogger,
  });

  return {
    sessions,
    intervals,
    provider,
    frames,
    advance(ms: number) {
      now += ms;
      provider.tick();
    },
  };
}

describe('SimulatorProvider', () => {
  it('plays a session in compressed time: joins flow, session activates then ends', () => {
    const { sessions, intervals, frames, advance } = rig(30);
    const session = sessions.list()[0]!;

    for (let step = 0; step < 130; step++) advance(1000);

    // At speed 30 the 45-minute session ends after ~90 wall seconds (+15 s lead).
    expect(sessions.get(session.id)?.status).toBe('ended');
    expect(intervals.countBySession(session.id)).toBeGreaterThan(0);
    expect(intervals.listOpenBySession(session.id)).toHaveLength(0);
    expect(frames.filter((f) => f.includes('event: activity')).length).toBeGreaterThan(10);

    const stored = intervals.listBySession(session.id);
    expect(stored.every((i) => i.source === 'simulator')).toBe(true);
  });

  it('waits for the scheduled start (wall time) before simulating', () => {
    const { sessions, intervals, frames, advance } = rig(10, 60_000);
    const session = sessions.list()[0]!;

    for (let step = 0; step < 10; step++) advance(5000); // 50 s: before the 60 s start
    expect(sessions.get(session.id)?.status).toBe('scheduled');
    // Only a handful of early joiners (join window starts 2 min before start);
    // the bulk of the class has not entered yet.
    expect(intervals.countBySession(session.id)).toBeLessThan(10);

    // 45 sim minutes at speed 10 = 270 wall seconds, starting at +60 s.
    for (let step = 0; step < 80; step++) advance(5000);
    expect(sessions.get(session.id)?.status).toBe('ended');
    expect(intervals.countBySession(session.id)).toBeGreaterThan(10);
    expect(frames.filter((f) => f.includes('event: activity')).length).toBeGreaterThan(10);
  });

  it('advances the persisted clock offset faster than wall time', () => {
    const { sessions, advance } = rig(20);
    const session = sessions.list()[0]!;

    advance(30_000); // inside the session
    const first = sessions.get(session.id)!.clockOffsetMs;
    advance(10_000);
    const second = sessions.get(session.id)!.clockOffsetMs;

    expect(first).not.toBeNaN();
    // Offset must grow faster than the 10 s of wall time that passed.
    expect(second - first).toBeGreaterThan(10_000);
  });

  it('backfills history for ended sessions with no intervals', () => {
    const t = createTempDb();
    dbs.push(t);
    ensureSeed(t.db, { seedSessions: false });
    const sessions = new SessionRepo(t.db);
    const intervals = new IntervalRepo(t.db);
    const students = new StudentRepo(t.db);
    const settings = new SettingRepo(t.db);
    const hub = new SseHub();
    const ingest = new IngestService({
      sessions,
      intervals,
      students,
      mappings: new MappingRepo(t.db),
      hub,
      logger: silentLogger,
    });

    const ended = sessions.create({
      title: 'Yesterday',
      meetingCode: 'abc-defg-hij',
      startsAt: new Date(T0 - 24 * 3600_000).toISOString(),
      endsAt: new Date(T0 - 24 * 3600_000 + 45 * 60_000).toISOString(),
      status: 'ended',
    });

    const now = T0;
    const provider = new SimulatorProvider({ clock: () => now, autoStart: false });
    void provider.start({
      ingest,
      hub,
      sessions,
      intervals,
      students,
      settings,
      logger: silentLogger,
    });
    provider.tick();

    expect(intervals.countBySession(ended.id)).toBeGreaterThan(0);
    expect(sessions.get(ended.id)?.status).toBe('ended');
  });

  it('finalizes sessions whose window was missed entirely', () => {
    const t = createTempDb();
    dbs.push(t);
    ensureSeed(t.db, { seedSessions: false });
    const sessions = new SessionRepo(t.db);
    const intervals = new IntervalRepo(t.db);
    const students = new StudentRepo(t.db);
    const settings = new SettingRepo(t.db);
    const hub = new SseHub();
    const ingest = new IngestService({
      sessions,
      intervals,
      students,
      mappings: new MappingRepo(t.db),
      hub,
      logger: silentLogger,
    });

    const missed = sessions.create({
      title: 'Missed',
      meetingCode: 'abc-defg-hij',
      startsAt: new Date(T0 - 2 * 3600_000).toISOString(),
      endsAt: new Date(T0 - 1 * 3600_000).toISOString(),
      status: 'scheduled',
    });

    const provider = new SimulatorProvider({ clock: () => T0, autoStart: false });
    // start() runs one tick: the missed window is flagged ended, no data.
    void provider.start({
      ingest,
      hub,
      sessions,
      intervals,
      students,
      settings,
      logger: silentLogger,
    });

    expect(sessions.get(missed.id)?.status).toBe('ended');
    expect(intervals.countBySession(missed.id)).toBe(0);
    expect(provider.status().state).toBe('running');
  });
});
