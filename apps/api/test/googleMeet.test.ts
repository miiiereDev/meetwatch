import { afterEach, describe, expect, it, vi } from 'vitest';
import { GoogleMeetProvider } from '../src/providers/googleMeet.js';
import { GoogleAuthService } from '../src/services/googleAuth.js';
import type { MeetApiClient, ParticipantSessionRecord } from '../src/services/meetApiClient.js';
import type { ProviderServices } from '../src/providers/types.js';
import { IngestService } from '../src/services/ingest.js';
import { SseHub } from '../src/services/sse.js';
import { ensureSeed } from '../src/db/seed.js';
import { IntervalRepo } from '../src/repositories/intervals.js';
import { MappingRepo } from '../src/repositories/mappings.js';
import { SessionRepo } from '../src/repositories/sessions.js';
import { SettingRepo } from '../src/repositories/settings.js';
import { StudentRepo } from '../src/repositories/students.js';
import { createTempDb, type TempDb } from './helpers/tempDb.js';
import { silentLogger } from './helpers/logger.js';
import { loadEnv, resetEnvCache, type Env } from '../src/env.js';

const dbs: TempDb[] = [];
afterEach(() => {
  while (dbs.length) dbs.pop()?.cleanup();
  resetEnvCache();
  vi.restoreAllMocks();
});

function googleEnv(overrides: Partial<Record<string, string>> = {}): Env {
  return loadEnv({
    PROVIDER: 'google',
    GOOGLE_CLIENT_ID: 'id',
    GOOGLE_CLIENT_SECRET: 'secret',
    MEET_POLL_INTERVAL_MS: '15000',
    ...overrides,
  });
}

interface Fixture {
  provider: GoogleMeetProvider;
  services: ProviderServices;
  sessions: SessionRepo;
  intervals: IntervalRepo;
  client: MeetApiClient & {
    findConferenceRecordByMeetingCode: ReturnType<typeof vi.fn>;
    listParticipantSessions: ReturnType<typeof vi.fn>;
  };
  now: number;
}

