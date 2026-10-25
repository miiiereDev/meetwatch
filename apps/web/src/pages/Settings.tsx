import { useRef, useState } from 'react';
import type { AppSettings, ProviderName, Student } from '../api/types';
import {
  useCreateSession,
  useDeleteMapping,
  useMappings,
  useRoster,
  useRosterMutations,
  useSettings,
  useUpdateSettings,
} from '../hooks/queries';
import { Card, ErrorState, Spinner } from '../components/ui';

const PROVIDER_OPTIONS: { value: ProviderName; label: string; hint: string }[] = [
  {
    value: 'simulator',
    label: 'Simulator (demo data)',
    hint: 'Generates realistic joins and leaves for demo sessions.',
  },
  {
    value: 'google',
    label: 'Google Meet (live)',
    hint: 'Polls the Google Meet API for a real meeting. Requires OAuth setup.',
  },
  {
    value: 'csv',
    label: 'CSV import',
    hint: 'Replays an exported Google Meet attendance report file.',
  },
];

export function Settings() {
  const { data: settings, isLoading, isError, error, refetch } = useSettings();
  const { data: roster, isLoading: rosterLoading } = useRoster();

  if (isLoading) return <Spinner label="Loading settings" />;
  if (isError || !settings) {
    return (
      <ErrorState
        message={String(error ?? 'settings unavailable')}
        onRetry={() => void refetch()}
      />
    );
  }

  return (
    <div className="space-y-4">
      <ProviderCard settings={settings} />
      <SimulatorCard settings={settings} />
      <ThresholdsCard
        key={`${settings.lateThresholdMinutes}-${settings.minAttendancePct}`}
        settings={settings}
      />
      <RosterCard students={roster?.students ?? []} isLoading={rosterLoading} />
      <MappingsCard />
      <GoogleCard settings={settings} />
    </div>
  );
}

function Feedback({
  mutation,
  successLabel,
}: {
  mutation: { isError: boolean; error: unknown; isSuccess: boolean };
  successLabel: string;
}) {
  return (
    <>
      {mutation.isError ? (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {String(mutation.error)}
        </p>
      ) : null}
      {mutation.isSuccess ? (
        <p role="status" className="text-sm text-green-700 dark:text-green-400">
          {successLabel}
        </p>
      ) : null}
    </>
  );
}

const inputClass =
  'rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-sky-600 dark:border-slate-600 dark:bg-slate-700';
const buttonClass =
  'rounded-md bg-sky-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700';

