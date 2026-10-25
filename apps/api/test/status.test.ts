import { describe, it, expect } from 'vitest';
import {
  computeAttendancePct,
  computeSessionReport,
  computeStudentState,
} from '../src/domain/status.js';
import type { ClassSession, IntervalRecord, Student } from '../src/domain/types.js';

function student(id: string, name: string, section = '10-A'): Student {
  return {
    id,
    name,
    email: `${id}@student.myschool.edu`,
    section,
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}

const SESSION_START = '2026-05-04T09:00:00.000Z';
const SESSION_END = '2026-05-04T09:45:00.000Z';

function session(patch: Partial<ClassSession> = {}): ClassSession {
  return {
    id: 'sess-1',
    title: 'Science',
    section: '',
    meetingCode: 'abc-defg-hij',
    startsAt: SESSION_START,
    endsAt: SESSION_END,
    lateThresholdMinutes: 10,
    minAttendancePct: 75,
    status: 'active',
    timeScale: 1,
    clockOffsetMs: 0,
    createdAt: '2026-05-04T08:00:00.000Z',
    ...patch,
  };
}

function interval(
  key: string,
  joinedAt: string,
  leftAt: string | null,
  patch: Partial<IntervalRecord> = {},
): IntervalRecord {
  return {
    id: `iv-${key}-${joinedAt}`,
    sessionId: 'sess-1',
    participantKey: key,
    email: `${key}@student.myschool.edu`,
    displayName: key,
    joinedAt,
    leftAt,
    source: 'simulator',
    createdAt: joinedAt,
    ...patch,
  };
}

function windowFor(overrides: Partial<Parameters<typeof computeStudentState>[2]> = {}) {
  return {
    startsAtMs: Date.parse(SESSION_START),
    endMs: Date.parse(SESSION_END),
    lateThresholdMinutes: 10,
    nowMs: Date.parse('2026-05-04T09:30:00.000Z'),
    ...overrides,
  };
}

describe('computeAttendancePct', () => {
  it('is 0 without duration or time', () => {
    expect(computeAttendancePct(0, 45 * 60_000)).toBe(0);
    expect(computeAttendancePct(10 * 60_000, 0)).toBe(0);
  });

  it('computes capped percentages', () => {
    expect(computeAttendancePct(20 * 60_000, 45 * 60_000)).toBe(44.4);
    expect(computeAttendancePct(50 * 60_000, 45 * 60_000)).toBe(100);
  });
});

describe('computeStudentState', () => {
  const ava = student('s1', 'Ava Thompson');

  it('is absent with no intervals', () => {
    const state = computeStudentState(ava, [], windowFor());
    expect(state.status).toBe('absent');
    expect(state.late).toBe(false);
    expect(state.unstable).toBe(false);
    expect(state.totalMs).toBe(0);
    expect(state.attendancePct).toBe(0);
  });

  it('is online with an open interval and reports the stint start', () => {
    const state = computeStudentState(
      ava,
      [interval('ava', '2026-05-04T09:00:30.000Z', null)],
      windowFor(),
    );
    expect(state.status).toBe('online');
    expect(state.currentStintStartedAt).toBe('2026-05-04T09:00:30.000Z');
    expect(state.joinedAt).toBe('2026-05-04T09:00:30.000Z');
    expect(state.lastLeftAt).toBeNull();
    // 29.5 minutes of a 30-minute elapsed session.
    expect(state.attendancePct).toBeCloseTo(98.3, 1);
  });

  it('is left when all intervals are closed', () => {
    const state = computeStudentState(
      ava,
      [interval('ava', '2026-05-04T09:00:00.000Z', '2026-05-04T09:10:00.000Z')],
      windowFor(),
    );
    expect(state.status).toBe('left');
    expect(state.lastLeftAt).toBe('2026-05-04T09:10:00.000Z');
    // 10 of the 30 elapsed minutes.
    expect(state.attendancePct).toBeCloseTo(33.3, 1);
  });

  it('flags late when the first join is after the threshold', () => {
    const lateState = computeStudentState(
      ava,
      [interval('ava', '2026-05-04T09:10:00.001Z', null)],
      windowFor(),
    );
    expect(lateState.late).toBe(true);

    const boundary = computeStudentState(
      ava,
      [interval('ava', '2026-05-04T09:10:00.000Z', null)],
      windowFor(),
    );
    expect(boundary.late).toBe(false);

    const early = computeStudentState(
      ava,
      [interval('ava', '2026-05-04T08:59:00.000Z', null)],
      windowFor(),
    );
    expect(early.late).toBe(false);
  });

  it('flags unstable at 3 or more rejoins, not before', () => {
    const three = computeStudentState(
      ava,
      [
        interval('ava', '2026-05-04T09:00:00.000Z', '2026-05-04T09:05:00.000Z'),
        interval('ava', '2026-05-04T09:06:00.000Z', '2026-05-04T09:10:00.000Z'),
        interval('ava', '2026-05-04T09:12:00.000Z', '2026-05-04T09:15:00.000Z'),
        interval('ava', '2026-05-04T09:20:00.000Z', null),
      ],
      windowFor(),
    );
    expect(three.rejoinCount).toBe(3);
    expect(three.unstable).toBe(true);
    expect(three.status).toBe('online');

    const two = computeStudentState(
      ava,
      [
        interval('ava', '2026-05-04T09:00:00.000Z', '2026-05-04T09:05:00.000Z'),
        interval('ava', '2026-05-04T09:06:00.000Z', '2026-05-04T09:10:00.000Z'),
        interval('ava', '2026-05-04T09:20:00.000Z', null),
      ],
      windowFor(),
    );
    expect(two.rejoinCount).toBe(2);
    expect(two.unstable).toBe(false);
  });

  it('sums time across intervals', () => {
    const state = computeStudentState(
      ava,
      [
        interval('ava', '2026-05-04T09:00:00.000Z', '2026-05-04T09:10:00.000Z'),
        interval('ava', '2026-05-04T09:20:00.000Z', '2026-05-04T09:30:00.000Z'),
      ],
      windowFor(),
    );
    expect(state.totalMs).toBe(20 * 60_000);
  });

  it('clamps open intervals at session end for ended sessions', () => {
    const state = computeStudentState(
      ava,
      [interval('ava', '2026-05-04T09:40:00.000Z', null)],
      windowFor({ nowMs: Date.parse('2026-05-04T10:30:00.000Z') }),
    );
    expect(state.totalMs).toBe(5 * 60_000);
    expect(state.attendancePct).toBeCloseTo(11.1, 1);
  });

  it('ignores future intervals beyond now', () => {
    const state = computeStudentState(
      ava,
      [interval('ava', '2026-05-04T09:29:00.000Z', null)],
      windowFor({ nowMs: Date.parse('2026-05-04T09:00:00.000Z') }),
    );
    expect(state.totalMs).toBe(0);
  });
});

describe('computeSessionReport', () => {
  const roster = [
    student('s1', 'Ava Thompson'),
    student('s2', 'Liam Rivera'),
    student('s3', 'Sofia Nguyen'),
  ];

  it('summarizes online/left/absent and late counts', () => {
    const report = computeSessionReport({
      session: session(),
      students: roster,
      intervals: [
        interval('s1', '2026-05-04T08:59:00.000Z', null, {
          email: 's1@student.myschool.edu',
          displayName: 'Ava Thompson',
        }),
        interval('s2', '2026-05-04T09:12:00.000Z', '2026-05-04T09:20:00.000Z', {
          email: 's2@student.myschool.edu',
          displayName: 'Liam Rivera',
        }),
      ],
      mappings: [],
      now: new Date('2026-05-04T09:30:00.000Z'),
    });

    expect(report.summary).toMatchObject({ online: 1, left: 1, absent: 1, late: 1, total: 3 });
    const ava = report.statuses.find((s) => s.studentId === 's1');
    const liam = report.statuses.find((s) => s.studentId === 's2');
    const sofia = report.statuses.find((s) => s.studentId === 's3');
    expect(ava?.status).toBe('online');
    expect(ava?.late).toBe(false);
    expect(liam?.status).toBe('left');
    expect(liam?.late).toBe(true);
    expect(sofia?.status).toBe('absent');
  });

  it('lists unmatched participants as unknown', () => {
    const report = computeSessionReport({
      session: session(),
      students: roster,
      intervals: [
        interval('s1', '2026-05-04T09:00:00.000Z', null),
        interval('unknown-key', '2026-05-04T09:02:00.000Z', null, {
          email: 'mystery@gmail.com',
          displayName: 'Mystery Guest',
        }),
      ],
      mappings: [],
      now: new Date('2026-05-04T09:30:00.000Z'),
    });
    expect(report.unknown).toHaveLength(1);
    expect(report.unknown[0]).toMatchObject({
      displayName: 'Mystery Guest',
      email: 'mystery@gmail.com',
      isOnline: true,
    });
  });

  it('retroactively applies a manual mapping to unknown participants', () => {
    const intervals = [
      interval('mystery-key', '2026-05-04T09:02:00.000Z', null, {
        email: null,
        displayName: 'Android User 79152',
      }),
    ];
    const before = computeSessionReport({
      session: session(),
      students: roster,
      intervals,
      mappings: [],
      now: new Date('2026-05-04T09:30:00.000Z'),
    });
    expect(before.unknown).toHaveLength(1);

    const after = computeSessionReport({
      session: session(),
      students: roster,
      intervals,
      mappings: [
        {
          id: 'm1',
          rawKey: 'android user 79152',
          rawName: 'Android User 79152',
          rawEmail: null,
          studentId: 's2',
          createdAt: '2026-05-04T09:31:00.000Z',
        },
      ],
      now: new Date('2026-05-04T09:30:00.000Z'),
    });
    expect(after.unknown).toHaveLength(0);
    expect(after.statuses.find((s) => s.studentId === 's2')?.status).toBe('online');
  });

  it('builds a descending activity feed with joins and leaves', () => {
    const report = computeSessionReport({
      session: session(),
      students: roster,
      intervals: [
        interval('s1', '2026-05-04T09:00:00.000Z', '2026-05-04T09:05:00.000Z'),
        interval('s2', '2026-05-04T09:10:00.000Z', null),
      ],
      mappings: [],
      now: new Date('2026-05-04T09:30:00.000Z'),
    });
    const kinds = report.activity.map((a) => `${a.kind}:${a.displayName}`);
    expect(kinds).toEqual(['join:Liam Rivera', 'leave:Ava Thompson', 'join:Ava Thompson']);
    expect(report.activity[0]!.at).toBe('2026-05-04T09:10:00.000Z');
  });

  it('handles a session that has not started yet', () => {
    const report = computeSessionReport({
      session: session(),
      students: roster,
      intervals: [],
      mappings: [],
      now: new Date('2026-05-04T08:30:00.000Z'),
    });
    expect(report.summary).toMatchObject({ online: 0, left: 0, absent: 3, late: 0 });
    expect(report.summary.attendanceAvgPct).toBe(0);
  });

  it('computes average attendance across the roster', () => {
    const report = computeSessionReport({
      session: session(),
      students: roster,
      intervals: [interval('s1', '2026-05-04T09:00:00.000Z', '2026-05-04T09:22:30.000Z')],
      mappings: [],
      now: new Date('2026-05-04T09:30:00.000Z'),
    });
    // Ava: 22.5/30 min live = 75%; others absent 0% → average 25%.
    expect(report.summary.attendanceAvgPct).toBeCloseTo(25, 1);
  });
});
