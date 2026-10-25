import { parseCsv, pickColumn } from '../lib/csv.js';
import type { ParticipantEvent } from '../domain/types.js';
import type { MeetProvider, ProviderServices, ProviderStatus } from './types.js';

export interface CsvAttendanceMeta {
  meetingCode: string;
  title?: string;
  section?: string;
  /** Overrides the window derived from the CSV rows (ISO-8601). */
  startsAt?: string;
  endsAt?: string;
}

export interface CsvImportRowError {
  row: number;
  error: string;
}

export interface CsvImportResult {
  sessionId: string;
  /** True when the import created the session instead of extending one. */
  createdSession: boolean;
  ingested: number;
  skipped: number;
  errors: CsvImportRowError[];
}

/** Capability interface for providers that can ingest an attendance CSV. */
export interface CsvAttendanceImporter {
  importAttendance(csv: string, meta: CsvAttendanceMeta): CsvImportResult;
}

/** Column aliases for real Google Meet attendance exports (incl. localized). */
const COL_NAME = ['name', 'full name', 'display name', 'participant name'];
const COL_EMAIL = ['email', 'email address', 'correo electronico'];
const COL_JOINED = [
  'time first joined',
  'first joined',
  'join time',
  'time joined',
  'hora del primer acceso',
];
const COL_LEFT = [
  'time last left',
  'last left',
  'leave time',
  'exit time',
  'hora de la ultima salida',
];
const COL_PARTICIPATION = [
  'participation length',
  'participation duration',
  'duration',
  'duracion de la participacion',
];

/**
 * Upload-driven provider: replays a Google Meet attendance report CSV as
 * closed join/leave intervals. Nothing polls on a timer; switching to this
 * provider simply arms the POST /api/import/attendance endpoint.
 */
export class CsvImportProvider implements MeetProvider, CsvAttendanceImporter {
  readonly name = 'csv' as const;
  private services: ProviderServices | null = null;
  private statusState: ProviderStatus = { state: 'idle', updatedAt: new Date().toISOString() };

  async start(services: ProviderServices): Promise<void> {
    this.services = services;
    this.statusState = {
      state: 'idle',
      message: 'ready — upload an attendance CSV from the Settings page',
      updatedAt: new Date().toISOString(),
    };
  }

  async stop(): Promise<void> {
    this.statusState = { state: 'idle', updatedAt: new Date().toISOString() };
  }

  status(): ProviderStatus {
    return this.statusState;
  }

  importAttendance(csv: string, meta: CsvAttendanceMeta): CsvImportResult {
    const services = this.services;
    if (!services) throw new Error('csv provider is not started');

    const table = parseCsv(csv);
    if (table.rows.length === 0) {
      throw new Error('the CSV contains no data rows');
    }

    const errors: CsvImportRowError[] = [];
    const events: ParticipantEvent[] = [];
    table.rows.forEach((row, index) => {
      const rowNumber = index + 2; // header is row 1
      try {
        events.push(rowToEvent(row, meta, rowNumber));
      } catch (err) {
        errors.push({ row: rowNumber, error: err instanceof Error ? err.message : String(err) });
      }
    });

    if (events.length === 0) {
      throw new Error(`no usable rows found (columns seen: ${table.headers.join(', ')})`);
    }

    events.sort((a, b) => Date.parse(a.joinedAt) - Date.parse(b.joinedAt));
    const firstJoin = events[0]!.joinedAt;
    const lastLeft = events.reduce<string | null>(
      (max, e) => (e.leftAt && (!max || e.leftAt > max) ? e.leftAt : max),
      null,
    );

    // Attach to an existing session for this code when one covers the data,
    // otherwise synthesize a completed session spanning the imported window.
    const existing = services.sessions.resolveByMeetingCode(meta.meetingCode, firstJoin);
    const session =
      existing ??
      services.sessions.create({
        title: meta.title ?? 'Imported session',
        section: meta.section,
        meetingCode: meta.meetingCode,
        startsAt: meta.startsAt ?? firstJoin,
        endsAt: meta.endsAt ?? lastLeft,
        timeScale: 1,
      });

    let ingested = 0;
    let skipped = 0;
    for (const event of events) {
      const result = services.ingest.ingestEvent(event);
      if (result) ingested += 1;
      else skipped += 1;
    }

    // An import is a point-in-time record: mark the session complete and let
    // clients refresh. closeSession also closes any stray open interval.
    services.ingest.closeSession(session.id, meta.endsAt ?? lastLeft ?? new Date().toISOString());

    services.logger.info(
      {
        meetingCode: meta.meetingCode,
        sessionId: session.id,
        ingested,
        skipped,
        errors: errors.length,
      },
      'csv: attendance imported',
    );

    return {
      sessionId: session.id,
      createdSession: existing === null,
      ingested,
      skipped,
      errors,
    };
  }
}

