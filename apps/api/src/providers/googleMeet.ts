import type { Env } from '../env.js';
import { GoogleMeetApiClient, type MeetApiClient } from '../services/meetApiClient.js';
import { GoogleAuthService } from '../services/googleAuth.js';
import type { MeetProvider, ProviderServices, ProviderStatus } from './types.js';

const GRACE_MS = 60_000;

export interface GoogleMeetProviderOptions {
  env: Env;
  /** Injectable client for tests. */
  client?: MeetApiClient;
  /** Injectable auth service for tests. */
  auth?: GoogleAuthService;
  /** Wall-clock interval between polls (ms); defaults from env. */
  pollMs?: number;
  /** Injectable wall clock for tests. */
  clock?: () => number;
  /** Start the internal timer automatically (tests may drive tick() manually). */
  autoStart?: boolean;
}

/**
 * Live provider: polls the Google Meet REST API for conference records that
 * match the configured sessions and funnels participant join/leave stints
 * through the shared ingest service. Polling is idempotent — the ingest
 * layer dedupes repeated join events and closes intervals once the API
 * reports an end time.
 */
export class GoogleMeetProvider implements MeetProvider {
  readonly name = 'google' as const;
  private services: ProviderServices | null = null;
  private auth: GoogleAuthService | null = null;
  private client: MeetApiClient | null = null;
  private timer: NodeJS.Timeout | null = null;
  private statusState: ProviderStatus = { state: 'idle', updatedAt: new Date().toISOString() };
  /** Exponential backoff after rate limits / server errors (ms multiplier). */
  private backoffFactor = 0;
  private nextPollAt = 0;
  private readonly pollMs: number;
  private readonly clock: () => number;
  private readonly autoStart: boolean;

  constructor(private readonly options: GoogleMeetProviderOptions) {
    this.pollMs = options.pollMs ?? options.env.MEET_POLL_INTERVAL_MS;
    this.clock = options.clock ?? Date.now;
    this.autoStart = options.autoStart !== false;
  }

  async start(services: ProviderServices): Promise<void> {
    this.services = services;
    this.auth = this.options.auth ?? new GoogleAuthService(this.options.env, services.settings);

    if (!this.auth.configured()) {
      this.statusState = {
        state: 'error',
        message:
          'Google OAuth is not configured — set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET (docs/GOOGLE_SETUP.md)',
        updatedAt: new Date().toISOString(),
      };
      return;
    }
    if (!this.auth.connected()) {
      this.statusState = {
        state: 'needs_auth',
        message: 'Connect a Google account from the Settings page to start tracking meetings',
        updatedAt: new Date().toISOString(),
      };
      return;
    }

    if (this.options.client) {
      this.client = this.options.client;
    } else {
      const auth = this.auth;
      this.client = await GoogleMeetApiClient.create(() => auth.getAccessToken());
    }

    this.statusState = { state: 'running', updatedAt: new Date().toISOString() };
    if (this.autoStart) {
      this.timer = setInterval(() => void this.tick(), this.pollMs);
      this.timer.unref();
    }
  }

  async stop(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.backoffFactor = 0;
    this.nextPollAt = 0;
    this.statusState = { state: 'idle', updatedAt: new Date().toISOString() };
  }

  status(): ProviderStatus {
    return this.statusState;
  }

  /**
   * One poll sweep over pollable sessions. Errors are caught per sweep and
   * trigger exponential backoff; a sweep over an unauthenticated provider is
   * a no-op that downgrades the status to needs_auth.
   */
  async tick(): Promise<void> {
    const services = this.services;
    const client = this.client;
    if (!services || !client) return;

    const now = this.clock();
    if (now < this.nextPollAt) return; // backing off

    const pollable = services.sessions.list().filter((s) => isPollable(s, now));
    if (pollable.length === 0) return;

    try {
      for (const session of pollable) {
        await this.pollSession(session.meetingCode);
      }
      this.backoffFactor = 0;
      this.statusState = { state: 'running', updatedAt: new Date().toISOString() };
    } catch (err) {
      this.backoffFactor = Math.min(this.backoffFactor + 1, 5);
      const delayMs = Math.min(this.pollMs * 2 ** this.backoffFactor, 5 * 60_000);
      this.nextPollAt = now + delayMs;
      const message = err instanceof Error ? err.message : String(err);
      const authFailure = /401|unauthenticated|invalid_grant|token/i.test(message);
      this.statusState = {
        state: authFailure ? 'needs_auth' : 'error',
        message,
        updatedAt: new Date().toISOString(),
      };
      services.logger.warn({ err, backoffMs: delayMs }, 'google: poll failed, backing off');
    }
  }

  /** Polls one meeting code and ingests every participant stint. */
  async pollSession(meetingCode: string): Promise<void> {
    const services = this.services;
    const client = this.client;
    if (!services || !client) return;

    const record = await client.findConferenceRecordByMeetingCode(meetingCode);
    if (!record) return; // meeting has not produced a conference record yet

    const stints = await client.listParticipantSessions(record);
    for (const stint of stints) {
      if (!stint.startTime) continue;
      services.ingest.ingestEvent({
        meetingCode,
        studentEmail: stint.email,
        displayName: stint.displayName || stint.email || 'Unknown participant',
        joinedAt: stint.startTime,
        leftAt: stint.endTime ?? null,
        source: 'google',
      });
    }
    services.logger.debug(
      { meetingCode, stints: stints.length },
      'google: polled conference record',
    );
  }
}

/** A session is polled when the meeting could plausibly be live. */
function isPollable(
  session: { status: string; startsAt: string; endsAt: string | null },
  now: number,
): boolean {
  if (session.status === 'ended') return false;
  const start = Date.parse(session.startsAt);
  const end = session.endsAt ? Date.parse(session.endsAt) : null;
  // Live, or starting within the next minute, or just ended (close stints).
  if (now < start - GRACE_MS) return false;
  if (end !== null && now > end + GRACE_MS) return false;
  return true;
}
