import type { Mapping, Student } from './types.js';
import { localPartOfEmail, nameSimilarity, normalizeEmail, normalizeName } from './names.js';

/** Minimum Jaro-Winkler score for a fuzzy display-name match. */
export const FUZZY_NAME_THRESHOLD = 0.9;

export interface ParticipantIdentity {
  email: string | null;
  displayName: string;
}

export type MatchMethod = 'email' | 'mapping-email' | 'mapping-name' | 'email-localpart' | 'fuzzy-name';

export interface MatchResult {
  student: Student | null;
  method: MatchMethod | null;
  /** Fuzzy similarity when matched by name. */
  score?: number;
}

/**
 * Stable key for a raw participant identity: normalized email when present,
 * otherwise the normalized display name. Used to persist manual mappings.
 */
export function participantRawKey(identity: ParticipantIdentity): string {
  return identity.email ? normalizeEmail(identity.email) : normalizeName(identity.displayName);
}

function matchByEmail(identity: ParticipantIdentity, students: Student[]): Student | null {
  if (!identity.email) return null;
  const normalized = normalizeEmail(identity.email);
  if (!normalized) return null;
  return students.find((s) => normalizeEmail(s.email) === normalized) ?? null;
}

function matchByEmailLocalPart(identity: ParticipantIdentity, students: Student[]): Student | null {
  if (!identity.email) return null;
  const local = localPartOfEmail(identity.email);
  if (!local) return null;
  return students.find((s) => localPartOfEmail(s.email) === local) ?? null;
}

function matchByMapping(identity: ParticipantIdentity, mappings: Mapping[]): Mapping | null {
  for (const key of [identity.email ? normalizeEmail(identity.email) : null, normalizeName(identity.displayName)]) {
    if (!key) continue;
    const mapping = mappings.find((m) => m.rawKey === key);
    if (mapping) return mapping;
  }
  return null;
}

function matchByFuzzyName(
  identity: ParticipantIdentity,
  students: Student[],
): { student: Student; score: number } | null {
  const name = normalizeName(identity.displayName);
  if (!name) return null;
  const nameTokens = new Set(name.split(' '));

  let best: { student: Student; score: number } | null = null;
  for (const student of students) {
    const score = nameSimilarity(identity.displayName, student.name);
    if (score < FUZZY_NAME_THRESHOLD) continue;
    // Require at least one shared token to avoid surname-only accidents.
    const studentTokens = normalizeName(student.name).split(' ');
    const sharesToken = studentTokens.some((t) => nameTokens.has(t));
    if (!sharesToken) continue;
    if (!best || score > best.score) best = { student, score };
  }
  return best;
}

/**
 * Resolves a Meet participant to a roster student.
 *
 * Match order (strongest first):
 *  1. exact email
 *  2. persisted manual mapping by email key
 *  3. persisted manual mapping by normalized display name
 *  4. email local-part equality (personal vs school address)
 *  5. fuzzy display-name similarity (>= FUZZY_NAME_THRESHOLD, shared token)
 *
 * Returns `{ student: null }` for unknown participants — callers surface those
 * in the "Unknown participants" panel.
 */
export function matchParticipant(
  identity: ParticipantIdentity,
  students: Student[],
  mappings: Mapping[],
): MatchResult {
  const byEmail = matchByEmail(identity, students);
  if (byEmail) return { student: byEmail, method: 'email' };

  const mapping = matchByMapping(identity, mappings);
  if (mapping) {
    const student = students.find((s) => s.id === mapping.studentId);
    if (student) {
      const method: MatchMethod = identity.email ? 'mapping-email' : 'mapping-name';
      return { student, method };
    }
  }

  const byLocalPart = matchByEmailLocalPart(identity, students);
  if (byLocalPart) return { student: byLocalPart, method: 'email-localpart' };

  const fuzzy = matchByFuzzyName(identity, students);
  if (fuzzy) return { student: fuzzy.student, method: 'fuzzy-name', score: fuzzy.score };

  return { student: null, method: null };
}