/** Converts one CSV row into a normalized (closed) participant event. */
function rowToEvent(
  row: Record<string, string>,
  meta: CsvAttendanceMeta,
  rowNumber: number,
): ParticipantEvent {
  const displayName = pickColumn(row, COL_NAME);
  const email = pickColumn(row, COL_EMAIL)?.toLowerCase() ?? null;
  const joinedRaw = pickColumn(row, COL_JOINED);
  const leftRaw = pickColumn(row, COL_LEFT);
  const participation = pickColumn(row, COL_PARTICIPATION);

  if (!displayName && !email) {
    throw new Error('row has neither a name nor an email column');
  }

  if (!joinedRaw) {
    throw new Error('row is missing the "first joined" time');
  }

  const joinedAt = parseTimestamp(joinedRaw, rowNumber);
  let leftAt: string | null = null;
  if (leftRaw) {
    leftAt = parseTimestamp(leftRaw, rowNumber);
  } else if (participation) {
    const ms = parseParticipation(participation);
    leftAt = new Date(Date.parse(joinedAt) + ms).toISOString();
  } else if (meta.endsAt) {
    leftAt = meta.endsAt;
  } else {
    throw new Error('row has no leave time, participation length, or endsAt override');
  }

  return {
    meetingCode: meta.meetingCode,
    studentEmail: email,
    displayName: displayName ?? email ?? `participant-row-${rowNumber}`,
    joinedAt,
    leftAt,
    source: 'csv',
  };
}

/**
 * Parses the timestamp formats seen in attendance reports: ISO-8601,
 * "YYYY-MM-DD HH:mm[:ss]" (treated as UTC), and the US export style
 * "M/D/YY, H:mm[:ss] AM/PM" (treated as local server time).
 */
export function parseTimestamp(value: string, rowNumber: number): string {
  const v = value.trim();
  if (!v) throw new Error(`row ${rowNumber}: empty timestamp`);

  // ISO with explicit zone or T separator.
  if (/^\d{4}-\d{2}-\d{2}T/.test(v)) {
    const ms = Date.parse(v);
    if (!Number.isNaN(ms)) return new Date(ms).toISOString();
  }

  // Naive "YYYY-MM-DD HH:mm[:ss]" — Google exports use it in UTC.
  const naive = v.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (naive) {
    const [, y, mo, d, h, mi, s] = naive;
    return new Date(Date.UTC(+y!, +mo! - 1, +d!, +h!, +mi!, +(s ?? 0))).toISOString();
  }

  // US style: 5/4/26, 9:00:00 AM
  const us = v.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{2,4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i,
  );
  if (us) {
    const [, mo, d, yRaw, hRaw, mi, s, ampm] = us;
    let year = +yRaw!;
    if (year < 100) year += 2000;
    let hour = +hRaw!;
    if (ampm) {
      const pm = ampm.toUpperCase() === 'PM';
      if (pm && hour < 12) hour += 12;
      if (!pm && hour === 12) hour = 0;
    }
    return new Date(year, +mo! - 1, +d!, hour, +mi!, +(s ?? 0)).toISOString();
  }

  const ms = Date.parse(v);
  if (!Number.isNaN(ms)) return new Date(ms).toISOString();
  throw new Error(`row ${rowNumber}: cannot parse timestamp "${v}"`);
}

/** Parses Google's "Participation length" format like "1h 2m 3s". */
export function parseParticipation(value: string): number {
  const match = value
    .toLowerCase()
    .match(/(?:(\d+)\s*h(?:our)?s?)?\s*(?:(\d+)\s*m(?:in)?s?)?\s*(?:(\d+)\s*s(?:ec)?s?)?/);
  const h = +(match?.[1] ?? 0);
  const m = +(match?.[2] ?? 0);
  const s = +(match?.[3] ?? 0);
  const ms = (h * 3600 + m * 60 + s) * 1000;
  if (ms <= 0) throw new Error(`cannot parse participation length "${value}"`);
  return ms;
}
