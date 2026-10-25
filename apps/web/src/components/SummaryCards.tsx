import type { SessionSummary } from '../api/types';
import { percentLabel } from '../lib/format';

interface CardDef {
  label: string;
  value: number;
  accent: string;
}

export function SummaryCards({
  summary,
  lateThresholdLabel,
}: {
  summary: SessionSummary;
  lateThresholdLabel?: string;
}) {
  const cards: CardDef[] = [
    { label: 'Online', value: summary.online, accent: 'text-green-600 dark:text-green-400' },
    { label: 'Left', value: summary.left, accent: 'text-amber-600 dark:text-amber-400' },
    { label: 'Absent', value: summary.absent, accent: 'text-slate-500 dark:text-slate-400' },
    { label: 'Late', value: summary.late, accent: 'text-orange-600 dark:text-orange-400' },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800"
        >
          <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
            {card.label}
          </p>
          <p className={`mt-1 text-3xl font-bold tabular-nums ${card.accent}`}>{card.value}</p>
        </div>
      ))}
      <p className="col-span-2 text-xs text-slate-500 sm:col-span-4 dark:text-slate-400">
        {summary.total} students · {percentLabel(summary.attendanceAvgPct)} average attendance
        {lateThresholdLabel ? ` · ${lateThresholdLabel}` : ''}
      </p>
    </div>
  );
}
