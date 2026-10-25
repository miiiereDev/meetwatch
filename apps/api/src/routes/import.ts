import type { FastifyPluginAsync } from 'fastify';
import { CsvImportProvider, type CsvAttendanceImporter } from '../providers/csvImport.js';

const MEETING_CODE_RE = /^[a-z0-9-]+$/i;

/**
 * Attendance import: a Google Meet attendance report POSTed as a raw
 * text/csv body. The active provider must support CSV import; the route
 * itself stays provider-agnostic through the capability interface.
 */
export const importRoutes: FastifyPluginAsync = async (app) => {
  app.post('/import/attendance', async (req, reply) => {
    const csv = typeof req.body === 'string' ? req.body : '';
    if (!csv.trim()) {
      return reply
        .code(400)
        .send({
          error: 'send the attendance report as the request body with content-type text/csv',
        });
    }

    const query = req.query as {
      meetingCode?: string;
      title?: string;
      section?: string;
    };
    const meetingCode = query.meetingCode?.trim();
    if (!meetingCode || !MEETING_CODE_RE.test(meetingCode)) {
      return reply
        .code(400)
        .send({ error: 'a meetingCode query parameter (letters, digits, dashes) is required' });
    }

    const provider = app.ctx.runner.active();
    const importer: CsvAttendanceImporter | null =
      provider instanceof CsvImportProvider ? provider : null;
    if (!importer) {
      return reply.code(409).send({
        error:
          "the active provider cannot import CSVs — switch the provider to 'csv' in Settings first",
      });
    }

    try {
      const result = importer.importAttendance(csv, {
        meetingCode,
        title: query.title?.trim() || undefined,
        section: query.section?.trim() || undefined,
      });
      return reply.code(201).send(result);
    } catch (err) {
      return reply.code(422).send({
        error: err instanceof Error ? err.message : 'attendance import failed',
      });
    }
  });
};