function fixture(options: {
  stints: ParticipantSessionRecord[];
  recordName?: string | null;
  findError?: Error;
  envOverrides?: Partial<Record<string, string>>;
  now?: number;
}): Fixture {
  const t = createTempDb();
  dbs.push(t);
  ensureSeed(t.db, { seedSessions: false });
  const db = t.db;
  const sessions = new SessionRepo(db);
  const intervals = new IntervalRepo(db);
  const settings = new SettingRepo(db);
  const hub = new SseHub();
  const ingest = new IngestService({
    sessions,
    intervals,
    students: new StudentRepo(db),
    mappings: new MappingRepo(db),
    hub,
    logger: silentLogger,
  });
  const services: ProviderServices = {
    ingest,
    hub,
    sessions,
    intervals,
    students: new StudentRepo(db),
    settings,
    logger: silentLogger,
  };

  // An active session whose meeting code the provider will poll.
  const now = options.now ?? Date.parse('2026-05-04T09:10:00.000Z');
  sessions.create({
    title: 'Biology',
    meetingCode: 'abc-defg-hij',
    startsAt: new Date(now - 10 * 60_000).toISOString(),
    endsAt: new Date(now + 35 * 60_000).toISOString(),
    status: 'active',
  });

  const client: Fixture['client'] = {
    findConferenceRecordByMeetingCode: vi.fn(() =>
      options.findError
        ? Promise.reject(options.findError)
        : Promise.resolve(options.recordName ?? 'conferenceRecords/xyz'),
    ),
    listParticipantSessions: vi.fn(() => Promise.resolve(options.stints)),
  };

  const auth = new GoogleAuthService(
    googleEnv(options.envOverrides),
    settings,
    (async () =>
      new Response(JSON.stringify({ access_token: 'at', expires_in: 3600 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })) as unknown as typeof fetch,
  );
  settings.set('google_refresh_token', 'rt');

  const provider = new GoogleMeetProvider({
    env: googleEnv(options.envOverrides),
    client,
    auth,
    clock: () => now,
    autoStart: false,
  });

  return { provider, services, sessions, intervals, client, now };
}

const STINT = (
  displayName: string,
  email: string | null,
  startIso: string,
  endIso: string | null,
): ParticipantSessionRecord => ({ displayName, email, startTime: startIso, endTime: endIso });

describe('GoogleMeetProvider', () => {
  it('errors on start without credentials', async () => {
    const f = fixture({
      stints: [],
      envOverrides: { GOOGLE_CLIENT_ID: '', GOOGLE_CLIENT_SECRET: '' },
    });
    await f.provider.start(f.services);
    expect(f.provider.status().state).toBe('error');
    expect(f.provider.status().message).toMatch(/GOOGLE_CLIENT_ID/);
  });

  it('waits for auth when configured but not connected', async () => {
    const f = fixture({ stints: [] });
    f.services.settings.set('google_refresh_token', '');
    await f.provider.start(f.services);
    expect(f.provider.status().state).toBe('needs_auth');
  });

  it('polls a live conference record and ingests stints by email', async () => {
    const f = fixture({
      stints: [
        STINT(
          'Ava Thompson',
          'ava.thompson@student.myschool.edu',
          '2026-05-04T09:01:00.000Z',
          null,
        ),
        STINT('Guest Person', null, '2026-05-04T09:02:00.000Z', '2026-05-04T09:03:00.000Z'),
      ],
    });
    await f.provider.start(f.services);
    expect(f.provider.status().state).toBe('running');

    await f.provider.tick();
    const report = f.services.sessions.list().length;
    expect(report).toBe(1);
    expect(f.client.findConferenceRecordByMeetingCode).toHaveBeenCalledWith('abc-defg-hij');

    // Roster student matched by email, guest surfaces as unknown.
    const rows = f.intervals.listBySession(f.services.sessions.list()[0]!.id);
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.email?.includes('ava'))?.displayName).toBe('Ava Thompson');
    expect(rows.find((r) => r.displayName === 'Guest Person')).toBeTruthy();
  });

  it('is idempotent across repeated polls and closes intervals on end times', async () => {
    const f = fixture({
      stints: [
        STINT(
          'Ava Thompson',
          'ava.thompson@student.myschool.edu',
          '2026-05-04T09:01:00.000Z',
          null,
        ),
      ],
    });
    await f.provider.start(f.services);
    const sessionId = f.services.sessions.list()[0]!.id;

    await f.provider.tick();
    await f.provider.tick(); // same data again
    let rows = f.intervals.listBySession(sessionId);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.leftAt).toBeNull();

    // Now Google reports the participant left; the open interval closes.
    f.client.listParticipantSessions.mockResolvedValue([
      STINT(
        'Ava Thompson',
        'ava.thompson@student.myschool.edu',
        '2026-05-04T09:01:00.000Z',
        '2026-05-04T09:09:00.000Z',
      ),
    ]);
    await f.provider.tick();
    rows = f.intervals.listBySession(sessionId);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.leftAt).toBe('2026-05-04T09:09:00.000Z');
  });

  it('backs off after client errors and skips polls while backing off', async () => {
    const f = fixture({ stints: [], findError: new Error('429 rate limit exceeded') });
    await f.provider.start(f.services);
    await f.provider.tick();
    expect(f.provider.status().state).toBe('error');
    expect(f.provider.status().message).toMatch(/429/);

    const callsAfterFailure = f.client.findConferenceRecordByMeetingCode.mock.calls.length;
    await f.provider.tick(); // inside backoff window → no calls
    expect(f.client.findConferenceRecordByMeetingCode.mock.calls.length).toBe(callsAfterFailure);
  });

  it('ignores sessions whose window is nowhere near now', async () => {
    const t = createTempDb();
    dbs.push(t);
    ensureSeed(t.db, { seedSessions: false });
    const sessions = new SessionRepo(t.db);
    const now = Date.parse('2026-05-04T09:10:00.000Z');
    sessions.create({
      title: 'Tomorrow',
      meetingCode: 'tomorrow-code',
      startsAt: new Date(now + 24 * 3_600_000).toISOString(),
      status: 'scheduled',
    });
    const client: MeetApiClient = {
      findConferenceRecordByMeetingCode: vi.fn(),
      listParticipantSessions: vi.fn(),
    };
    const provider = new GoogleMeetProvider({
      env: googleEnv(),
      client,
      auth: {
        configured: () => true,
        connected: () => true,
        getAccessToken: async () => 'at',
      } as unknown as GoogleAuthService,
      clock: () => now,
      autoStart: false,
    });
    const settings = new SettingRepo(t.db);
    const services: ProviderServices = {
      ingest: new IngestService({
        sessions,
        intervals: new IntervalRepo(t.db),
        students: new StudentRepo(t.db),
        mappings: new MappingRepo(t.db),
        hub: new SseHub(),
        logger: silentLogger,
      }),
      hub: new SseHub(),
      sessions,
      intervals: new IntervalRepo(t.db),
      students: new StudentRepo(t.db),
      settings,
      logger: silentLogger,
    };
    await provider.start(services);
    await provider.tick();
    expect(client.findConferenceRecordByMeetingCode).not.toHaveBeenCalled();
  });
});
