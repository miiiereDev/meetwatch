import { useState } from 'react';
import type { StudentStatus } from '../api/types';
import { SessionSelector } from '../components/SessionSelector';
import { StudentTable } from '../components/StudentTable';
import { SummaryCards } from '../components/SummaryCards';
import { Card, EmptyState, ErrorState, Spinner } from '../components/ui';
import { useEndSession, useSessionDetail, useSessions } from '../hooks/queries';
import { useNow } from '../hooks/useNow';
import { api } from '../api/client';
import { formatTime } from '../lib/format';

export function History() {
  const { data, isLoading, isError, error, refetch } = useSessions();
  const endSession = useEndSession();
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const nowMs = useNow();

  const sessions = data?.sessions ?? [];
  const ended = sessions.filter((s) => s.status === 'ended');
  const effectiveId =
    selectedId && sessions.some((s) => s.id === selectedId)
      ? selectedId
      : (ended[0] ?? sessions[0])?.id;
  const selected = sessions.find((s) => s.id === effectiveId);
  const detail = useSessionDetail(effectiveId);

  return (
    <div className="space-y-4">
      {isLoading ? <Spinner label="Loading history" /> : null}
      {isError ? <ErrorState message={String(error)} onRetry={() => void refetch()} /> : null}
      {!isLoading && !isError && sessions.length === 0 ? (
        <EmptyState
          title="No sessions recorded yet"
          hint="History fills in as sessions run and end."
        />
      ) : null}

      {sessions.length > 0 && selected ? (
        <>
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <SessionSelector
                sessions={sessions}
                selectedId={effectiveId}
                onSelect={setSelectedId}
              />
              <div className="flex items-center gap-2">
                <a
                  href={api.exportCsvUrl(selected.id)}
                  className="rounded-md bg-sky-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700"
                  download
                >
                  Export CSV
                </a>
                {selected.status !== 'ended' ? (
                  <button
                    type="button"
                    onClick={() => endSession.mutate(selected.id)}
                    disabled={endSession.isPending}
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-100 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700 dark:border-slate-600 dark:hover:bg-slate-700"
                  >
                    End session
                  </button>
                ) : null}
              </div>
            </div>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              {ended.length} ended session{ended.length === 1 ? '' : 's'} ·{' '}
              {formatTime(selected.startsAt)} –{' '}
              {selected.endsAt ? formatTime(selected.endsAt) : 'open'} · pass mark{' '}
              {selected.minAttendancePct}%
            </p>
          </Card>

          <SummaryCards summary={selected.summary} />

          <Card title="Attendance record">
            <StudentTable
              statuses={detail.data?.report.statuses}
              isLoading={detail.isLoading}
              nowMs={nowMs}
              caption={`Attendance for ${selected.title || selected.meetingCode}`}
              emptyHint="No interval data was recorded for this session."
              passMark={selected.minAttendancePct}
            />
            <PassSummary
              statuses={detail.data?.report.statuses}
              passMark={selected.minAttendancePct}
            />
          </Card>
        </>
      ) : null}
    </div>
  );
}

function PassSummary({
  statuses,
  passMark,
}: {
  statuses: StudentStatus[] | undefined;
  passMark: number;
}) {
  if (!statuses || statuses.length === 0) return null;
  const passing = statuses.filter((s) => s.attendancePct >= passMark).length;
  return (
    <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
      <span className="font-medium text-slate-700 dark:text-slate-200">
        {passing} of {statuses.length}
      </span>{' '}
      students met the {passMark}% pass mark.
    </p>
  );
}
