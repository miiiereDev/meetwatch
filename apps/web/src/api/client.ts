import type {
  AppSettings,
  ClassSession,
  CsvImportResult,
  Mapping,
  SessionDetail,
  SessionListItem,
  Student,
} from './types';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    // A Blob/File body carries its own content type (e.g. the text/csv the API
    // requires for imports); anything else is JSON.
    headers: init?.body instanceof Blob ? undefined : { 'content-type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`;
    try {
      const body = (await res.json()) as {
        error?: string;
        issues?: { path: string; message: string }[];
      };
      if (body.error) message = body.error;
      if (body.issues?.length)
        message += `: ${body.issues.map((i) => `${i.path} ${i.message}`).join('; ')}`;
    } catch {
      // keep status text
    }
    throw new Error(message);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  // Sessions
  listSessions: () => request<{ sessions: SessionListItem[] }>('/sessions'),
  getSession: (id: string) => request<SessionDetail>(`/sessions/${id}`),
  createSession: (body: {
    title?: string;
    section?: string;
    meetingCode: string;
    startsAt: string;
    endsAt?: string | null;
  }) =>
    request<{ session: ClassSession }>('/sessions', { method: 'POST', body: JSON.stringify(body) }),
  endSession: (id: string) =>
    request<{ session: ClassSession }>(`/sessions/${id}/end`, { method: 'POST' }),
  deleteSession: (id: string) => request<void>(`/sessions/${id}`, { method: 'DELETE' }),

  // Roster
  listStudents: () => request<{ students: Student[] }>('/roster'),
  createStudent: (body: { name: string; email: string; section?: string }) =>
    request<{ student: Student }>('/roster', { method: 'POST', body: JSON.stringify(body) }),
  deleteStudent: (id: string) => request<void>(`/roster/${id}`, { method: 'DELETE' }),
  importRosterCsv: (csv: File) =>
    request<{ created: number; updated: number; errors: { row: number; error: string }[] }>(
      '/roster/import',
      // Re-wrap so the content type is always text/csv regardless of how the
      // browser typed the chosen file.
      { method: 'POST', body: new Blob([csv], { type: 'text/csv' }) },
    ),

  importAttendanceCsv: (args: { file: File; meetingCode: string; title?: string }) => {
    const params = new URLSearchParams({ meetingCode: args.meetingCode });
    if (args.title) params.set('title', args.title);
    return request<CsvImportResult>(`/import/attendance?${params.toString()}`, {
      method: 'POST',
      body: new Blob([args.file], { type: 'text/csv' }),
    });
  },

  // Mappings
  listMappings: () => request<{ mappings: Mapping[] }>('/mappings'),
  createMapping: (body: { displayName?: string; email?: string | null; studentId: string }) =>
    request<{ mapping: Mapping }>('/mappings', { method: 'POST', body: JSON.stringify(body) }),
  deleteMapping: (id: string) => request<void>(`/mappings/${id}`, { method: 'DELETE' }),

  // Settings
  getSettings: () => request<AppSettings>('/settings'),
  updateSettings: (body: {
    provider?: string;
    simulatorSpeed?: number;
    lateThresholdMinutes?: number;
    minAttendancePct?: number;
  }) => request<AppSettings>('/settings', { method: 'PUT', body: JSON.stringify(body) }),

  exportCsvUrl: (sessionId: string) => `/api/sessions/${sessionId}/export.csv`,
};
