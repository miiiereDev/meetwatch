import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { createTempDb, type TempDb } from './helpers/tempDb.js';

const dbs: TempDb[] = [];
const apps: { close(): Promise<void> }[] = [];
afterEach(async () => {
  while (apps.length) await apps.pop()?.close();
  while (dbs.length) dbs.pop()?.cleanup();
});

function csvApp() {
  const t = createTempDb();
  dbs.push(t);
  return createApp({
    quiet: true,
    dbFile: t.file,
    envOverrides: { PROVIDER: 'csv' },
    startRunner: true,
  }).then((app) => {
    apps.push(app);
    return app;
  });
}

function simApp() {
  const t = createTempDb();
  dbs.push(t);
  return createApp({
    quiet: true,
    dbFile: t.file,
    envOverrides: { PROVIDER: 'simulator' },
  }).then((app) => {
    apps.push(app);
    return app;
  });
}

const SAMPLE_CSV = [
  'Name,Time (first joined),Time (last left),Email,Participation length,ID (provider)',
  '"Ava Thompson","2026-05-04 09:00:00","2026-05-04 09:40:00",ava.thompson@student.myschool.edu,40m,',
  '"Liam Rivera","2026-05-04 09:12:00","2026-05-04 09:39:00",liam.rivera@student.myschool.edu,27m,',
  '"Noah Patel","2026-05-04 09:05:00",,noah.patel@student.myschool.edu,30m,',
  '"Mystery Guest","2026-05-04 09:10:00","2026-05-04 09:20:00",stranger@gmail.com,10m,',
  '"Broken Row","not a time","2026-05-04 09:20:00",x@y.z,10m,',
].join('\r\n');

describe('POST /api/import/attendance', () => {
  it('rejects a missing meeting code', async () => {
    const app = await csvApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/import/attendance',
      payload: SAMPLE_CSV,
      headers: { 'content-type': 'text/csv' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects an empty body', async () => {
    const app = await csvApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/import/attendance?meetingCode=abc-defg-hij',
      payload: '   ',
      headers: { 'content-type': 'text/csv' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('conflicts while another provider is active', async () => {
    const app = await simApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/import/attendance?meetingCode=abc-defg-hij',
      payload: SAMPLE_CSV,
      headers: { 'content-type': 'text/csv' },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toMatch(/switch the provider/);
  });

  it('imports a report into a completed session', async () => {
    const app = await csvApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/import/attendance?meetingCode=hist-bio-101&title=History%20import',
      payload: SAMPLE_CSV,
      headers: { 'content-type': 'text/csv' },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.createdSession).toBe(true);
    expect(body.errors).toEqual([{ row: 6, error: expect.stringMatching(/row 6/) }]);
    expect(body.ingested).toBeGreaterThanOrEqual(4);

    const detail = await app.inject({ method: 'GET', url: `/api/sessions/${body.sessionId}` });
    expect(detail.statusCode).toBe(200);
    const { session, report } = detail.json();
    expect(session.status).toBe('ended');
    expect(session.title).toBe('History import');
    expect(session.startsAt).toBe('2026-05-04T09:00:00.000Z');
    expect(session.endsAt).toBe('2026-05-04T09:40:00.000Z');

    // Three rows matched roster students; the guest stays unknown.
    const names = report.statuses.map((s: { name: string }) => s.name);
    expect(names).toContain('Ava Thompson');
    expect(names).toContain('Liam Rivera');
    expect(
      report.unknown.some((u: { displayName: string }) => u.displayName === 'Mystery Guest'),
    ).toBe(true);

    // Liam joined 12 minutes after the 09:00 start → flagged late.
    const liam = report.statuses.find((s: { name: string }) => s.name === 'Liam Rivera');
    expect(liam.late).toBe(true);

    // Noah had no leave time; participation length 30m closed his interval.
    const noah = report.statuses.find((s: { name: string }) => s.name === 'Noah Patel');
    expect(noah.status).toBe('left');
  });

  it('is idempotent when the same report is imported twice', async () => {
    const app = await csvApp();
    const post = () =>
      app.inject({
        method: 'POST',
        url: '/api/import/attendance?meetingCode=hist-bio-101',
        payload: SAMPLE_CSV,
        headers: { 'content-type': 'text/csv' },
      });
    const first = await post();
    expect(first.statusCode).toBe(201);
    const second = await post();
    expect(second.statusCode).toBe(201);
    expect(second.json().createdSession).toBe(false);

    const sessions = (await app.inject({ method: 'GET', url: '/api/sessions' })).json().sessions;
    expect(
      sessions.filter((s: { meetingCode: string }) => s.meetingCode === 'hist-bio-101'),
    ).toHaveLength(1);
    const report = (
      await app.inject({ method: 'GET', url: `/api/sessions/${sessions[0]!.id}` })
    ).json().report;
    // No duplicated intervals: each matched student keeps exactly one stint.
    const ava = report.statuses.find((s: { name: string }) => s.name === 'Ava Thompson');
    expect(ava.rejoinCount).toBe(0);
    expect(ava.attendancePct).toBe(100);
  });
});
