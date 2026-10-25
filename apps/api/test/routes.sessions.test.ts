import { describe, it, expect, afterEach } from 'vitest';
import { createApp } from '../src/app.js';
import { createTempDb, type TempDb } from './helpers/tempDb.js';

const dbs: TempDb[] = [];
const apps: { close(): Promise<void> }[] = [];
afterEach(async () => {
  while (apps.length) await apps.pop()?.close();
  while (dbs.length) dbs.pop()?.cleanup();
});

async function testApp(envOverrides: Record<string, string> = {}) {
  const t = createTempDb();
  dbs.push(t);
  const app = await createApp({
    quiet: true,
    dbFile: t.file,
    envOverrides: { PROVIDER: 'simulator', ...envOverrides },
  });
  apps.push(app);
  return app;
}

function futureIso(minutesFromNow: number): string {
  return new Date(Date.now() + minutesFromNow * 60_000).toISOString();
}

describe('sessions API', () => {
  it('creates, lists, and fetches a session with a live report', async () => {
    const app = await testApp();

    const created = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      payload: {
        title: 'Chemistry',
        meetingCode: 'chem-lab-001',
        startsAt: futureIso(-5),
        endsAt: futureIso(40),
      },
    });
    expect(created.statusCode).toBe(201);
    const { session } = created.json();
    expect(session.meetingCode).toBe('chem-lab-001');
    expect(session.lateThresholdMinutes).toBe(10);
    expect(session.minAttendancePct).toBe(75);

    const list = await app.inject({ method: 'GET', url: '/api/sessions' });
    expect(list.statusCode).toBe(200);
    const items = list.json().sessions;
    expect(items.length).toBeGreaterThanOrEqual(4);
    expect(items[0]).toHaveProperty('summary');
    expect(items[0]).toHaveProperty('effectiveNow');

    const detail = await app.inject({ method: 'GET', url: `/api/sessions/${session.id}` });
    expect(detail.statusCode).toBe(200);
    const body = detail.json();
    expect(body.session.id).toBe(session.id);
    expect(body.report.statuses).toHaveLength(25);
    expect(body.report.summary.total).toBe(25);
    expect(Array.isArray(body.report.activity)).toBe(true);
    expect(Array.isArray(body.report.unknown)).toBe(true);
  });

  it('rejects invalid payloads with 400 and structured issues', async () => {
    const app = await testApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      payload: { meetingCode: 'BAD CODE!', startsAt: 'not-a-date' },
    });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error).toBe('validation failed');
    expect(body.issues.length).toBeGreaterThanOrEqual(2);
  });

  it('ends a session and reports 409 on repeat', async () => {
    const app = await testApp();
    const created = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      payload: {
        title: 'History',
        meetingCode: 'hist-2026',
        startsAt: futureIso(-30),
        endsAt: futureIso(30),
      },
    });
    const id = created.json().session.id;

    const ended = await app.inject({ method: 'POST', url: `/api/sessions/${id}/end` });
    expect(ended.statusCode).toBe(200);
    expect(ended.json().session.status).toBe('ended');

    const again = await app.inject({ method: 'POST', url: `/api/sessions/${id}/end` });
    expect(again.statusCode).toBe(409);
  });

  it('deletes a session with its intervals', async () => {
    const app = await testApp();
    const created = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      payload: { meetingCode: 'del-001', startsAt: futureIso(1), endsAt: futureIso(46) },
    });
    const id = created.json().session.id;
    const res = await app.inject({ method: 'DELETE', url: `/api/sessions/${id}` });
    expect(res.statusCode).toBe(204);
    const check = await app.inject({ method: 'GET', url: `/api/sessions/${id}` });
    expect(check.statusCode).toBe(404);
  });

  it('exports attendance as CSV with roster rows', async () => {
    const app = await testApp();
    const created = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      payload: {
        title: 'Physics',
        meetingCode: 'phys-2026',
        startsAt: futureIso(-10),
        endsAt: futureIso(35),
      },
    });
    const id = created.json().session.id;

    const res = await app.inject({ method: 'GET', url: `/api/sessions/${id}/export.csv` });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toContain('attachment');
    const text = res.body;
    expect(text).toContain('Name,Email,Section,Status');
    expect(text).toContain('Ava Thompson');
    expect(text).toContain('ABSENT');
    expect(text).toContain('Attendance %');
  });

  it('returns 404 for unknown sessions', async () => {
    const app = await testApp();
    const res = await app.inject({ method: 'GET', url: '/api/sessions/nope' });
    expect(res.statusCode).toBe(404);
  });
});
