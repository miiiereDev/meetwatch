import type { FastifyPluginAsync } from 'fastify';
import { sessionEffectiveNow } from '../domain/status.js';
import { buildAttendanceCsv } from '../lib/exportCsv.js';
import { createSessionSchema, zodIssues } from './schemas.js';

export const sessionRoutes: FastifyPluginAsync = async (app) => {
  const { sessions, intervals, settings, ingest, env } = app.ctx;

  app.get('/sessions', async () => {
    const wall = Date.now();
    return {
      sessions: sessions.list().map((session) => {
        const report = app.ctx.report(session, wall);
        return {
          ...session,
          effectiveNow: report.now,
          summary: report.summary,
        };
      }),
    };
  });

  app.post('/sessions', async (req, reply) => {
    const parsed = createSessionSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send(zodIssues(parsed.error));
    }
    const body = parsed.data;
    const defaults = {
      lateThresholdMinutes:
        Number(settings.get('late_threshold_minutes') ?? '') || env.LATE_THRESHOLD_MINUTES,
      minAttendancePct: Number(settings.get('min_attendance_pct') ?? '') || env.MIN_ATTENDANCE_PCT,
    };
    const timeScale =
      app.ctx.runner.currentName() === 'simulator'
        ? Number(settings.get('simulator_speed') ?? '') || env.SIMULATOR_SPEED
        : 1;

    const session = sessions.create({
      title: body.title,
      section: body.section,
      meetingCode: body.meetingCode,
      startsAt: body.startsAt,
      endsAt: body.endsAt ?? null,
      lateThresholdMinutes: body.lateThresholdMinutes ?? defaults.lateThresholdMinutes,
      minAttendancePct: body.minAttendancePct ?? defaults.minAttendancePct,
      timeScale,
    });
    app.ctx.hub.publish('sessions', { sessionId: session.id, reason: 'created' });
    return reply.code(201).send({ session });
  });

  app.get('/sessions/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const session = sessions.get(id);
    if (!session) return reply.code(404).send({ error: 'session not found' });
    const report = app.ctx.report(session, Date.now());
    return { session, report };
  });

  app.get('/sessions/:id/activity', async (req, reply) => {
    const { id } = req.params as { id: string };
    const session = sessions.get(id);
    if (!session) return reply.code(404).send({ error: 'session not found' });
    const report = app.ctx.report(session, Date.now());
    return { sessionId: id, activity: report.activity, now: report.now };
  });

  app.post('/sessions/:id/end', async (req, reply) => {
    const { id } = req.params as { id: string };
    const session = sessions.get(id);
    if (!session) return reply.code(404).send({ error: 'session not found' });
    if (session.status === 'ended') {
      return reply.code(409).send({ error: 'session already ended' });
    }
    const endedAt = session.endsAt ?? new Date().toISOString();
    ingest.closeSession(id, endedAt);
    return { session: sessions.get(id) };
  });

  app.delete('/sessions/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const session = sessions.get(id);
    if (!session) return reply.code(404).send({ error: 'session not found' });
    intervals.deleteBySession(id);
    sessions.delete(id);
    app.ctx.hub.publish('sessions', { sessionId: id, reason: 'deleted' });
    return reply.code(204).send();
  });

  app.get('/sessions/:id/export.csv', async (req, reply) => {
    const { id } = req.params as { id: string };
    const session = sessions.get(id);
    if (!session) return reply.code(404).send({ error: 'session not found' });
    const report = app.ctx.report(session, sessionEffectiveNow(session, Date.now()).getTime());
    const csv = buildAttendanceCsv(session.title || session.meetingCode, report);
    reply
      .type('text/csv; charset=utf-8')
      .header(
        'content-disposition',
        `attachment; filename="meetwatch-attendance-${id.slice(0, 8)}.csv"`,
      );
    return csv;
  });
};
