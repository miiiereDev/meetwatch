export interface Student {
  id: string;
  name: string;
  email: string;
  section: string;
  createdAt: string;
}

export type SessionStatus = 'scheduled' | 'active' | 'ended';

export interface ClassSession {
  id: string;
  title: string;
  section: string;
  meetingCode: string;
  /** ISO-8601 UTC. */
  startsAt: string;
  /** ISO-8601 UTC or null when the session runs until manually ended. */
  endsAt: string | null;
  lateThresholdMinutes: number;
  minAttendancePct: number;
  status: SessionStatus;
  /** Simulator time scale: 1 = real time, 20 = 45 min plays in ~2 min. */
  timeScale: number;
  createdAt: string;
}

/** One join/leave interval of a Meet participant inside a session. */
export interface IntervalRecord {
  id: string;
  sessionId: string;
  /** Stable participant identity: email when known, else normalized display name. */
  participantKey: string;
  email: string | null;
  displayName: string;
  joinedAt: string;
  /** null while the participant is in the call. */
  leftAt: string | null;
  source: string;
  createdAt: string;
}

export interface Mapping {
  id: string;
  rawKey: string;
  rawName: string;
  rawEmail: string | null;
  studentId: string;
  createdAt: string;
}

export type ParticipantStatus = 'online' | 'left' | 'absent';

/** Normalized participant event emitted by every MeetProvider. */
export interface ParticipantEvent {
  meetingCode: string;
  studentEmail: string | null;
  displayName: string;
  joinedAt: string;
  leftAt: string | null;
  source: string;
}
