import type { FastifyPluginAsync } from 'fastify';
import { updateSettingsSchema, zodIssues } from './schemas.js';

const SPEED_KEY = 'simulator_speed';
const LATE_KEY = 'late_threshold_minutes';
const ATT_KEY = 'min_attendance_pct';

export const settingsRoutes: FastifyPluginAsync = async (app) => {
  const { settings, env, runner, hub } = app.ctx;

  function buildSettingsResponse() {
    return {
      provider: runner.currentName() ?? settings.get('provider') ?? env.PROVIDER,
      providerStatus: runner.status(),
      simulatorSpeed: Number(settings.get(SPEED_KEY) ?? '') || env.SIMULATOR_SPEED,
      lateThresholdMinutes: Number(settings.get(LATE_KEY) ?? '') || env.LATE_THRESHOLD_MINUTES,
      minAttendancePct: Number(settings.get(ATT_KEY) ?? '') || env.MIN_ATTENDANCE_PCT,
      google: {
        configured: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
        connected: Boolean(settings.get('google_refresh_token')),
      },
    };
  }

  app.get('/settings', async () => buildSettingsResponse());

  app.put('/settings', async (req, reply) => {
    const parsed = updateSettingsSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send(zodIssues(parsed.error));
    const body = parsed.data;

    if (body.simulatorSpeed !== undefined) settings.set(SPEED_KEY, String(body.simulatorSpeed));
    if (body.lateThresholdMinutes !== undefined)
      settings.set(LATE_KEY, String(body.lateThresholdMinutes));
    if (body.minAttendancePct !== undefined) settings.set(ATT_KEY, String(body.minAttendancePct));

    if (body.provider !== undefined && body.provider !== runner.currentName()) {
      settings.set('provider', body.provider);
      await runner.switchTo(body.provider);
    }

    const response = buildSettingsResponse();
    hub.publish('provider', { name: response.provider, status: response.providerStatus });
    return response;
  });
};
