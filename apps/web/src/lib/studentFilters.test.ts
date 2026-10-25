import { describe, expect, it } from 'vitest';
import { filterStudents, sortStudents } from './studentFilters';
import { makeStudent } from '../test/fixtures';

const students = [
  makeStudent({
    studentId: 's1',
    name: 'Ava Thompson',
    status: 'online',
    late: false,
    attendancePct: 90,
    joinedAt: '2026-05-04T09:00:00Z',
  }),
  makeStudent({
    studentId: 's2',
    name: 'Ben Ode',
    email: 'ben.ode@school.edu',
    section: '10-B',
    status: 'left',
    late: true,
    attendancePct: 50,
    joinedAt: '2026-05-04T09:12:00Z',
  }),
  makeStudent({
    studentId: 's3',
    name: 'Cara Vint',
    email: 'cara.vint@school.edu',
    section: '10-A',
    status: 'absent',
    attendancePct: 0,
    joinedAt: null,
    currentStintStartedAt: null,
  }),
];

describe('filterStudents', () => {
  it('returns everything for an empty query and the "all" filter', () => {
    expect(filterStudents(students, '', 'all')).toHaveLength(3);
  });

  it('matches name, email or section case-insensitively', () => {
    expect(filterStudents(students, 'ava', 'all')).toEqual([students[0]]);
    expect(filterStudents(students, '10-b', 'all')).toEqual([students[1]]);
  });

  it('filters by participant status', () => {
    expect(filterStudents(students, '', 'online').map((s) => s.studentId)).toEqual(['s1']);
    expect(filterStudents(students, '', 'absent').map((s) => s.studentId)).toEqual(['s3']);
  });

  it('filters by late and unstable flags', () => {
    expect(filterStudents(students, '', 'late').map((s) => s.studentId)).toEqual(['s2']);
    expect(filterStudents(students, '', 'unstable')).toHaveLength(0);
  });
});

describe('sortStudents', () => {
  it('sorts by name ascending', () => {
    expect(sortStudents(students, 'name', 'asc').map((s) => s.name)).toEqual([
      'Ava Thompson',
      'Ben Ode',
      'Cara Vint',
    ]);
  });

  it('sorts by attendance descending', () => {
    expect(sortStudents(students, 'attendance', 'desc').map((s) => s.studentId)).toEqual([
      's1',
      's2',
      's3',
    ]);
  });

  it('sinks absent students to the bottom regardless of sort key', () => {
    const sorted = sortStudents(students, 'attendance', 'asc');
    expect(sorted.at(-1)?.status).toBe('absent');
  });

  it('treats students without a join time as latest among present students', () => {
    // Absent students sink to the bottom in every sort, so s3 stays last;
    // among the rest, the latest join time (s2, 09:12) comes first descending.
    const sorted = sortStudents(students, 'joined', 'desc');
    expect(sorted[0]?.studentId).toBe('s2');
    expect(sorted.at(-1)?.studentId).toBe('s3');
  });

  it('does not mutate the input array', () => {
    const copy = [...students];
    sortStudents(students, 'name', 'desc');
    expect(students).toEqual(copy);
  });
});
