/** Formats milliseconds as m:ss (or h:mm:ss past an hour). */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '0:00';
  const totalSeconds = Math.floor(ms / 1000);
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3600);
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${minutes}:${ss}`;
}

/** Locale time for an ISO timestamp (empty for null). */
export function formatTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/** Human "in 2 min" / "5 min ago" style offset used for countdowns. */
export function formatRelative(fromMs: number, toMs: number): string {
  const deltaMs = toMs - fromMs;
  const abs = Math.abs(deltaMs);
  const minutes = Math.round(abs / 60_000);
  const label = minutes >= 1 ? `${minutes} min` : 'less than a minute';
  return deltaMs >= 0 ? `in ${label}` : `${label} ago`;
}

export function percentLabel(pct: number): string {
  return `${Math.round(pct)}%`;
}
