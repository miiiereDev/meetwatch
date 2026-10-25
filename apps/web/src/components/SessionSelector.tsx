import type { SessionListItem } from '../api/types';
import { formatTime } from '../lib/format';

const STATUS_DOT: Record<SessionListItem['status'], string> = {
  scheduled: 'bg-sky-500',
  active: 'bg-green-500',
  ended: 'bg-slate-400',
};

export function SessionSelector({
  sessions,
  selectedId,
  onSelect,
}: {
  sessions: SessionListItem[];
  selectedId: string | undefined;
  onSelect: (id: string) => void;
}) {
  return (
    <label className="flex flex-wrap items-center gap-2 text-sm">
      <span className="font-medium text-slate-600 dark:text-slate-300">Session</span>
      <select
        value={selectedId ?? ''}
        onChange={(e) => onSelect(e.target.value)}
        aria-label="Select class session"
        className="min-w-64 flex-1 rounded-md border border-slate-300 bg-white px-3 py-1.5 focus-visible:outline-2 focus-visible:outline-sky-600 dark:border-slate-600 dark:bg-slate-700"
      >
        {sessions.length === 0 ? <option value="">No sessions</option> : null}
        {sessions.map((s) => (
          <option key={s.id} value={s.id}>
            {formatTime(s.startsAt)} · {s.title || s.meetingCode} ({s.status})
          </option>
        ))}
      </select>
      {selectedId ? (
        <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          <span
            className={`h-2 w-2 rounded-full ${STATUS_DOT[sessions.find((s) => s.id === selectedId)?.status ?? 'ended']}`}
          />
          {sessions.find((s) => s.id === selectedId)?.meetingCode}
        </span>
      ) : null}
    </label>
  );
}
