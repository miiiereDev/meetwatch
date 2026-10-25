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

const ROSTER_CSV = [
  'Full name,Mail,Class',
  'New Kid,new.kid@school.edu,11-C',
  'Ava Thompson,ava.thompson@student.myschool.edu,10-A',
  'Bad Row',
  ',no-email@school.edu,10-A',
].join('\r\n');

describe('roster API', () => {
  it('lists the seeded roster', async () => {
    const app = await testApp();
    const res = await app.inject({ method: 'GET', url: '/api/roster' });
    expect(res.statusCode).toBe(200);
    const students = res.json().students;
    expect(students).toHaveLength(25);
    expect(students[0]).toHaveProperty('section');
  });

  it('creates, patches, and deletes a student', async () => {
    const app = await testApp();
    const created = await app.inject({
      method: 'POST',
      url: '/api/roster',
      payload: { name: 'Temp Student', email: 'temp@school.edu', section: '10-Z' },
    });
    expect(created.statusCode).toBe(201);
    const id = created.json().student.id;

    const patched = await app.inject({
      method: 'PATCH',
      url: `/api/roster/${id}`,
      payload: { section: '10-Y' },
    });
    expect(patched.json().student.section).toBe('10-Y');
    expect(patched.json().student.name).toBe('Temp Student');

    const del = await app.inject({ method: 'DELETE', url: `/api/roster/${id}` });
    expect(del.statusCode).toBe(204);
    expect((await app.inject({ method: 'GET', url: '/api/roster' })).json().students).toHaveLength(
      25,
    );
  });

  it('rejects duplicate emails with 409 and invalid input with 400', async () => {
    const app = await testApp();
    const dup = await app.inject({
      method: 'POST',
      url: '/api/roster',
      payload: { name: 'Copy', email: 'AVA.THOMPSON@student.myschool.edu' },
    });
    expect(dup.statusCode).toBe(409);

    const bad = await app.inject({
      method: 'POST',
      url: '/api/roster',
      payload: { name: 'x', email: 'not-an-email' },
    });
    expect(bad.statusCode).toBe(400);
  });

  it('imports roster CSV with tolerant columns and reports row errors', async () => {
    const app = await testApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/roster/import',
      payload: ROSTER_CSV,
      headers: { 'content-type': 'text/csv' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.created).toBe(1);
    expect(body.updated).toBe(1);
    expect(body.errors).toHaveLength(2);

    const roster = (await app.inject({ method: 'GET', url: '/api/roster' })).json().students;
    expect(roster).toHaveLength(26);
    const ava = roster.find((s: { name: string }) => s.name === 'Ava Thompson');
    expect(ava.section).toBe('10-A');
    expect(roster.some((s: { name: string }) => s.name === 'New Kid')).toBe(true);
  });

  it('rejects empty CSV bodies', async () => {
    const app = await testApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/roster/import',
      payload: '',
      headers: { 'content-type': 'text/csv' },
    });
    expect(res.statusCode).toBe(400);
  });
});
