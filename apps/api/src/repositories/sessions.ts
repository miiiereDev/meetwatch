import { randomUUID } from 'node:crypto';
import type { DB } from '../db/client.js';
import type { ClassSession, SessionStatus } from '../domain/types.js';

interface SessionRow {
  clock_offset_ms: number;
  id: string;
  title: string;
  section: string;
  meeting_code: string;
  starts_at: string;
  ends_at: string | null;
  late_threshold_minutes: number;
  min_attendance_pct: number;
  status: SessionStatus;
  time_scale: number;
  created_at: string;
}

function toSession(row: SessionRow): ClassSession {
  return {
    id: row.id,
    title: row.title,
    section: row.section,
    meetingCode: row.meeting_code,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    lateThresholdMinutes: row.late_threshold_minutes,
    minAttendancePct: row.min_attendance_pct,
    status: row.status,
    timeScale: row.time_scale,
    clockOffsetMs: row.clock_offset_ms,
    createdAt: row.created_at,
  };
}

export interface CreateSessionInput {
  title?: string;
  section?: string;
  meetingCode: string;
  startsAt: string;
  endsAt?: string | null;
  lateThresholdMinutes?: number;
  minAttendancePct?: number;
  status?: SessionStatus;
  timeScale?: number;
  clockOffsetMs?: number;
}

export class SessionRepo {
  constructor(private readonly db: DB) {}

  list(): ClassSession[] {
    const rows = this.db
      .prepare('SELECT * FROM class_sessions ORDER BY starts_at DESC')
      .all() as SessionRow[];
    return rows.map(toSession);
  }

  get(id: string): ClassSession | null {
    const row = this.db.prepare('SELECT * FROM class_sessions WHERE id = ?').get(id) as
      SessionRow | undefined;
    return row ? toSession(row) : null;
  }

  /**
   * Resolves the session an event belongs to. Prefers a non-ended session
   * whose window contains `atIso`, else the closest past session, else the
   * most recent one with that code.
   */
  resolveByMeetingCode(meetingCode: string, atIso: string): ClassSession | null {
    const at = Date.parse(atIso);
    const candidates = this.list().filter((s) => s.meetingCode === meetingCode);
    if (candidates.length === 0) return null;
    const live = candidates.filter((s) => {
      const end = s.endsAt ? Date.parse(s.endsAt) : Number.POSITIVE_INFINITY;
      return s.status !== 'ended' && Date.parse(s.startsAt) <= at && at <= end;
    });
    if (live.length > 0) return live[0]!;
    const past = candidates
      .filter((s) => Date.parse(s.startsAt) <= at)
      .sort((a, b) => Date.parse(b.startsAt) - Date.parse(a.startsAt));
    if (past.length > 0) return past[0]!;
    return candidates.sort((a, b) => Date.parse(b.startsAt) - Date.parse(a.startsAt))[0] ?? null;
  }

  /** Finds a session by meeting code whose start falls on the given calendar day (UTC). */ getByMeetingCodeOnDay(
    meetingCode: string,
    isoDate: string,
  ): ClassSession | null {
    const row = this.db
      .prepare(
        `SELECT * FROM class_sessions
         WHERE meeting_code = ? AND starts_at >= ? AND starts_at <= ?
         ORDER BY starts_at LIMIT 1`,
      )
      .get(
        meetingCode,
        `${isoDate.slice(0, 10)}T00:00:00.000Z`,
        `${isoDate.slice(0, 10)}T23:59:59.999Z`,
      ) as SessionRow | undefined;
    return row ? toSession(row) : null;
  }

  count(): number {
    const row = this.db.prepare('SELECT COUNT(*) AS n FROM class_sessions').get() as { n: number };
    return row.n;
  }

  create(input: CreateSessionInput): ClassSession {
    const session: ClassSession = {
      id: randomUUID(),
      title: input.title?.trim() ?? '',
      section: input.section?.trim() ?? '',
      meetingCode: input.meetingCode.trim(),
      startsAt: input.startsAt,
      endsAt: input.endsAt ?? null,
      lateThresholdMinutes: input.lateThresholdMinutes ?? 10,
      minAttendancePct: input.minAttendancePct ?? 75,
      status: input.status ?? 'scheduled',
      timeScale: input.timeScale ?? 1,
      clockOffsetMs: input.clockOffsetMs ?? 0,
      createdAt: new Date().toISOString(),
    };
    this.db
      .prepare(
        `INSERT INTO class_sessions
           (id, title, section, meeting_code, starts_at, ends_at,
            late_threshold_minutes, min_attendance_pct, status, time_scale, clock_offset_ms, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        session.id,
        session.title,
        session.section,
        session.meetingCode,
        session.startsAt,
        session.endsAt,
        session.lateThresholdMinutes,
        session.minAttendancePct,
        session.status,
        session.timeScale,
        session.clockOffsetMs,
        session.createdAt,
      );
    return session;
  }

  update(
    id: string,
    patch: Partial<
      Pick<
        ClassSession,
        | 'title'
        | 'section'
        | 'meetingCode'
        | 'startsAt'
        | 'endsAt'
        | 'lateThresholdMinutes'
        | 'minAttendancePct'
        | 'status'
        | 'timeScale'
        | 'clockOffsetMs'
      >
    >,
  ): ClassSession | null {
    const existing = this.get(id);
    if (!existing) return null;
    const next: ClassSession = { ...existing, ...patch };
    this.db
      .prepare(
        `UPDATE class_sessions SET
           title = ?, section = ?, meeting_code = ?, starts_at = ?, ends_at = ?,
           late_threshold_minutes = ?, min_attendance_pct = ?, status = ?, time_scale = ?, clock_offset_ms = ?
         WHERE id = ?`,
      )
      .run(
        next.title,
        next.section,
        next.meetingCode,
        next.startsAt,
        next.endsAt,
        next.lateThresholdMinutes,
        next.minAttendancePct,
        next.status,
        next.timeScale,
        next.clockOffsetMs,
        id,
      );
    return next;
  }

  setStatus(id: string, status: SessionStatus): void {
    this.db.prepare('UPDATE class_sessions SET status = ? WHERE id = ?').run(status, id);
  }

  delete(id: string): boolean {
    const info = this.db.prepare('DELETE FROM class_sessions WHERE id = ?').run(id);
    return info.changes > 0;
  }
}
