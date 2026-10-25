import type { ActivityItem, StudentStatus } from '../api/types';

/** Base dates chosen on a round minute so assertions stay stable. */
const BASE = Date.parse('2026-05-04T09:00:00.000Z');

export function makeStudent(overrides: Partial<StudentStatus> = {}): StudentStatus {
  return {
    studentId: 's1',
    name: 'Ava Thompson',
    email: 'ava.thompson@school.edu',
    section: '10-A',
    status: 'online',
    late: false,
    unstable: false,
    rejoinCount: 0,
    joinedAt: new Date(BASE).toISOString(),
    lastLeftAt: null,
    currentStintStartedAt: new Date(BASE).toISOString(),
    totalMs: 10 * 60_000,
    attendancePct: 80,
    matchedVia: 'email',
    ...overrides,
  };
}

export function makeActivity(overrides: Partial<ActivityItem> = {}): ActivityItem {
  return {
    id: 'a1',
    kind: 'join',
    at: new Date(BASE).toISOString(),
    participantKey: 'p1',
    displayName: 'Ava Thompson',
    email: 'ava.thompson@school.edu',
    studentId: 's1',
    studentName: 'Ava Thompson',
    ...overrides,
  };
}

export { BASE };
