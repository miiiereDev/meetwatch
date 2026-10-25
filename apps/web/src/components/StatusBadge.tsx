import type { ParticipantStatus } from '../api/types';

const STYLES: Record<ParticipantStatus, string> = {
  online:
    'bg-green-100 text-green-800 border-green-300 dark:bg-green-900 dark:text-green-200 dark:border-green-700',
  left: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900 dark:text-amber-200 dark:border-amber-700',
  absent:
    'bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600',
};

const DOT: Record<ParticipantStatus, string> = {
  online: 'bg-green-500',
  left: 'bg-amber-500',
  absent: 'bg-slate-400',
};

const LABEL: Record<ParticipantStatus, string> = {
  online: 'Online',
  left: 'Left',
  absent: 'Absent',
};

export function StatusBadge({ status }: { status: ParticipantStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STYLES[status]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${DOT[status]}`} aria-hidden="true" />
      {LABEL[status]}
    </span>
  );
}

export function FlagBadge({ kind }: { kind: 'late' | 'unstable' }) {
  const style =
    kind === 'late'
      ? 'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900 dark:text-orange-200 dark:border-orange-700'
      : 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-900 dark:text-purple-200 dark:border-purple-700';
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold tracking-wide uppercase ${style}`}
    >
      {kind === 'late' ? 'Late' : 'Unstable'}
    </span>
  );
}
