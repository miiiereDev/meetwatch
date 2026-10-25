import { describe, it, expect, afterEach } from 'vitest';
import { createApp } from '../src/app.js';
import { createTempDb, type TempDb } from './helpers/tempDb.js';

const dbs: TempDb[] = [];
const apps: { close(): Promise<void> }[] = [];
afterEach(async () => {
  while (apps.length) await apps.pop()?.close();
  while (dbs.length) dbs.pop()?.cleanup();
});

async function testApp() {
  const t = createTempDb();
  dbs.push(t);
  const app = await createApp({
    quiet: true,
    dbFile: t.file,
    envOverrides: { PROVIDER: 'simulator' },
  });
  apps.push(app);
  return app;
}

function futureIso(minutesFromNow: number): string {
  return new Date(Date.now() + minutesFromNow * 60_000).toISOString();
}

async function createSessionWithUnknown(app: Awaited<ReturnType<typeof testApp>>) {
  const created = await app.inject({
    method: 'POST',
    url: '/api/sessions',
    payload: {
      title: 'Matching',
      meetingCode: 'match-001',
      startsAt: futureIso(-10),
      endsAt: futureIso(35),
    },
  });
  const session = created.json().session;
  // An unknown guest joins the call (no matching roster entry).
  app.ctx.ingest.ingestEvent({
    meetingCode: 'match-001',
    studentEmail: null,
    displayName: 'Android User 4242',
    joinedAt: futureIso(-5),
    leftAt: null,
    source: 'simulator',
  });
  return session;
}

describe('mappings API', () => {
  it('lists mappings with student names', async () => {
    const app = await testApp();
    const roster = (await app.inject({ method: 'GET', url: '/api/roster' })).json().students;
    const ava = roster.find((s: { name: string }) => s.name === 'Ava Thompson');
    await app.inject({
      method: 'POST',
      url: '/api/mappings',
      payload: { displayName: 'Android User 4242', studentId: ava.id },
    });
    const res = await app.inject({ method: 'GET', url: '/api/mappings' });
    expect(res.statusCode).toBe(200);
    const mappings = res.json().mappings;
    expect(mappings).toHaveLength(1);
    expect(mappings[0].rawKey).toBe('android user 4242');
    expect(mappings[0].studentName).toBe('Ava Thompson');
  });

  it('mapping an unknown participant folds them into the student status', async () => {
    const app = await testApp();
    const roster = (await app.inject({ method: 'GET', url: '/api/roster' })).json().students;
    const ava = roster.find((s: { name: string }) => s.name === 'Ava Thompson');
    const session = await createSessionWithUnknown(app);

    const before = (await app.inject({ method: 'GET', url: `/api/sessions/${session.id}` })).json()
      .report;
    expect(before.unknown).toHaveLength(1);
    expect(before.statuses.find((s: { name: string }) => s.name === 'Ava Thompson').status).toBe(
      'absent',
    );

    const mapped = await app.inject({
      method: 'POST',
      url: '/api/mappings',
      payload: { displayName: 'Android User 4242', studentId: ava.id },
    });
    expect(mapped.statusCode).toBe(201);

    const after = (await app.inject({ method: 'GET', url: `/api/sessions/${session.id}` })).json()
      .report;
    expect(after.unknown).toHaveLength(0);
    const avaAfter = after.statuses.find((s: { name: string }) => s.name === 'Ava Thompson');
    expect(avaAfter.status).toBe('online');
    expect(avaAfter.matchedVia).toBe('mapping-name');
  });

  it('derives the key from an email when provided', async () => {
    const app = await testApp();
    const roster = (await app.inject({ method: 'GET', url: '/api/roster' })).json().students;
    const res = await app.inject({
      method: 'POST',
      url: '/api/mappings',
      payload: { email: 'Ava.T@gmail.com', studentId: roster[0].id },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().mapping.rawKey).toBe('ava.t@gmail.com');
  });

  it('rejects unknown students and deletes mappings', async () => {
    const app = await testApp();
    const bad = await app.inject({
      method: 'POST',
      url: '/api/mappings',
      payload: { displayName: 'X', studentId: 'missing' },
    });
    expect(bad.statusCode).toBe(400);

    const empty = await app.inject({ method: 'POST', url: '/api/mappings', payload: {} });
    expect(empty.statusCode).toBe(400);

    const roster = (await app.inject({ method: 'GET', url: '/api/roster' })).json().students;
    const created = await app.inject({
      method: 'POST',
      url: '/api/mappings',
      payload: { displayName: 'Someone', studentId: roster[0].id },
    });
    const id = created.json().mapping.id;
    const del = await app.inject({ method: 'DELETE', url: `/api/mappings/${id}` });
    expect(del.statusCode).toBe(204);
    expect(
      (await app.inject({ method: 'GET', url: '/api/mappings' })).json().mappings,
    ).toHaveLength(0);
  });
});
