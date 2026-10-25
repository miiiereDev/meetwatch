import { NavLink, Route, Routes } from 'react-router';
import { Dashboard } from './pages/Dashboard';
import { History } from './pages/History';
import { Settings } from './pages/Settings';
import { useLiveEvents } from './hooks/useSse';
import { useSettings } from './hooks/queries';

const NAV_CLASS = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-1.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 ${
    isActive
      ? 'bg-sky-700 text-white'
      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'
  }`;

export default function App() {
  // Single SSE subscription for the whole app; it feeds react-query caches.
  useLiveEvents();
  const { data: settings } = useSettings();

  const providerStatus = settings?.providerStatus;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-900 dark:text-slate-100">
      <header className="border-b border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 p-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight">MeetWatch</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Online-student monitoring for Google Meet sessions
            </p>
          </div>
          <nav aria-label="Main navigation" className="ml-auto flex items-center gap-1">
            <NavLink to="/" end className={NAV_CLASS}>
              Dashboard
            </NavLink>
            <NavLink to="/history" className={NAV_CLASS}>
              History
            </NavLink>
            <NavLink to="/settings" className={NAV_CLASS}>
              Settings
            </NavLink>
          </nav>
        </div>
        {settings ? (
          <div
            className={`mx-auto max-w-6xl px-4 pb-3 text-xs ${
              providerStatus?.state === 'error'
                ? 'text-red-700 dark:text-red-300'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            Provider: <span className="font-medium">{settings.provider}</span>
            {providerStatus?.message ? ` — ${providerStatus.message}` : ''}
          </div>
        ) : null}
      </header>
      <main className="mx-auto max-w-6xl p-4">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/history" element={<History />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Dashboard />} />
        </Routes>
      </main>
    </div>
  );
}
