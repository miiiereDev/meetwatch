import { useState } from 'react';
import { SessionSelector } from '../components/SessionSelector';
import { StudentTable } from '../components/StudentTable';
import { SummaryCards } from '../components/SummaryCards';
import { ActivityFeed } from '../components/ActivityFeed';
import { UnknownParticipants } from '../components/UnknownParticipants';
import { Card, ErrorState, EmptyState, Spinner } from '../components/ui';
import { useSessionDetail, useSessions } from '../hooks/queries';
import { useNow } from '../hooks/useNow';
import { formatRelative, formatTime } from '../lib/format';

export function Dashboard() {
  const { data, isLoading, isError, error, refetch } = useSessions();
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const nowMs = useNow();

  const sessions = data?.sessions ?? [];
  const effectiveId =
    selectedId && sessions.some((s) => s.id === selectedId)
      ? selectedId
      : (sessions.find((s) => s.status === 'active') ?? sessions[0])?.id;
  const listSession = sessions.find((s) => s.id === effectiveId);
  const detail = useSessionDetail(effectiveId);

  return (
    <div className="space-y-4">
      {isLoading ? <Spinner label="Loading sessions" /> : null}
      {isError ? <ErrorState message={String(error)} onRetry={() => void refetch()} /> : null}
      {!isLoading && !isError && sessions.length === 0 ? (
        <EmptyState
          title="No sessions yet"
          hint="Start one from the Settings page, or wait for the simulator to seed one."
        />
      ) : null}

      {sessions.length > 0 && listSession ? (
        <>
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <SessionSelector
                sessions={sessions}
                selectedId={effectiveId}
                onSelect={setSelectedId}
              />
              <SessionMeta
                startsAt={listSession.startsAt}
                endsAt={listSession.endsAt}
                effectiveNow={listSession.effectiveNow}
                status={listSession.status}
                lateThresholdMinutes={listSession.lateThresholdMinutes}
                timeScale={listSession.timeScale}
              />
            </div>
          </Card>

          <SummaryCards summary={listSession.summary} />

          <UnknownParticipants
            sessionId={listSession.id}
            unknown={detail.data?.report.unknown ?? []}
          />

          <div className="grid gap-4 lg:grid-cols-3">
            <Card title="Students" className="lg:col-span-2">
              <StudentTable
                statuses={detail.data?.report.statuses}
                isLoading={detail.isLoading}
                nowMs={nowMs}
                caption={`Students in ${listSession.title || listSession.meetingCode}`}
              />
            </Card>
            <Card title="Live activity">
              <ActivityFeed activity={detail.data?.report.activity ?? []} />
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
}

function SessionMeta({
  startsAt,
  endsAt,
  effectiveNow,
  status,
  lateThresholdMinutes,
  timeScale,
}: {
  startsAt: string;
  endsAt: string | null;
  effectiveNow: string;
  status: string;
  lateThresholdMinutes: number;
  timeScale: number;
}) {
  const effMs = Date.parse(effectiveNow);
  const startMs = Date.parse(startsAt);
  const endMs = endsAt ? Date.parse(endsAt) : null;

  let countdown: string;
  if (status === 'ended') countdown = 'ended';
  else if (effMs < startMs) countdown = `starts ${formatRelative(effMs, startMs)}`;
  else if (endMs) countdown = `ends ${formatRelative(effMs, endMs)}`;
  else countdown = 'running';

  return (
    <div className="text-xs text-slate-500 dark:text-slate-400">
      <p>
        {formatTime(startsAt)}
        {endsAt ? ` – ${formatTime(endsAt)}` : ''} · late after {lateThresholdMinutes} min
        {timeScale > 1 ? ` · sim speed ${timeScale}×` : ''}
      </p>
      <p className="font-medium text-slate-600 dark:text-slate-300">{countdown}</p>
    </div>
  );
}
