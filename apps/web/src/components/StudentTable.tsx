import { useMemo, useState } from 'react';
import type { StudentStatus } from '../api/types';
import { formatDuration, formatTime, percentLabel } from '../lib/format';
import {
  STATUS_FILTERS,
  filterStudents,
  sortStudents,
  type SortKey,
  type StatusFilter,
} from '../lib/studentFilters';
import { FlagBadge, StatusBadge } from './StatusBadge';
import { EmptyState, LoadingRows } from './ui';

interface StudentTableProps {
  statuses: StudentStatus[] | undefined;
  isLoading: boolean;
  /** Live reference time (ms) for ticking durations. */
  nowMs: number;
  caption: string;
  emptyHint?: string;
  /** Attendance % at or above which a student counts as passing (default 75). */
  passMark?: number;
}

export function StudentTable({
  statuses,
  isLoading,
  nowMs,
  caption,
  emptyHint,
  passMark = 75,
}: StudentTableProps) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const rows = useMemo(() => {
    if (!statuses) return [];
    return sortStudents(filterStudents(statuses, query, filter), sortKey, sortDir);
  }, [statuses, query, filter, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  const ariaSort = (key: SortKey) =>
    sortKey === key ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-sm">
          <span className="sr-only">Search students</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, email, section…"
            aria-label="Search students"
            className="w-64 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-sky-600 dark:border-slate-600 dark:bg-slate-700"
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <span className="sr-only">Filter by status</span>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as StatusFilter)}
            aria-label="Filter by status"
            className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-sky-600 dark:border-slate-600 dark:bg-slate-700"
          >
            {STATUS_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
        <span className="ml-auto text-xs text-slate-500 dark:text-slate-400">
          {rows.length} of {statuses?.length ?? 0} shown
        </span>
      </div>

      {isLoading ? (
        <LoadingRows rows={6} />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No students match"
          hint={emptyHint ?? 'Try clearing the search or filter.'}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
          <table className="w-full min-w-[640px] text-sm">
            <caption className="sr-only">{caption}</caption>
            <thead className="bg-slate-50 text-left text-xs tracking-wide text-slate-500 uppercase dark:bg-slate-700 dark:text-slate-300">
              <tr>
                <th scope="col" aria-sort={ariaSort('name')} className="px-3 py-2">
                  <SortButton
                    label="Student"
                    active={sortKey === 'name'}
                    dir={sortDir}
                    onClick={() => toggleSort('name')}
                  />
                </th>
                <th scope="col" className="px-3 py-2">
                  Status
                </th>
                <th scope="col" aria-sort={ariaSort('joined')} className="px-3 py-2">
                  <SortButton
                    label="Joined"
                    active={sortKey === 'joined'}
                    dir={sortDir}
                    onClick={() => toggleSort('joined')}
                  />
                </th>
                <th scope="col" className="px-3 py-2">
                  In call
                </th>
                <th scope="col" aria-sort={ariaSort('attendance')} className="px-3 py-2">
                  <SortButton
                    label="Attendance"
                    active={sortKey === 'attendance'}
                    dir={sortDir}
                    onClick={() => toggleSort('attendance')}
                  />
                </th>
                <th scope="col" className="px-3 py-2">
                  Flags
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {rows.map((s) => (
                <StudentRow key={s.studentId} student={s} nowMs={nowMs} passMark={passMark} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SortButton({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: 'asc' | 'desc';
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 uppercase hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-sky-600 dark:hover:text-slate-100 ${active ? 'text-slate-800 dark:text-slate-100' : ''}`}
    >
      {label}
      <span aria-hidden="true" className="text-[10px]">
        {active ? (dir === 'asc' ? '▲' : '▼') : '↕'}
      </span>
    </button>
  );
}

function StudentRow({
  student,
  nowMs,
  passMark,
}: {
  student: StudentStatus;
  nowMs: number;
  passMark: number;
}) {
  const liveMs =
    student.status === 'online' && student.currentStintStartedAt
      ? nowMs - Date.parse(student.currentStintStartedAt)
      : student.totalMs;

  const passing = student.attendancePct >= passMark;
  const barColor = passing
    ? 'bg-green-500'
    : student.attendancePct >= passMark / 2
      ? 'bg-amber-500'
      : 'bg-red-400';

  return (
    <tr className={student.status === 'online' ? 'bg-green-50/50 dark:bg-green-900/10' : undefined}>
      <td className="px-3 py-2">
        <div className="font-medium text-slate-800 dark:text-slate-100">{student.name}</div>
        <div className="text-xs text-slate-500 dark:text-slate-400">
          {student.email}
          {student.section ? ` · ${student.section}` : ''}
        </div>
      </td>
      <td className="px-3 py-2">
        <StatusBadge status={student.status} />
      </td>
      <td className="px-3 py-2 tabular-nums text-slate-600 dark:text-slate-300">
        {formatTime(student.joinedAt)}
      </td>
      <td className="px-3 py-2 tabular-nums text-slate-600 dark:text-slate-300">
        {student.status === 'absent' ? '—' : formatDuration(liveMs)}
        {student.rejoinCount > 0 ? (
          <span className="ml-1 text-xs text-slate-400">({student.rejoinCount} rejoins)</span>
        ) : null}
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-2">
          <div
            className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-600"
            role="presentation"
          >
            <div
              className={`h-full ${barColor}`}
              style={{ width: `${Math.min(100, student.attendancePct)}%` }}
            />
          </div>
          <span
            className={`tabular-nums ${passing ? 'text-slate-600 dark:text-slate-300' : 'font-semibold text-red-700 dark:text-red-400'}`}
          >
            {percentLabel(student.attendancePct)}
            {passing ? '' : ' !'}
          </span>
        </div>
      </td>
      <td className="px-3 py-2">
        <div className="flex flex-wrap gap-1">
          {student.late ? <FlagBadge kind="late" /> : null}
          {student.unstable ? <FlagBadge kind="unstable" /> : null}
          {!student.late && !student.unstable ? (
            <span className="text-xs text-slate-400">—</span>
          ) : null}
        </div>
      </td>
    </tr>
  );
}
