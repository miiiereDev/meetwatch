import type { FastifyPluginAsync } from 'fastify';

/**
 * Google OAuth flow for the Meet integration:
 *   GET /api/google/auth-url   → { url } for the Settings "Connect" button
 *   GET /api/google/callback   → Google redirects here after consent
 *
 * The refresh token lands in the settings table; the provider picks it up
 * on its next start (switch the provider off and back on, or restart).
 */
export const googleRoutes: FastifyPluginAsync = async (app) => {
  const { env, googleAuth, hub, runner, settings } = app.ctx;

  app.get('/google/auth-url', async (_req, reply) => {
    if (!googleAuth.configured()) {
      return reply.code(503).send({
        error:
          'Google OAuth is not configured — set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET (docs/GOOGLE_SETUP.md)',
      });
    }
    return { url: googleAuth.authUrl() };
  });

  app.get('/google/callback', async (req, reply) => {
    const query = req.query as { code?: string; error?: string };
    const webOrigin = env.WEB_ORIGIN;

    if (query.error) {
      return reply.redirect(`${webOrigin}/settings?google=denied`);
    }
    if (!query.code) {
      return reply.redirect(`${webOrigin}/settings?google=missing_code`);
    }

    try {
      await googleAuth.exchangeCode(query.code);
      settings.set('google_connected_at', new Date().toISOString());
      // Restart the google provider (if active) so it sees the new token.
      if (runner.currentName() === 'google') {
        await runner.switchTo('google');
      }
      hub.publish('provider', { name: 'google', status: runner.status() });
      return reply.redirect(`${webOrigin}/settings?google=connected`);
    } catch (err) {
      app.log.error({ err }, 'google: token exchange failed');
      return reply.redirect(`${webOrigin}/settings?google=exchange_failed`);
    }
  });
};