function ProviderCard({ settings }: { settings: AppSettings }) {
  const update = useUpdateSettings();
  const [provider, setProvider] = useState<ProviderName>(settings.provider);

  const status = settings.providerStatus;
  const statusLabel: Record<string, string> = {
    idle: 'idle',
    running: 'running',
    needs_auth: 'waiting for Google sign-in',
    error: 'error',
  };

  return (
    <Card title="Data source">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-600 dark:text-slate-300">Provider</span>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value as ProviderName)}
            className={`${inputClass} min-w-64`}
          >
            {PROVIDER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className={buttonClass}
          disabled={update.isPending || provider === settings.provider}
          onClick={() => update.mutate({ provider })}
        >
          {update.isPending ? 'Switching…' : 'Switch provider'}
        </button>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {PROVIDER_OPTIONS.find((o) => o.value === provider)?.hint}
        </p>
      </div>
      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
        Active: <span className="font-medium">{settings.provider}</span> (
        {statusLabel[status.state] ?? status.state}){status.message ? ` — ${status.message}` : ''}
      </p>
      <Feedback mutation={update} successLabel="Provider switched." />
    </Card>
  );
}

function SimulatorCard({ settings }: { settings: AppSettings }) {
  const update = useUpdateSettings();
  const createSession = useCreateSession();
  const [speed, setSpeed] = useState(settings.simulatorSpeed);

  function startDemo() {
    const now = Date.now();
    createSession.mutate({
      title: 'Demo session',
      section: '10-A',
      meetingCode: `demo-${Math.random().toString(36).slice(2, 8)}`,
      startsAt: new Date(now).toISOString(),
      endsAt: new Date(now + 45 * 60_000).toISOString(),
    });
  }

  return (
    <Card title="Simulator">
      <div className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-600 dark:text-slate-300">
            Simulation speed: {speed}× (one sim-hour plays in {Math.round(60 / speed)} wall-minutes)
          </span>
          <input
            type="range"
            min={1}
            max={120}
            step={1}
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
            className="w-64"
            aria-label="Simulation speed"
          />
        </label>
        <button
          type="button"
          className={buttonClass}
          disabled={update.isPending || speed === settings.simulatorSpeed}
          onClick={() => update.mutate({ simulatorSpeed: speed })}
        >
          Apply speed
        </button>
        <button
          type="button"
          className={buttonClass}
          disabled={createSession.isPending}
          onClick={startDemo}
        >
          {createSession.isPending ? 'Starting…' : 'Start demo session'}
        </button>
      </div>
      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
        A demo session runs 45 sim-minutes (about {Math.max(1, Math.round(45 / speed))} wall-minutes
        at {speed}×), then ends and appears in History. New sessions pick up the applied speed.
      </p>
      <Feedback mutation={update} successLabel="Simulator speed saved." />
      <Feedback
        mutation={createSession}
        successLabel="Demo session created — open the Dashboard."
      />
    </Card>
  );
}

function ThresholdsCard({ settings }: { settings: AppSettings }) {
  const update = useUpdateSettings();
  const [late, setLate] = useState(settings.lateThresholdMinutes);
  const [minPct, setMinPct] = useState(settings.minAttendancePct);

  return (
    <Card title="Thresholds">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-600 dark:text-slate-300">
            Late threshold (minutes)
          </span>
          <input
            type="number"
            min={0}
            max={240}
            value={late}
            onChange={(e) => setLate(Number(e.target.value))}
            className={`${inputClass} w-28`}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-600 dark:text-slate-300">
            Minimum attendance (%)
          </span>
          <input
            type="number"
            min={0}
            max={100}
            value={minPct}
            onChange={(e) => setMinPct(Number(e.target.value))}
            className={`${inputClass} w-28`}
          />
        </label>
        <button
          type="button"
          className={buttonClass}
          disabled={update.isPending}
          onClick={() => update.mutate({ lateThresholdMinutes: late, minAttendancePct: minPct })}
        >
          {update.isPending ? 'Saving…' : 'Save thresholds'}
        </button>
      </div>
      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
        Applied to sessions created from now on; existing sessions keep their own values.
      </p>
      <Feedback mutation={update} successLabel="Thresholds saved." />
    </Card>
  );
}

function RosterCard({ students, isLoading }: { students: Student[]; isLoading: boolean }) {
  const { create, remove, importCsv } = useRosterMutations();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [section, setSection] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const [importResult, setImportResult] = useState<string | null>(null);

  function addStudent() {
    if (!name.trim() || !email.trim()) return;
    create.mutate(
      { name: name.trim(), email: email.trim(), section: section.trim() || undefined },
      {
        onSuccess: () => {
          setName('');
          setEmail('');
          setSection('');
        },
      },
    );
  }

  async function onFileChosen(file: File | undefined) {
    if (!file) return;
    setImportResult(null);
    const result = await importCsv.mutateAsync(file);
    const failed = result.errors.length;
    setImportResult(
      `${result.created} created, ${result.updated} updated${failed ? `, ${failed} row(s) failed` : ''}.`,
    );
    if (fileRef.current) fileRef.current.value = '';
  }

  return (
    <Card title={`Roster (${students.length} students)`}>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="sr-only">Student name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full name"
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="sr-only">Student email</span>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="school email"
            type="email"
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="sr-only">Section</span>
          <input
            value={section}
            onChange={(e) => setSection(e.target.value)}
            placeholder="Section (optional)"
            className={inputClass}
          />
        </label>
        <button
          type="button"
          className={buttonClass}
          disabled={create.isPending || !name.trim() || !email.trim()}
          onClick={addStudent}
        >
          Add student
        </button>
        <label className={`${buttonClass} inline-flex cursor-pointer items-center`}>
          {importCsv.isPending ? 'Importing…' : 'Import CSV…'}
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={(e) => void onFileChosen(e.target.files?.[0])}
          />
        </label>
      </div>
      <Feedback mutation={create} successLabel="Student added." />
      {importResult ? (
        <p role="status" className="text-sm text-green-700 dark:text-green-400">
          {importResult}
        </p>
      ) : null}
      {importCsv.isError ? (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          Import failed: {String(importCsv.error)}
        </p>
      ) : null}

      {isLoading ? (
        <Spinner label="Loading roster" />
      ) : students.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          The roster is empty. Add students manually or import a CSV with name, email and section
          columns.
        </p>
      ) : (
        <div className="max-h-72 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs tracking-wide text-slate-500 uppercase dark:bg-slate-700 dark:text-slate-300">
              <tr>
                <th scope="col" className="px-3 py-2">
                  Name
                </th>
                <th scope="col" className="px-3 py-2">
                  Email
                </th>
                <th scope="col" className="px-3 py-2">
                  Section
                </th>
                <th scope="col" className="px-3 py-2">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {students.map((s) => (
                <tr key={s.id}>
                  <td className="px-3 py-1.5 font-medium text-slate-800 dark:text-slate-100">
                    {s.name}
                  </td>
                  <td className="px-3 py-1.5 text-slate-600 dark:text-slate-300">{s.email}</td>
                  <td className="px-3 py-1.5 text-slate-600 dark:text-slate-300">{s.section}</td>
                  <td className="px-3 py-1.5 text-right">
                    <button
                      type="button"
                      onClick={() => remove.mutate(s.id)}
                      disabled={remove.isPending}
                      className="text-xs font-medium text-red-600 hover:text-red-800 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 dark:text-red-400"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function MappingsCard() {
  const { data, isLoading, isError, error, refetch } = useMappings();
  const deleteMapping = useDeleteMapping();
  const mappings = data?.mappings ?? [];

  return (
    <Card title={`Participant mappings (${mappings.length})`}>
      <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
        Manual matches between Meet participants and roster students, remembered across sessions.
        Remove one to send that participant back to the “unknown” panel.
      </p>
      {isLoading ? (
        <Spinner label="Loading mappings" />
      ) : isError ? (
        <ErrorState message={String(error)} onRetry={() => void refetch()} />
      ) : mappings.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          No manual mappings yet. Everything matched the roster automatically.
        </p>
      ) : (
        <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs tracking-wide text-slate-500 uppercase dark:bg-slate-700 dark:text-slate-300">
              <tr>
                <th scope="col" className="px-3 py-2">
                  Participant
                </th>
                <th scope="col" className="px-3 py-2">
                  Matched student
                </th>
                <th scope="col" className="px-3 py-2">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {mappings.map((m) => (
                <tr key={m.id}>
                  <td className="px-3 py-1.5 text-slate-800 dark:text-slate-100">
                    {m.rawName || m.rawKey}
                    {m.rawEmail ? (
                      <span className="text-slate-500 dark:text-slate-400"> · {m.rawEmail}</span>
                    ) : null}
                  </td>
                  <td className="px-3 py-1.5 text-slate-600 dark:text-slate-300">
                    {m.studentName ?? m.studentId}
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    <button
                      type="button"
                      onClick={() => deleteMapping.mutate(m.id)}
                      disabled={deleteMapping.isPending}
                      className="text-xs font-medium text-red-600 hover:text-red-800 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 dark:text-red-400"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {deleteMapping.isError ? (
        <p role="alert" className="mt-2 text-sm text-red-700 dark:text-red-300">
          {String(deleteMapping.error)}
        </p>
      ) : null}
    </Card>
  );
}

function GoogleCard({ settings }: { settings: AppSettings }) {
  return (
    <Card title="Google Meet integration">
      {settings.google.configured ? (
        settings.google.connected ? (
          <p className="text-sm text-green-700 dark:text-green-400">
            Google account connected. Switch the provider to “Google Meet (live)” to poll real
            meetings.
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Connect a Google account with Meet access to start tracking real meetings.
            </p>
            <a href="/api/google/auth-url" className={buttonClass}>
              Connect Google account
            </a>
          </div>
        )
      ) : (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Not configured. Set{' '}
          <code className="rounded bg-slate-100 px-1 dark:bg-slate-700">GOOGLE_CLIENT_ID</code> and{' '}
          <code className="rounded bg-slate-100 px-1 dark:bg-slate-700">GOOGLE_CLIENT_SECRET</code>{' '}
          in the API environment to enable Google sign-in. See{' '}
          <code className="rounded bg-slate-100 px-1 dark:bg-slate-700">docs/GOOGLE_SETUP.md</code>.
        </p>
      )}
    </Card>
  );
}
