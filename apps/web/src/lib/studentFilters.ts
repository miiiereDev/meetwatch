import type { ParticipantStatus, StudentStatus } from '../api/types';

export type StatusFilter = 'all' | ParticipantStatus | 'late' | 'unstable';

export const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All students' },
  { value: 'online', label: 'Online' },
  { value: 'left', label: 'Left' },
  { value: 'absent', label: 'Absent' },
  { value: 'late', label: 'Late' },
  { value: 'unstable', label: 'Unstable' },
];

/** Filters roster rows by free-text query and a status filter. */
export function filterStudents(
  students: StudentStatus[],
  query: string,
  filter: StatusFilter,
): StudentStatus[] {
  const q = query.trim().toLowerCase();
  return students.filter((s) => {
    if (q && !`${s.name} ${s.email} ${s.section}`.toLowerCase().includes(q)) return false;
    switch (filter) {
      case 'all':
        return true;
      case 'late':
        return s.late;
      case 'unstable':
        return s.unstable;
      default:
        return s.status === filter;
    }
  });
}

export type SortKey = 'name' | 'attendance' | 'joined';

/** Sorts rows for the table; absent students always sink to the bottom. */
export function sortStudents(
  students: StudentStatus[],
  key: SortKey,
  direction: 'asc' | 'desc',
): StudentStatus[] {
  const dir = direction === 'asc' ? 1 : -1;
  return [...students].sort((a, b) => {
    // Absent last, regardless of sort.
    if (a.status === 'absent' && b.status !== 'absent') return 1;
    if (b.status === 'absent' && a.status !== 'absent') return -1;
    switch (key) {
      case 'attendance':
        return (a.attendancePct - b.attendancePct) * dir;
      case 'joined': {
        const av = a.joinedAt ? Date.parse(a.joinedAt) : Number.POSITIVE_INFINITY;
        const bv = b.joinedAt ? Date.parse(b.joinedAt) : Number.POSITIVE_INFINITY;
        return (av - bv) * dir;
      }
      default:
        return a.name.localeCompare(b.name) * dir;
    }
  });
}
