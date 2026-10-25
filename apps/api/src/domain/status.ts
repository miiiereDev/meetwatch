import type { ClassSession, IntervalRecord, Mapping, ParticipantStatus, Student } from './types.js';
import { matchParticipant, type MatchMethod, type ParticipantIdentity } from './matching.js';

export interface StudentStatusView {
  studentId: string;
  name: string;
  email: string;
  section: string;
  status: ParticipantStatus;
  /** First join happened after the late threshold. */
  late: boolean;
  /** 3 or more rejoins (4+ separate join intervals). */
  unstable: boolean;
  rejoinCount: number;
  joinedAt: string | null;
  lastLeftAt: string | null;
  /** When the current online stint began, if online. */
  currentStintStartedAt: string | null;
  totalMs: number;
  attendancePct: number;
  matchedVia: MatchMethod | null;
}

export interface UnknownParticipantView {
  participantKey: string;
  displayName: string;
  email: string | null;
  joinCount: number;
  firstJoinedAt: string | null;
  lastSeenAt: string | null;
  isOnline: boolean;
}

export type ActivityKind = 'join' | 'leave';

export interface ActivityItem {
  id: string;
  kind: ActivityKind;
  at: string;
  participantKey: string;
  displayName: string;
  email: string | null;
  studentId: string | null;
  studentName: string | null;
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

export interface SessionStatusReport {
  now: string;
  statuses: StudentStatusView[];
  unknown: UnknownParticipantView[];
  activity: ActivityItem[];
  summary: SessionSummary;
}

/** Minutes → ms. */
const MINUTE = 60_000;

/**
 * The reference "now" for a session: wall clock plus the simulator's clock
 * offset, clamped to the session window. Ended sessions use their full window.
 */
export function sessionEffectiveNow(session: ClassSession, wallMs: number): Date {
  const startMs = Date.parse(session.startsAt);
  const endMs = session.endsAt ? Date.parse(session.endsAt) : null;
  if (session.status === 'ended') {
    return new Date(endMs ?? wallMs);
  }
  const simNow = wallMs + session.clockOffsetMs;
  const upper = endMs ?? Number.POSITIVE_INFINITY;
  return new Date(Math.min(Math.max(simNow, Math.min(startMs, upper)), upper));
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Attendance percentage: total time in call over the session duration so far
 * (or the full duration for ended sessions), capped at 100.
 */
export function computeAttendancePct(totalMs: number, durationMs: number): number {
  if (durationMs <= 0 || totalMs <= 0) return 0;
  return round1(Math.min(100, (totalMs / durationMs) * 100));
}

export interface SessionWindow {
  startsAtMs: number;
  /** null when the session has no planned end. */
  endMs: number | null;
  lateThresholdMinutes: number;
  /** Reference "now" used for open intervals and duration. */
  nowMs: number;
}

/**
 * Pure per-student state computation from their join/leave intervals.
 * Absent when there are no intervals; online when any interval is open.
 */
export function computeStudentState(
  student: Student,
  records: IntervalRecord[],
  window: SessionWindow,
): StudentStatusView {
  const sorted = [...records].sort((a, b) => Date.parse(a.joinedAt) - Date.parse(b.joinedAt));
  const clampNow = Math.min(window.nowMs, window.endMs ?? Number.POSITIVE_INFINITY);

  if (sorted.length === 0) {
    return {
      studentId: student.id,
      name: student.name,
      email: student.email,
      section: student.section,
      status: 'absent',
      late: false,
      unstable: false,
      rejoinCount: 0,
      joinedAt: null,
      lastLeftAt: null,
      currentStintStartedAt: null,
      totalMs: 0,
      attendancePct: 0,
      matchedVia: null,
    };
  }

  const firstJoinedAt = sorted[0]!.joinedAt;
  const open = sorted.filter((r) => r.leftAt === null);
  const status: ParticipantStatus = open.length > 0 ? 'online' : 'left';

  const lateThresholdMs = window.startsAtMs + window.lateThresholdMinutes * MINUTE;
  const late = Date.parse(firstJoinedAt) > lateThresholdMs;

  const rejoinCount = Math.max(0, sorted.length - 1);
  const unstable = rejoinCount >= 3;

  let totalMs = 0;
  for (const record of sorted) {
    const start = Date.parse(record.joinedAt);
    const end = record.leftAt ? Date.parse(record.leftAt) : clampNow;
    const effectiveStart = Math.min(start, clampNow);
    const effectiveEnd = Math.min(end, clampNow);
    if (effectiveEnd > effectiveStart) totalMs += effectiveEnd - effectiveStart;
  }

  const lastLeftAt = sorted.reduce<string | null>((acc, r) => {
    if (!r.leftAt) return acc;
    if (!acc || Date.parse(r.leftAt) > Date.parse(acc)) return r.leftAt;
    return acc;
  }, null);

  const durationMs = Math.max(
    0,
    Math.min(window.nowMs, window.endMs ?? window.nowMs) - window.startsAtMs,
  );

  return {
    studentId: student.id,
    name: student.name,
    email: student.email,
    section: student.section,
    status,
    late,
    unstable,
    rejoinCount,
    joinedAt: firstJoinedAt,
    lastLeftAt,
    currentStintStartedAt: open.length > 0 ? (open[open.length - 1]!.joinedAt ?? null) : null,
    totalMs,
    attendancePct: computeAttendancePct(totalMs, durationMs),
    matchedVia: null,
  };
}

interface IntervalGroup {
  key: string;
  emails: string[];
  names: string[];
  records: IntervalRecord[];
}

export function groupIntervalsByParticipant(
  intervals: IntervalRecord[],
): Map<string, IntervalGroup> {
  const groups = new Map<string, IntervalGroup>();
  for (const record of intervals) {
    let group = groups.get(record.participantKey);
    if (!group) {
      group = { key: record.participantKey, emails: [], names: [], records: [] };
      groups.set(record.participantKey, group);
    }
    if (record.email && !group.emails.includes(record.email)) group.emails.push(record.email);
    if (!group.names.includes(record.displayName)) group.names.push(record.displayName);
    group.records.push(record);
  }
  return groups;
}

function candidateIdentities(group: IntervalGroup): ParticipantIdentity[] {
  const primaryEmail = group.emails[0] ?? null;
  const primaryName = group.names[0] ?? group.key;
  const identities: ParticipantIdentity[] = [{ email: primaryEmail, displayName: primaryName }];
  for (const name of group.names.slice(1)) {
    identities.push({ email: primaryEmail, displayName: name });
  }
  for (const email of group.emails.slice(1)) {
    identities.push({ email, displayName: primaryName });
  }
  return identities;
}

/**
 * Computes the full live report for one session: per-student statuses, unknown
 * participants, the activity feed, and summary counts. Pure — all state comes
 * from the arguments, so a manual mapping made after the fact immediately
 * changes the computed statuses.
 */
export function computeSessionReport(args: {
  session: ClassSession;
  students: Student[];
  intervals: IntervalRecord[];
  mappings: Mapping[];
  now: Date;
}): SessionStatusReport {
  const { session, students, intervals, mappings } = args;
  const nowMs = args.now.getTime();
  const window: SessionWindow = {
    startsAtMs: Date.parse(session.startsAt),
    endMs: session.endsAt ? Date.parse(session.endsAt) : null,
    lateThresholdMinutes: session.lateThresholdMinutes,
    nowMs,
  };

  const groups = groupIntervalsByParticipant(intervals);

  interface ResolvedGroup {
    group: IntervalGroup;
    student: Student | null;
    method: MatchMethod | null;
  }

  const resolved: ResolvedGroup[] = [];
  for (const group of groups.values()) {
    let student: Student | null = null;
    let method: MatchMethod | null = null;
    for (const identity of candidateIdentities(group)) {
      const result = matchParticipant(identity, students, mappings);
      if (result.student) {
        student = result.student;
        method = result.method;
        break;
      }
    }
    resolved.push({ group, student, method });
  }

  const intervalsByStudent = new Map<string, IntervalRecord[]>();
  const matchedByKey = new Map<string, Student>();
  for (const { group, student } of resolved) {
    if (!student) continue;
    matchedByKey.set(group.key, student);
    const list = intervalsByStudent.get(student.id) ?? [];
    list.push(...group.records);
    intervalsByStudent.set(student.id, list);
  }

  const statuses: StudentStatusView[] = students.map((student) => {
    const view = computeStudentState(student, intervalsByStudent.get(student.id) ?? [], window);
    const match = resolved.find((r) => r.student?.id === student.id);
    return { ...view, matchedVia: match?.method ?? null };
  });

  const unknown: UnknownParticipantView[] = resolved
    .filter((r) => r.student === null)
    .map(({ group }) => {
      const sorted = [...group.records].sort(
        (a, b) => Date.parse(a.joinedAt) - Date.parse(b.joinedAt),
      );
      const lastSeenAt = sorted.reduce<string | null>((acc, r) => {
        const candidates = [r.joinedAt, r.leftAt].filter((v): v is string => Boolean(v));
        const latest = candidates.reduce<string | null>((best, v) => {
          if (!best || Date.parse(v) > Date.parse(best)) return v;
          return best;
        }, null);
        if (!latest) return acc;
        if (!acc || Date.parse(latest) > Date.parse(acc)) return latest;
        return acc;
      }, null);
      return {
        participantKey: group.key,
        displayName: group.names[0] ?? group.key,
        email: group.emails[0] ?? null,
        joinCount: group.records.length,
        firstJoinedAt: sorted[0]?.joinedAt ?? null,
        lastSeenAt,
        isOnline: group.records.some((r) => r.leftAt === null),
      };
    })
    .sort((a, b) => (a.displayName ?? '').localeCompare(b.displayName ?? ''));

  const activity: ActivityItem[] = [];
  for (const { group, student } of resolved) {
    for (const record of group.records) {
      activity.push({
        id: `${record.id}:join`,
        kind: 'join',
        at: record.joinedAt,
        participantKey: record.participantKey,
        displayName: student?.name ?? record.displayName,
        email: record.email,
        studentId: student?.id ?? null,
        studentName: student?.name ?? null,
      });
      if (record.leftAt) {
        activity.push({
          id: `${record.id}:leave`,
          kind: 'leave',
          at: record.leftAt,
          participantKey: record.participantKey,
          displayName: student?.name ?? record.displayName,
          email: record.email,
          studentId: student?.id ?? null,
          studentName: student?.name ?? null,
        });
      }
    }
  }
  activity.sort((a, b) => {
    const diff = Date.parse(b.at) - Date.parse(a.at);
    if (diff !== 0) return diff;
    return a.kind === b.kind ? 0 : a.kind === 'leave' ? -1 : 1;
  });

  const online = statuses.filter((s) => s.status === 'online').length;
  const left = statuses.filter((s) => s.status === 'left').length;
  const absent = statuses.filter((s) => s.status === 'absent').length;
  const late = statuses.filter((s) => s.late).length;
  const unstable = statuses.filter((s) => s.unstable).length;
  const attendanceAvgPct =
    statuses.length === 0
      ? 0
      : round1(statuses.reduce((sum, s) => sum + s.attendancePct, 0) / statuses.length);

  return {
    now: new Date(nowMs).toISOString(),
    statuses,
    unknown,
    activity,
    summary: {
      online,
      left,
      absent,
      late,
      unstable,
      total: statuses.length,
      attendanceAvgPct,
    },
  };
}
