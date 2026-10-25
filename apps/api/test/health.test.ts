import { describe, it, expect, afterAll } from 'vitest';
import { createApp } from '../src/app.js';

const app = await createApp({ quiet: true });
afterAll(async () => {
  await app.close();
});

describe('GET /api/health', () => {
  it('returns 200 with an ok status', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('ok');
    expect(typeof body.time).toBe('string');
  });
});
