import { randomUUID } from 'node:crypto';
import type { DB } from '../db/client.js';
import type { IntervalRecord } from '../domain/types.js';

interface IntervalRow {
  id: string;
  session_id: string;
  participant_key: string;
  email: string | null;
  display_name: string;
  joined_at: string;
  left_at: string | null;
  source: string;
  created_at: string;
}

function toInterval(row: IntervalRow): IntervalRecord {
  return {
    id: row.id,
    sessionId: row.session_id,
    participantKey: row.participant_key,
    email: row.email,
    displayName: row.display_name,
    joinedAt: row.joined_at,
    leftAt: row.left_at,
    source: row.source,
    createdAt: row.created_at,
  };
}

export interface InsertIntervalInput {
  sessionId: string;
  participantKey: string;
  email: string | null;
  displayName: string;
  joinedAt: string;
  leftAt?: string | null;
  source?: string;
}

export class IntervalRepo {
  constructor(private readonly db: DB) {}

  listBySession(sessionId: string): IntervalRecord[] {
    const rows = this.db
      .prepare('SELECT * FROM intervals WHERE session_id = ? ORDER BY joined_at, display_name')
      .all(sessionId) as IntervalRow[];
    return rows.map(toInterval);
  }

  listOpenBySession(sessionId: string): IntervalRecord[] {
    const rows = this.db
      .prepare('SELECT * FROM intervals WHERE session_id = ? AND left_at IS NULL')
      .all(sessionId) as IntervalRow[];
    return rows.map(toInterval);
  }

  listByParticipantKey(sessionId: string, participantKey: string): IntervalRecord[] {
    const rows = this.db
      .prepare(
        'SELECT * FROM intervals WHERE session_id = ? AND participant_key = ? ORDER BY joined_at',
      )
      .all(sessionId, participantKey) as IntervalRow[];
    return rows.map(toInterval);
  }

  get(id: string): IntervalRecord | null {
    const row = this.db.prepare('SELECT * FROM intervals WHERE id = ?').get(id) as
      IntervalRow | undefined;
    return row ? toInterval(row) : null;
  }

  /**
   * Inserts an interval; duplicate (session, participant, joined_at) rows are
   * ignored and null is returned.
   */
  insert(input: InsertIntervalInput): IntervalRecord | null {
    const record: IntervalRecord = {
      id: randomUUID(),
      sessionId: input.sessionId,
      participantKey: input.participantKey,
      email: input.email,
      displayName: input.displayName,
      joinedAt: input.joinedAt,
      leftAt: input.leftAt ?? null,
      source: input.source ?? 'unknown',
      createdAt: new Date().toISOString(),
    };
    const info = this.db
      .prepare(
        `INSERT OR IGNORE INTO intervals
           (id, session_id, participant_key, email, display_name, joined_at, left_at, source, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        record.id,
        record.sessionId,
        record.participantKey,
        record.email,
        record.displayName,
        record.joinedAt,
        record.leftAt,
        record.source,
        record.createdAt,
      );
    return info.changes > 0 ? record : null;
  }

  /** Marks an open interval as left; returns true when a row was updated. */
  close(id: string, leftAt: string): boolean {
    const info = this.db
      .prepare('UPDATE intervals SET left_at = ? WHERE id = ? AND left_at IS NULL')
      .run(leftAt, id);
    return info.changes > 0;
  }

  /** Closes every open interval of a session (e.g. when the meeting ends). */
  closeAllOpen(sessionId: string, leftAt: string): number {
    const info = this.db
      .prepare('UPDATE intervals SET left_at = ? WHERE session_id = ? AND left_at IS NULL')
      .run(leftAt, sessionId);
    return info.changes;
  }

  countBySession(sessionId: string): number {
    const row = this.db
      .prepare('SELECT COUNT(*) AS n FROM intervals WHERE session_id = ?')
      .get(sessionId) as { n: number };
    return row.n;
  }

  deleteBySession(sessionId: string): void {
    this.db.prepare('DELETE FROM intervals WHERE session_id = ?').run(sessionId);
  }
}
