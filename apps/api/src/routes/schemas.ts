import { z } from 'zod';

export const isoDatetime = z
  .string()
  .refine((v) => !Number.isNaN(Date.parse(v)), 'must be an ISO-8601 datetime');

export const createSessionSchema = z.object({
  title: z.string().trim().max(200).optional(),
  section: z.string().trim().max(100).optional(),
  meetingCode: z
    .string()
    .trim()
    .min(3)
    .max(100)
    .regex(/^[a-z0-9-]+$/i, 'meeting codes may contain letters, digits and dashes'),
  startsAt: isoDatetime,
  endsAt: isoDatetime.nullish(),
  lateThresholdMinutes: z.number().int().min(0).max(240).optional(),
  minAttendancePct: z.number().int().min(0).max(100).optional(),
});
export type CreateSessionBody = z.infer<typeof createSessionSchema>;

export const createStudentSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(200),
  section: z.string().trim().max(100).optional(),
});
export type CreateStudentBody = z.infer<typeof createStudentSchema>;

export const updateStudentSchema = createStudentSchema.partial();
export type UpdateStudentBody = z.infer<typeof updateStudentSchema>;

export const createMappingSchema = z
  .object({
    rawKey: z.string().trim().min(1).max(200).optional(),
    displayName: z.string().trim().min(1).max(200).optional(),
    email: z.string().trim().max(200).nullish(),
    studentId: z.string().min(1),
  })
  .refine((v) => v.rawKey !== undefined || v.displayName !== undefined || v.email !== undefined, {
    message: 'one of rawKey, displayName or email is required',
  });
export type CreateMappingBody = z.infer<typeof createMappingSchema>;

export const updateSettingsSchema = z.object({
  provider: z.enum(['simulator', 'google', 'csv']).optional(),
  simulatorSpeed: z.number().min(1).max(600).optional(),
  lateThresholdMinutes: z.number().int().min(0).max(240).optional(),
  minAttendancePct: z.number().int().min(0).max(100).optional(),
});
export type UpdateSettingsBody = z.infer<typeof updateSettingsSchema>;

/** Formats a zod error into a flat 400 payload. */
export function zodIssues(error: z.ZodError): {
  error: string;
  issues: { path: string; message: string }[];
} {
  return {
    error: 'validation failed',
    issues: error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
  };
}
