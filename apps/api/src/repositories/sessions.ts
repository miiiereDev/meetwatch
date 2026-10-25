import { randomUUID } from 'node:crypto';
import type { DB } from '../db/client.js';
import type { ClassSession, SessionStatus } from '../domain/types.js';

interface SessionRow {
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

  /** Finds a session by meeting code whose start falls on the given calendar day (UTC). */
  getByMeetingCodeOnDay(meetingCode: string, isoDate: string): ClassSession | null {
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
      createdAt: new Date().toISOString(),
    };
    this.db
      .prepare(
        `INSERT INTO class_sessions
           (id, title, section, meeting_code, starts_at, ends_at,
            late_threshold_minutes, min_attendance_pct, status, time_scale, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
           late_threshold_minutes = ?, min_attendance_pct = ?, status = ?, time_scale = ?
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
