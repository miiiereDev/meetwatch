import { describe, it, expect } from 'vitest';
import {
  FUZZY_NAME_THRESHOLD,
  matchParticipant,
  participantRawKey,
} from '../src/domain/matching.js';
import type { Mapping, Student } from '../src/domain/types.js';

function student(id: string, name: string, email: string, section = '10-A'): Student {
  return { id, name, email, section, createdAt: '2026-01-01T00:00:00.000Z' };
}

const ava = student('s1', 'Ava Thompson', 'ava.thompson@student.myschool.edu');
const liam = student('s2', 'Liam Rivera', 'liam.rivera@student.myschool.edu', '10-B');

const students = [ava, liam];

function mapping(rawKey: string, rawName: string, studentId: string): Mapping {
  return {
    id: `m-${rawKey}`,
    rawKey,
    rawName,
    rawEmail: null,
    studentId,
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('matchParticipant', () => {
  it('matches by exact email case-insensitively', () => {
    const result = matchParticipant(
      { email: 'AVA.THOMPSON@STUDENT.MYSCHOOL.EDU', displayName: 'Whatever' },
      students,
      [],
    );
    expect(result.student?.id).toBe('s1');
    expect(result.method).toBe('email');
  });

  it('matches via a persisted mapping keyed by email', () => {
    const result = matchParticipant({ email: 'ava.t@gmail.com', displayName: 'Ava T' }, students, [
      mapping('ava.t@gmail.com', 'Ava T', 's1'),
    ]);
    expect(result.student?.id).toBe('s1');
    expect(result.method).toBe('mapping-email');
  });

  it('matches via a persisted mapping keyed by display name when no email', () => {
    const result = matchParticipant({ email: null, displayName: 'Android User 79152' }, students, [
      mapping('android user 79152', 'Android User 79152', 's2'),
    ]);
    expect(result.student?.id).toBe('s2');
    expect(result.method).toBe('mapping-name');
  });

  it('matches by email local part when domains differ', () => {
    const result = matchParticipant(
      { email: 'liam.rivera@gmail.com', displayName: 'Liam R' },
      students,
      [],
    );
    expect(result.student?.id).toBe('s2');
    expect(result.method).toBe('email-localpart');
  });

  it('matches by fuzzy display name with typo above the threshold', () => {
    const result = matchParticipant({ email: null, displayName: 'Ava Thomspn' }, students, []);
    expect(result.student?.id).toBe('s1');
    expect(result.method).toBe('fuzzy-name');
    expect(result.score).toBeGreaterThanOrEqual(FUZZY_NAME_THRESHOLD);
  });

  it('does not fuzzy-match unrelated names', () => {
    const result = matchParticipant({ email: null, displayName: 'Total Stranger' }, students, []);
    expect(result.student).toBeNull();
    expect(result.method).toBeNull();
  });

  it('prefers mapping over fuzzy matching', () => {
    // "Ava T" alone would fuzzy-match Ava, but the mapping says it is Liam.
    const result = matchParticipant({ email: null, displayName: 'Ava T' }, students, [
      mapping('ava t', 'Ava T', 's2'),
    ]);
    expect(result.student?.id).toBe('s2');
    expect(result.method).toBe('mapping-name');
  });

  it('returns the best fuzzy candidate among several similar names', () => {
    const close = student('s3', 'Ava Thompson-Cruz', 'ava.tc@student.myschool.edu');
    const result = matchParticipant({ email: null, displayName: 'Ava Thompson' }, [close, ava], []);
    expect(result.student?.id).toBe('s1');
  });
});

describe('participantRawKey', () => {
  it('prefers email and normalizes it', () => {
    expect(participantRawKey({ email: ' X@Y.com ', displayName: 'Z' })).toBe('x@y.com');
  });
  it('falls back to the normalized name', () => {
    expect(participantRawKey({ email: null, displayName: 'Guest 123' })).toBe('guest 123');
  });
});
