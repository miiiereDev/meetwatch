import type { SessionStatus } from '../domain/types.js';
import type { DB } from './client.js';
import { StudentRepo } from '../repositories/students.js';
import { SessionRepo } from '../repositories/sessions.js';

/** Deterministic fake roster used for seeding and the simulator. */
export const SEED_STUDENTS: { name: string; email: string; section: string }[] = [
  'Ava Thompson',
  'Liam Rivera',
  'Sofia Nguyen',
  'Noah Patel',
  'Mia Santos',
  'Ethan Cruz',
  'Isabella Reyes',
  'James Okafor',
  'Amara Johnson',
  'Lucas Mendez',
  'Chloe Bautista',
  'Mateus Silva',
  'Harper Lee',
  'Elijah Garcia',
  'Zoe Fernandez',
  'Daniel Kim',
  'Lily Chen',
  'Owen Brooks',
  'Priya Sharma',
  'Gabriel Torres',
  'Hannah Dela Cruz',
  'Leo Martin',
  'Nora Hassan',
  'Isaac Villanueva',
  'Ruby Anderson',
].map((name, i) => ({
  name,
  email: `${name.toLowerCase().replace(/[^a-z]+/g, '.')}@student.myschool.edu`,
  section: i % 2 === 0 ? '10-A' : '10-B',
}));

/** Stable fake meeting codes so seeded sessions are idempotent across restarts. */
export const SEED_MEETING_CODES = ['kmq-zxpl-tsv', 'bhf-wndj-cra', 'lsx-qome-ytr'] as const;

export interface SeedOptions {
  rosterSize?: number;
  lateThresholdMinutes?: number;
  minAttendancePct?: number;
  simulatorSpeed?: number;
  /** Length of a class session in minutes. */
  durationMinutes?: number;
  now?: Date;
  /** When false, only the roster is seeded (non-simulator providers). */
  seedSessions?: boolean;
}

export interface SeedResult {
  seededStudents: number;
  seededSessions: number;
}

export const DEFAULT_SESSION_DURATION_MINUTES = 45;

/** Creates the demo roster and a small set of sessions. Idempotent. */
export function ensureSeed(db: DB, options: SeedOptions = {}): SeedResult {
  const now = options.now ?? new Date();
  const studentRepo = new StudentRepo(db);
  const sessionRepo = new SessionRepo(db);

  let seededStudents = 0;
  if (studentRepo.count() === 0) {
    const size = Math.max(
      1,
      Math.min(options.rosterSize ?? SEED_STUDENTS.length, SEED_STUDENTS.length),
    );
    for (const student of SEED_STUDENTS.slice(0, size)) {
      studentRepo.create(student);
    }
    seededStudents = size;
  }

  const durationMin = options.durationMinutes ?? DEFAULT_SESSION_DURATION_MINUTES;
  const lateThreshold = options.lateThresholdMinutes ?? 10;
  const minAttendance = options.minAttendancePct ?? 75;
  const speed = options.simulatorSpeed ?? 1;

  let seededSessions = 0;
  if (options.seedSessions === false) {
    return { seededStudents, seededSessions };
  }

  // Today's demo session starts shortly after boot so the dashboard comes
  // alive right away; the simulator then plays it at the configured speed.
  const todayStart = new Date(now.getTime() + 30_000);
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(9, 0, 0, 0);
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);

  const planned: {
    code: string;
    title: string;
    start: Date;
    status: SessionStatus;
    timeScale: number;
  }[] = [
    {
      code: SEED_MEETING_CODES[0],
      title: 'History — unit review',
      start: yesterday,
      status: 'ended',
      timeScale: 1,
    },
    {
      code: SEED_MEETING_CODES[1],
      title: 'Science — lab briefing',
      start: todayStart,
      status: 'scheduled',
      timeScale: speed,
    },
    {
      code: SEED_MEETING_CODES[2],
      title: 'Math — problem set walkthrough',
      start: tomorrow,
      status: 'scheduled',
      timeScale: 1,
    },
  ];

  for (const plan of planned) {
    const startIso = plan.start.toISOString();
    const endIso = new Date(plan.start.getTime() + durationMin * 60_000).toISOString();
    if (sessionRepo.getByMeetingCodeOnDay(plan.code, startIso)) continue;
    sessionRepo.create({
      title: plan.title,
      meetingCode: plan.code,
      startsAt: startIso,
      endsAt: endIso,
      lateThresholdMinutes: lateThreshold,
      minAttendancePct: minAttendance,
      status: plan.status,
      timeScale: plan.timeScale,
    });
    seededSessions += 1;
  }

  return { seededStudents, seededSessions };
}
