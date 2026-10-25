import { afterEach, describe, expect, it } from 'vitest';
import { GoogleAuthService } from '../src/services/googleAuth.js';
import { SettingRepo } from '../src/repositories/settings.js';
import { createTempDb, type TempDb } from './helpers/tempDb.js';
import { loadEnv, resetEnvCache, type Env } from '../src/env.js';

const dbs: TempDb[] = [];
afterEach(() => {
  while (dbs.length) dbs.pop()?.cleanup();
  resetEnvCache();
});

const CREDENTIALS = {
  PROVIDER: 'simulator',
  GOOGLE_CLIENT_ID: 'test-client-id',
  GOOGLE_CLIENT_SECRET: 'test-client-secret',
  GOOGLE_REDIRECT_URI: 'http://localhost:4000/api/google/callback',
};

function env(overrides: Partial<Record<string, string>> = {}): Env {
  return loadEnv({ ...CREDENTIALS, ...overrides });
}

function service(fetchImpl: unknown, envOverrides: Partial<Record<string, string>> = {}) {
  const t = createTempDb();
  dbs.push(t);
  const settings = new SettingRepo(t.db);
  const auth = new GoogleAuthService(env(envOverrides), settings, fetchImpl as typeof fetch);
  return { settings, auth };
}

describe('GoogleAuthService', () => {
  it('reports unconfigured when credentials are missing', () => {
    const { auth } = service(undefined, { GOOGLE_CLIENT_ID: '', GOOGLE_CLIENT_SECRET: '' });
    expect(auth.configured()).toBe(false);
    expect(() => auth.authUrl()).toThrow(/not configured/);
  });

  it('builds a consent URL with the Meet read-only scopes', () => {
    const { auth } = service(undefined);
    const url = new URL(auth.authUrl());
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(url.searchParams.get('client_id')).toBe('test-client-id');
    expect(url.searchParams.get('redirect_uri')).toBe('http://localhost:4000/api/google/callback');
    expect(url.searchParams.get('access_type')).toBe('offline');
    expect(url.searchParams.get('scope')).toContain('meetings.space.readonly');
    expect(url.searchParams.get('scope')).toContain('conferenceRecords.readonly');
  });

  it('is not connected before the callback stores tokens', () => {
    const { auth } = service(undefined);
    expect(auth.connected()).toBe(false);
  });

  it('exchanges a callback code and stores both tokens', async () => {
    const calls: { url: string; body: URLSearchParams }[] = [];
    const { auth, settings } = service(async (url: string, init?: RequestInit) => {
      calls.push({ url: String(url), body: new URLSearchParams(init?.body as string) });
      return new Response(
        JSON.stringify({ access_token: 'at-1', refresh_token: 'rt-1', expires_in: 3600 }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    });

    await auth.exchangeCode('abc');
    expect(calls[0]?.body.get('grant_type')).toBe('authorization_code');
    expect(calls[0]?.body.get('code')).toBe('abc');
    expect(settings.get('google_refresh_token')).toBe('rt-1');
    expect(settings.get('google_access_token')).toBe('at-1');
    expect(auth.connected()).toBe(true);
    expect(await auth.getAccessToken()).toBe('at-1');
  });

  it('keeps the previous refresh token when the response omits it', async () => {
    const { auth, settings } = service(async () => {
      return new Response(JSON.stringify({ access_token: 'at-2', expires_in: 3600 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });
    settings.set('google_refresh_token', 'rt-kept');
    await auth.exchangeCode('abc');
    expect(settings.get('google_refresh_token')).toBe('rt-kept');
  });

  it('refreshes an expired access token', async () => {
    const calls: { body: URLSearchParams }[] = [];
    const { auth, settings } = service(async (_url: string, init?: RequestInit) => {
      calls.push({ body: new URLSearchParams(init?.body as string) });
      return new Response(JSON.stringify({ access_token: 'at-fresh', expires_in: 3600 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });
    settings.set('google_refresh_token', 'rt-1');
    // Expired token stored an hour ago.
    settings.set('google_token_expiry', String(Date.now() - 3_600_000));
    settings.set('google_access_token', 'at-stale');

    const token = await auth.getAccessToken();
    expect(token).toBe('at-fresh');
    expect(calls[0]?.body.get('grant_type')).toBe('refresh_token');
    expect(calls[0]?.body.get('refresh_token')).toBe('rt-1');
  });

  it('propagates token endpoint failures', async () => {
    const { auth, settings } = service(async () => {
      return new Response(
        JSON.stringify({ error: 'invalid_grant', error_description: 'Token has been expired' }),
        { status: 400, headers: { 'content-type': 'application/json' } },
      );
    });
    settings.set('google_refresh_token', 'rt-1');
    await expect(auth.getAccessToken()).rejects.toThrow(/Token has been expired/);
  });

  it('throws when getting a token with no stored refresh token', async () => {
    const { auth } = service(undefined);
    await expect(auth.getAccessToken()).rejects.toThrow(/connect an account first/);
  });
});
