import type { ActivityItem } from '../api/types';
import { formatTime } from '../lib/format';
import { EmptyState } from './ui';

const MAX_ITEMS = 60;

export function ActivityFeed({ activity }: { activity: ActivityItem[] }) {
  if (activity.length === 0) {
    return (
      <EmptyState title="No activity yet" hint="Joins and leaves will appear here in real time." />
    );
  }
  const items = activity.slice(0, MAX_ITEMS);
  return (
    <ol className="max-h-96 space-y-1.5 overflow-y-auto pr-1" aria-label="Activity feed">
      {items.map((item) => (
        <li
          key={item.id}
          className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700/50"
        >
          <span
            aria-hidden="true"
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
              item.kind === 'join'
                ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                : 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300'
            }`}
          >
            {item.kind === 'join' ? '↑' : '↓'}
          </span>
          <span className="min-w-0 flex-1 truncate">
            <span className="font-medium text-slate-800 dark:text-slate-100">
              {item.studentName ?? item.displayName}
            </span>{' '}
            <span
              className={
                item.kind === 'join'
                  ? 'text-green-700 dark:text-green-400'
                  : 'text-amber-700 dark:text-amber-400'
              }
            >
              {item.kind === 'join' ? 'joined' : 'left'}
            </span>
          </span>
          <time dateTime={item.at} className="shrink-0 tabular-nums text-xs text-slate-400">
            {formatTime(item.at)}
          </time>
        </li>
      ))}
    </ol>
  );
}
