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
    startRunner: true,
  });
  apps.push(app);
  return app;
}

describe('settings API', () => {
  it('returns defaults derived from env', async () => {
    const app = await testApp({ SIMULATOR_SPEED: '30', LATE_THRESHOLD_MINUTES: '5' });
    const res = await app.inject({ method: 'GET', url: '/api/settings' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      provider: 'simulator',
      simulatorSpeed: 30,
      lateThresholdMinutes: 5,
      minAttendancePct: 75,
      google: { configured: false, connected: false },
    });
    expect(res.json().providerStatus.state).toBe('running');
  });

  it('persists threshold and speed changes', async () => {
    const app = await testApp();
    const put = await app.inject({
      method: 'PUT',
      url: '/api/settings',
      payload: { lateThresholdMinutes: 15, minAttendancePct: 60, simulatorSpeed: 40 },
    });
    expect(put.statusCode).toBe(200);
    expect(put.json()).toMatchObject({
      lateThresholdMinutes: 15,
      minAttendancePct: 60,
      simulatorSpeed: 40,
    });

    // New sessions pick up the new defaults.
    const created = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      payload: {
        meetingCode: 'sett-001',
        startsAt: new Date(Date.now() + 60_000).toISOString(),
      },
    });
    expect(created.json().session.lateThresholdMinutes).toBe(15);
    expect(created.json().session.minAttendancePct).toBe(60);
    expect(created.json().session.timeScale).toBe(40);
  });

  it('switches providers: csv waits idle, unconfigured google errors', async () => {
    const app = await testApp();
    const switched = await app.inject({
      method: 'PUT',
      url: '/api/settings',
      payload: { provider: 'csv' },
    });
    expect(switched.statusCode).toBe(200);
    expect(switched.json().provider).toBe('csv');
    // The csv provider starts fine; it waits for an upload.
    expect(switched.json().providerStatus.state).toBe('idle');

    const google = await app.inject({
      method: 'PUT',
      url: '/api/settings',
      payload: { provider: 'google' },
    });
    expect(google.json().provider).toBe('google');
    expect(google.json().providerStatus.state).toBe('error');

    const back = await app.inject({
      method: 'PUT',
      url: '/api/settings',
      payload: { provider: 'simulator' },
    });
    expect(back.json().provider).toBe('simulator');
    expect(back.json().providerStatus.state).toBe('running');
  });

  it('rejects invalid settings payloads', async () => {
    const app = await testApp();
    const res = await app.inject({
      method: 'PUT',
      url: '/api/settings',
      payload: { provider: 'teams', simulatorSpeed: 0 },
    });
    expect(res.statusCode).toBe(400);
  });

  it('marks google as configured when credentials exist', async () => {
    const app = await testApp({
      GOOGLE_CLIENT_ID: 'client-id',
      GOOGLE_CLIENT_SECRET: 'client-secret',
    });
    const res = await app.inject({ method: 'GET', url: '/api/settings' });
    expect(res.json().google.configured).toBe(true);
  });
});
