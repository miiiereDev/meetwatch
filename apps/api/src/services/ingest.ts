import type { ParticipantEvent } from '../domain/types.js';
import { matchParticipant, participantRawKey } from '../domain/matching.js';
import type { ActivityItem } from '../domain/status.js';
import type { IntervalRepo } from '../repositories/intervals.js';
import type { MappingRepo } from '../repositories/mappings.js';
import type { SessionRepo } from '../repositories/sessions.js';
import type { StudentRepo } from '../repositories/students.js';
import type { SseHub } from './sse.js';
import type { ProviderLogger } from '../providers/types.js';

export interface IngestDeps {
  sessions: SessionRepo;
  intervals: IntervalRepo;
  students: StudentRepo;
  mappings: MappingRepo;
  hub: SseHub;
  logger: ProviderLogger;
}

/**
 * Persists normalized participant events coming from any MeetProvider and
 * broadcasts the change to SSE clients. Providers never touch the database
 * directly — everything funnels through here.
 */
export class IngestService {
  constructor(private readonly deps: IngestDeps) {}

  /**
   * Records one participant event. `leftAt === null` opens an interval;
   * a non-null leftAt closes the matching open interval (or lands as an
   * already-closed backfill interval).
   */
  ingestEvent(event: ParticipantEvent): { sessionId: string } | null {
    const session = this.deps.sessions.resolveByMeetingCode(event.meetingCode, event.joinedAt);
    if (!session) {
      this.deps.logger.warn(
        { meetingCode: event.meetingCode },
        'ingest: no session for meeting code, ignoring event',
      );
      return null;
    }

    const identity = {
      email: event.studentEmail ? event.studentEmail.trim().toLowerCase() : null,
      displayName: event.displayName,
    };
    const participants = this.deps.students.list();
    const mappings = this.deps.mappings.list();
    const match = matchParticipant(identity, participants, mappings);
    const participantKey = participantRawKey(identity);

    const inserted = this.deps.intervals.insert({
      sessionId: session.id,
      participantKey,
      email: identity.email,
      displayName: event.displayName,
      joinedAt: event.joinedAt,
      leftAt: event.leftAt,
      source: event.source,
    });

    let intervalId: string | null = inserted?.id ?? null;
    if (!inserted) {
      // Duplicate insert: either an already-recorded interval or an open one
      // that this event closes.
      if (event.leftAt) {
        const open = this.deps.intervals
          .listByParticipantKey(session.id, participantKey)
          .find((r) => r.joinedAt === event.joinedAt && r.leftAt === null);
        if (open) {
          this.deps.intervals.close(open.id, event.leftAt);
          intervalId = open.id;
        }
      }
      if (!intervalId) {
        this.deps.logger.debug(
          { meetingCode: event.meetingCode, participantKey },
          'ingest: duplicate event ignored',
        );
        return { sessionId: session.id };
      }
    }

    const item: ActivityItem = {
      id: `${intervalId}:${event.leftAt ? 'leave' : 'join'}`,
      kind: event.leftAt ? 'leave' : 'join',
      at: event.leftAt ?? event.joinedAt,
      participantKey,
      displayName: match.student?.name ?? event.displayName,
      email: identity.email,
      studentId: match.student?.id ?? null,
      studentName: match.student?.name ?? null,
    };

    this.deps.hub.publish('activity', { sessionId: session.id, item });
    this.deps.hub.publish('refresh', { sessionId: session.id, kind: 'statuses' });
    return { sessionId: session.id };
  }

  /** Ends a session: closes open intervals, marks it ended, notifies clients. */
  closeSession(sessionId: string, endedAt: string): void {
    const closed = this.deps.intervals.closeAllOpen(sessionId, endedAt);
    this.deps.sessions.setStatus(sessionId, 'ended');
    if (closed > 0) {
      this.deps.hub.publish('refresh', { sessionId, kind: 'statuses' });
    }
    this.deps.hub.publish('sessions', { sessionId, reason: 'ended' });
    this.deps.logger.info({ sessionId, closed }, 'ingest: session closed');
  }
}
