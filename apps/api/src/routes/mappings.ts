import type { FastifyPluginAsync } from 'fastify';
import { participantRawKey } from '../domain/matching.js';
import { createMappingSchema, zodIssues } from './schemas.js';

export const mappingRoutes: FastifyPluginAsync = async (app) => {
  const { mappings, students, hub } = app.ctx;

  app.get('/mappings', async () => {
    const all = mappings.list();
    return {
      mappings: all.map((m) => ({
        ...m,
        studentName: students.get(m.studentId)?.name ?? null,
      })),
    };
  });

  /** Persists a manual participant → student mapping (Unknown participants panel). */
  app.post('/mappings', async (req, reply) => {
    const parsed = createMappingSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send(zodIssues(parsed.error));
    const body = parsed.data;

    const student = students.get(body.studentId);
    if (!student) return reply.code(400).send({ error: 'unknown studentId' });

    const rawKey =
      body.rawKey ??
      participantRawKey({
        email: body.email ?? null,
        displayName: body.displayName ?? body.email ?? '',
      });
    if (!rawKey) return reply.code(400).send({ error: 'cannot derive a mapping key' });

    const mapping = mappings.upsert({
      rawKey,
      rawName: body.displayName ?? body.email ?? rawKey,
      rawEmail: body.email ?? null,
      studentId: student.id,
    });
    hub.publish('refresh', { kind: 'statuses' });
    return reply.code(201).send({ mapping });
  });

  app.delete('/mappings/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const ok = mappings.delete(id);
    if (!ok) return reply.code(404).send({ error: 'mapping not found' });
    hub.publish('refresh', { kind: 'statuses' });
    return reply.code(204).send();
  });
};
