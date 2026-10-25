import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { createTempDb, type TempDb } from './helpers/tempDb.js';

const dbs: TempDb[] = [];
const apps: { close(): Promise<void> }[] = [];
afterEach(async () => {
  while (apps.length) await apps.pop()?.close();
  while (dbs.length) dbs.pop()?.cleanup();
  vi.unstubAllGlobals();
});

async function app(overrides: Record<string, string> = {}) {
  const t = createTempDb();
  dbs.push(t);
  const a = await createApp({
    quiet: true,
    dbFile: t.file,
    envOverrides: { PROVIDER: 'simulator', ...overrides },
  });
  apps.push(a);
  return a;
}

describe('google oauth routes', () => {
  it('refuses to hand out an auth url when unconfigured', async () => {
    const a = await app({ GOOGLE_CLIENT_ID: '', GOOGLE_CLIENT_SECRET: '' });
    const res = await a.inject({ method: 'GET', url: '/api/google/auth-url' });
    expect(res.statusCode).toBe(503);
    expect(res.json().error).toMatch(/not configured/);
  });

  it('returns the consent url when configured', async () => {
    const a = await app({
      GOOGLE_CLIENT_ID: 'cid',
      GOOGLE_CLIENT_SECRET: 'secret',
    });
    const res = await a.inject({ method: 'GET', url: '/api/google/auth-url' });
    expect(res.statusCode).toBe(200);
    expect(res.json().url).toContain('accounts.google.com/o/oauth2/v2/auth');
  });

  it('redirects consent denial back to the web app', async () => {
    const a = await app({ GOOGLE_CLIENT_ID: 'cid', GOOGLE_CLIENT_SECRET: 'secret' });
    const res = await a.inject({ method: 'GET', url: '/api/google/callback?error=access_denied' });
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toContain('/settings?google=denied');
  });

  it('exchanges the callback code, stores tokens, and reports connected', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({ access_token: 'at', refresh_token: 'rt', expires_in: 3600 }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          ),
      ),
    );
    const a = await app({
      GOOGLE_CLIENT_ID: 'cid',
      GOOGLE_CLIENT_SECRET: 'secret',
      WEB_ORIGIN: 'http://localhost:5173',
    });
    const res = await a.inject({ method: 'GET', url: '/api/google/callback?code=abc' });
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe('http://localhost:5173/settings?google=connected');

    const settings = await a.inject({ method: 'GET', url: '/api/settings' });
    expect(settings.json().google.connected).toBe(true);
  });

  it('redirects to an error marker when the exchange fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: 'invalid_grant', error_description: 'bad code' }), {
            status: 400,
            headers: { 'content-type': 'application/json' },
          }),
      ),
    );
    const a = await app({ GOOGLE_CLIENT_ID: 'cid', GOOGLE_CLIENT_SECRET: 'secret' });
    const res = await a.inject({ method: 'GET', url: '/api/google/callback?code=abc' });
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toContain('?google=exchange_failed');
  });
});
