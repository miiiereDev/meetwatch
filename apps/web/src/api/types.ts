export type ProviderName = 'simulator' | 'google' | 'csv';
export type SessionStatus = 'scheduled' | 'active' | 'ended';
export type ParticipantStatus = 'online' | 'left' | 'absent';

export interface Student {
  id: string;
  name: string;
  email: string;
  section: string;
  createdAt: string;
}

export interface ClassSession {
  id: string;
  title: string;
  section: string;
  meetingCode: string;
  startsAt: string;
  endsAt: string | null;
  lateThresholdMinutes: number;
  minAttendancePct: number;
  status: SessionStatus;
  timeScale: number;
  clockOffsetMs: number;
  createdAt: string;
}

export interface SessionListItem extends ClassSession {
  effectiveNow: string;
  summary: SessionSummary;
}

export interface SessionSummary {
  online: number;
  left: number;
  absent: number;
  late: number;
  unstable: number;
  total: number;
  attendanceAvgPct: number;
}

export interface StudentStatus {
  studentId: string;
  name: string;
  email: string;
  section: string;
  status: ParticipantStatus;
  late: boolean;
  unstable: boolean;
  rejoinCount: number;
  joinedAt: string | null;
  lastLeftAt: string | null;
  currentStintStartedAt: string | null;
  totalMs: number;
  attendancePct: number;
  matchedVia: string | null;
}

export interface ActivityItem {
  id: string;
  kind: 'join' | 'leave';
  at: string;
  participantKey: string;
  displayName: string;
  email: string | null;
  studentId: string | null;
  studentName: string | null;
}

export interface UnknownParticipant {
  participantKey: string;
  displayName: string;
  email: string | null;
  joinCount: number;
  firstJoinedAt: string | null;
  lastSeenAt: string | null;
  isOnline: boolean;
}

export interface SessionReport {
  now: string;
  statuses: StudentStatus[];
  unknown: UnknownParticipant[];
  activity: ActivityItem[];
  summary: SessionSummary;
}

export interface SessionDetail {
  session: ClassSession;
  report: SessionReport;
}

export interface Mapping {
  id: string;
  rawKey: string;
  rawName: string;
  rawEmail: string | null;
  studentId: string;
  createdAt: string;
  studentName: string | null;
}

export interface AppSettings {
  provider: ProviderName;
  providerStatus: {
    state: 'idle' | 'running' | 'needs_auth' | 'error';
    message?: string;
    updatedAt: string;
  };
  simulatorSpeed: number;
  lateThresholdMinutes: number;
  minAttendancePct: number;
  google: { configured: boolean; connected: boolean };
}

export interface CsvImportResult {
  sessionId: string;
  createdSession: boolean;
  ingested: number;
  skipped: number;
  errors: { row: number; error: string }[];
}
