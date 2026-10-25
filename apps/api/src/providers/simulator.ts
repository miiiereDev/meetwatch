import type { ClassSession, Student } from '../domain/types.js';
import type { MeetProvider, ProviderServices, ProviderStatus } from './types.js';
import { buildSimulationScript } from './simulatorScript.js';
import { hashStringToSeed } from './rng.js';

const MINUTE = 60_000;
/** Sessions starting within this window get picked up by the simulator. */
const LAUNCH_WINDOW_MS = 2 * MINUTE;
/** Ended sessions newer than this get instant history backfill. */
const BACKFILL_WINDOW_MS = 3 * 24 * 60 * MINUTE;

export interface SimulatorOptions {
  /** Wall-clock interval between simulation steps (ms). */
  tickMs?: number;
  /** Injectable wall clock for tests. */
  clock?: () => number;
  /** Start the internal timer automatically (tests may drive tick() manually). */
  autoStart?: boolean;
  /** Extra entropy mixed into each session script seed. */
  seed?: number;
}

interface ScriptedEvent {
  t: number;
  event: {
    meetingCode: string;
    studentEmail: string;
    displayName: string;
    joinedAt: string;
    leftAt: string | null;
    source: string;
  };
}

interface PlayingSession {
  events: ScriptedEvent[];
  cursor: number;
  endsAtMs: number;
}

/**
 * Default provider: plays realistic fake sessions in compressed time so the
 * dashboard visibly changes during a demo. Behavior comes from a seeded
 * script per session; emission follows the session's `time_scale`.
 */
export class SimulatorProvider implements MeetProvider {
  readonly name = 'simulator' as const;
  private services: ProviderServices | null = null;
  private timer: NodeJS.Timeout | null = null;
  private playing = new Map<string, PlayingSession>();
  private statusState: ProviderStatus = { state: 'idle', updatedAt: new Date().toISOString() };

  constructor(private readonly options: SimulatorOptions = {}) {}

  async start(services: ProviderServices): Promise<void> {
    this.services = services;
    this.tick();
    this.statusState = { state: 'running', updatedAt: new Date().toISOString() };
    if (this.options.autoStart !== false) {
      this.timer = setInterval(() => this.tick(), this.options.tickMs ?? 500);
      this.timer.unref();
    }
  }

  async stop(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.playing.clear();
    this.statusState = { state: 'idle', updatedAt: new Date().toISOString() };
  }

  status(): ProviderStatus {
    return this.statusState;
  }

  /**
   * One simulation step: discovers sessions to play, advances every playing
   * session's simulated clock, and emits due join/leave events.
   */
  tick(): void {
    const services = this.services;
    if (!services) return;
    const wallNow = this.clock();
    this.discoverSessions(wallNow);

    for (const [sessionId, playing] of [...this.playing.entries()]) {
      const session = services.sessions.get(sessionId);
      if (!session) {
        this.playing.delete(sessionId);
        continue;
      }
      const startsAtMs = Date.parse(session.startsAt);
      // Simulated clock: real time before the session starts, then scaled by
      // time_scale. Depends only on wall time, so restarts are consistent.
      const speed = Math.max(1, session.timeScale);
      const simNow = wallNow < startsAtMs ? wallNow : startsAtMs + (wallNow - startsAtMs) * speed;

      while (
        playing.cursor < playing.events.length &&
        playing.events[playing.cursor]!.t <= simNow
      ) {
        services.ingest.ingestEvent(playing.events[playing.cursor]!.event);
        playing.cursor += 1;
      }

      if (session.status === 'scheduled' && wallNow >= startsAtMs) {
        services.sessions.setStatus(sessionId, 'active');
        services.hub.publish('sessions', { sessionId, reason: 'started' });
        services.logger.info(
          { sessionId, meetingCode: session.meetingCode },
          'simulator: session started',
        );
      }

      services.sessions.update(sessionId, { clockOffsetMs: Math.round(simNow - wallNow) });

      if (simNow >= playing.endsAtMs) {
        services.ingest.closeSession(sessionId, new Date(playing.endsAtMs).toISOString());
        services.sessions.update(sessionId, { clockOffsetMs: 0 });
        this.playing.delete(sessionId);
      }
    }
  }

  private clock(): number {
    return this.options.clock ? this.options.clock() : Date.now();
  }

