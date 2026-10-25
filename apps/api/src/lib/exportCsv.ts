import type { SessionStatusReport } from '../domain/status.js';
import { toCsv } from './csv.js';

function msToClock(ms: number): string {
  const totalMinutes = Math.floor(ms / 60_000);
  const minutes = Math.floor(totalMinutes / 60);
  const seconds = totalMinutes % 60;
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  return `${mm}:${ss}`;
}

function hhmm(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.toISOString().slice(0, 16).replace('T', ' ')} UTC`;
}

/** Builds the per-student attendance CSV for one session. */
export function buildAttendanceCsv(sessionTitle: string, report: SessionStatusReport): string {
  const header = [
    'Name',
    'Email',
    'Section',
    'Status',
    'Late',
    'Unstable',
    'Rejoins',
    'First join (UTC)',
    'Last leave (UTC)',
    'Time in call',
    'Attendance %',
  ];

  const rows = report.statuses.map((s) => [
    s.name,
    s.email,
    s.section,
    s.status.toUpperCase(),
    s.late ? 'yes' : 'no',
    s.unstable ? 'yes' : 'no',
    s.rejoinCount,
    hhmm(s.joinedAt),
    hhmm(s.lastLeftAt),
    msToClock(s.totalMs),
    s.attendancePct.toFixed(1),
  ]);

  const preamble = [
    ['Session', sessionTitle],
    ['Generated at (UTC)', hhmm(report.now)],
    ['Online', report.summary.online],
    ['Left', report.summary.left],
    ['Absent', report.summary.absent],
    ['Late', report.summary.late],
    [],
  ];

  const unknown = report.unknown.length
    ? [
        [],
        ['Unknown participants'],
        ['Display name', 'Email', 'Joins', 'First seen (UTC)'],
        ...report.unknown.map((u) => [
          u.displayName,
          u.email ?? '',
          u.joinCount,
          hhmm(u.firstJoinedAt),
        ]),
      ]
    : [];

  return toCsv([...preamble, header, ...rows, ...unknown]);
}
