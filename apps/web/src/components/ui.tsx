import type { ReactNode } from 'react';

export function Card({
  title,
  children,
  className = '',
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800 ${className}`}
    >
      {title ? (
        <h2 className="mb-3 text-sm font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
          {title}
        </h2>
      ) : null}
      {children}
    </section>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center dark:border-slate-600">
      <p className="font-medium text-slate-700 dark:text-slate-200">{title}</p>
      {hint ? <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{hint}</p> : null}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="flex items-center justify-between gap-4 rounded-lg border border-red-300 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200"
    >
      <p className="text-sm">{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-md border border-red-400 px-3 py-1.5 text-sm font-medium hover:bg-red-100 focus-visible:outline-2 focus-visible:outline-red-500 dark:hover:bg-red-900"
        >
          Retry
        </button>
      ) : null}
    </div>
  );
}

export function LoadingRows({ rows = 5 }: { rows?: number }) {
  return (
    <div className="animate-pulse space-y-2" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-9 rounded bg-slate-200 dark:bg-slate-700" />
      ))}
    </div>
  );
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div
      role="status"
      className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400"
    >
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
      {label}…
    </div>
  );
}
