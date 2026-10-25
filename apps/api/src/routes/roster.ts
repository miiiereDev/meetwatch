import type { FastifyPluginAsync } from 'fastify';
import { parseCsv, pickColumn } from '../lib/csv.js';
import { createStudentSchema, updateStudentSchema, zodIssues } from './schemas.js';

export const rosterRoutes: FastifyPluginAsync = async (app) => {
  const { students, hub } = app.ctx;

  app.get('/roster', async () => {
    return { students: students.list() };
  });

  app.post('/roster', async (req, reply) => {
    const parsed = createStudentSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send(zodIssues(parsed.error));
    const existing = students.getByEmail(parsed.data.email);
    if (existing) {
      return reply.code(409).send({ error: 'a student with this email already exists' });
    }
    const student = students.create(parsed.data);
    hub.publish('refresh', { kind: 'roster' });
    return reply.code(201).send({ student });
  });

  app.patch('/roster/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = updateStudentSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send(zodIssues(parsed.error));
    const existing = students.get(id);
    if (!existing) return reply.code(404).send({ error: 'student not found' });
    const { name, email, section } = parsed.data;
    const updated = students.update(id, {
      name: name ?? existing.name,
      email: email ?? existing.email,
      section: section ?? existing.section,
    });
    hub.publish('refresh', { kind: 'roster' });
    return { student: updated };
  });

  app.delete('/roster/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const ok = students.delete(id);
    if (!ok) return reply.code(404).send({ error: 'student not found' });
    hub.publish('refresh', { kind: 'roster' });
    return reply.code(204).send();
  });

  /** Bulk import from a CSV file (raw text/csv body). Columns are tolerant. */
  app.post('/roster/import', async (req, reply) => {
    const body = req.body as string | undefined;
    if (typeof body !== 'string' || body.trim() === '') {
      return reply
        .code(400)
        .send({ error: 'send the CSV file as the request body with content-type text/csv' });
    }
    const { rows } = parseCsv(body);
    let created = 0;
    let updated = 0;
    const errors: { row: number; error: string }[] = [];

    rows.forEach((row, index) => {
      const name = pickColumn(row, ['Name', 'Full name', 'Student name', 'Student']);
      const email = pickColumn(row, ['Email', 'E-mail', 'Student email', 'Mail']);
      const section = pickColumn(row, ['Section', 'Class', 'Group']) ?? '';
      if (!name || !email) {
        errors.push({ row: index + 2, error: 'missing name or email' });
        return;
      }
      const parsed = createStudentSchema.safeParse({ name, email, section: section || undefined });
      if (!parsed.success) {
        errors.push({ row: index + 2, error: parsed.error.issues[0]?.message ?? 'invalid row' });
        return;
      }
      const before = students.getByEmail(parsed.data.email);
      students.upsert(parsed.data);
      if (before) updated += 1;
      else created += 1;
    });

    hub.publish('refresh', { kind: 'roster' });
    return { created, updated, errors, total: rows.length };
  });
};