  private discoverSessions(wallNow: number): void {
    const services = this.services;
    if (!services) return;

    const students = services.students.list();
    if (students.length === 0) {
      this.statusState = {
        state: 'error',
        message: 'roster is empty; add students to the roster',
        updatedAt: new Date().toISOString(),
      };
      return;
    }

    const sessions = services.sessions.list();
    for (const session of sessions) {
      if (this.playing.has(session.id)) continue;
      const startsAtMs = Date.parse(session.startsAt);
      const endsAtMs = session.endsAt ? Date.parse(session.endsAt) : null;

      if (session.status === 'ended') {
        this.backfillEndedSession(services, session, endsAtMs, students, wallNow);
        continue;
      }
      if (endsAtMs === null) {
        services.logger.warn(
          { sessionId: session.id },
          'simulator: session has no end time; skipping',
        );
        continue;
      }
      if (endsAtMs <= wallNow) {
        // Missed window entirely: finalize without playing.
        services.sessions.setStatus(session.id, 'ended');
        continue;
      }
      if (startsAtMs > wallNow + LAUNCH_WINDOW_MS) continue;
      this.startPlaying(services, session, startsAtMs, endsAtMs, students);
    }
  }

  private startPlaying(
    services: ProviderServices,
    session: ClassSession,
    startsAtMs: number,
    endsAtMs: number,
    students: Student[],
  ): void {
    const script = buildSimulationScript({
      rosterSize: students.length,
      startsAtMs,
      endsAtMs,
      lateThresholdMinutes: session.lateThresholdMinutes,
      seed: this.scriptSeed(session),
    });

    const events: ScriptedEvent[] = [];
    script.forEach((intervals, rosterIndex) => {
      const student = students[rosterIndex]!;
      for (const interval of intervals) {
        events.push({
          t: interval.joinedAtMs,
          event: {
            meetingCode: session.meetingCode,
            studentEmail: student.email,
            displayName: student.name,
            joinedAt: new Date(interval.joinedAtMs).toISOString(),
            source: 'simulator',
            leftAt: null,
          },
        });
        if (interval.leftAtMs !== null) {
          events.push({
            t: interval.leftAtMs,
            event: {
              meetingCode: session.meetingCode,
              studentEmail: student.email,
              displayName: student.name,
              joinedAt: new Date(interval.joinedAtMs).toISOString(),
              source: 'simulator',
              leftAt: new Date(interval.leftAtMs).toISOString(),
            },
          });
        }
      }
    });
    events.sort((a, b) => a.t - b.t);

    // After a restart the simulated clock resumes deterministically from wall
    // time, so no anchor state is needed.
    this.playing.set(session.id, { events, cursor: 0, endsAtMs });
    services.logger.info(
      {
        sessionId: session.id,
        meetingCode: session.meetingCode,
        scriptedEvents: events.length,
        timeScale: session.timeScale,
      },
      'simulator: session scripted',
    );
  }

  /**
   * Instantly generates full interval history for recently ended sessions with
   * no data, so the history page has content on first boot.
   */
  private backfillEndedSession(
    services: ProviderServices,
    session: ClassSession,
    endsAtMs: number | null,
    students: Student[],
    wallNow: number,
  ): void {
    if (!endsAtMs) return;
    if (endsAtMs < wallNow - BACKFILL_WINDOW_MS) return;
    if (services.intervals.countBySession(session.id) > 0) return;

    const startsAtMs = Date.parse(session.startsAt);
    const script = buildSimulationScript({
      rosterSize: students.length,
      startsAtMs,
      endsAtMs,
      lateThresholdMinutes: session.lateThresholdMinutes,
      seed: this.scriptSeed(session),
    });

    script.forEach((intervals, rosterIndex) => {
      const student = students[rosterIndex]!;
      for (const interval of intervals) {
        services.ingest.ingestEvent({
          meetingCode: session.meetingCode,
          studentEmail: student.email,
          displayName: student.name,
          joinedAt: new Date(interval.joinedAtMs).toISOString(),
          source: 'simulator',
          leftAt: interval.leftAtMs === null ? null : new Date(interval.leftAtMs).toISOString(),
        });
      }
    });
    services.logger.info({ sessionId: session.id }, 'simulator: backfilled ended session history');
  }

  private scriptSeed(session: ClassSession): number {
    return hashStringToSeed(session.id) ^ (this.options.seed ?? 0);
  }
}
