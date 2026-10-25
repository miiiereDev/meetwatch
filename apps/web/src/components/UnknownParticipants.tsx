import { useState } from 'react';
import type { UnknownParticipant } from '../api/types';
import { useCreateMapping, useRoster } from '../hooks/queries';
import { formatTime } from '../lib/format';
import { Card } from './ui';

export function UnknownParticipants({
  sessionId,
  unknown,
}: {
  sessionId: string;
  unknown: UnknownParticipant[];
}) {
  const { data: roster } = useRoster();
  const createMapping = useCreateMapping();
  const [selected, setSelected] = useState<Record<string, string>>({});

  if (unknown.length === 0) return null;

  return (
    <Card title={`Unknown participants (${unknown.length})`}>
      <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
        These Meet participants did not match the roster by email or name. Map them to a student —
        the mapping is remembered for future sessions.
      </p>
      <ul className="space-y-2">
        {unknown.map((p) => (
          <li
            key={p.participantKey}
            className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 p-2.5 dark:border-slate-600"
          >
            <div className="min-w-40 flex-1">
              <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                {p.displayName}
                {p.isOnline ? (
                  <span className="ml-2 text-xs font-semibold text-green-600 dark:text-green-400">
                    in call
                  </span>
                ) : null}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {p.email ?? 'no email'} · {p.joinCount} join{p.joinCount === 1 ? '' : 's'}
                {p.lastSeenAt ? ` · last seen ${formatTime(p.lastSeenAt)}` : ''}
              </p>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <span className="sr-only">Map {p.displayName} to a student</span>
              <select
                value={selected[p.participantKey] ?? ''}
                onChange={(e) =>
                  setSelected((prev) => ({ ...prev, [p.participantKey]: e.target.value }))
                }
                className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-sky-600 dark:border-slate-600 dark:bg-slate-700"
              >
                <option value="">Choose student…</option>
                {roster?.students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.section || s.email})
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={!selected[p.participantKey] || createMapping.isPending}
              onClick={() => {
                const studentId = selected[p.participantKey];
                if (!studentId) return;
                createMapping.mutate(
                  { displayName: p.displayName, email: p.email, studentId },
                  { onSuccess: () => setSelected((prev) => ({ ...prev, [p.participantKey]: '' })) },
                );
              }}
              className="rounded-md bg-sky-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700"
            >
              Map
            </button>
          </li>
        ))}
      </ul>
      <input type="hidden" value={sessionId} />
      {createMapping.isError ? (
        <p role="alert" className="mt-2 text-sm text-red-700 dark:text-red-300">
          {String(createMapping.error)}
        </p>
      ) : null}
    </Card>
  );
}
