import { randomUUID } from 'node:crypto';
import type { DB } from '../db/client.js';
import type { Mapping } from '../domain/types.js';

interface MappingRow {
  id: string;
  raw_key: string;
  raw_name: string;
  raw_email: string | null;
  student_id: string;
  created_at: string;
}

function toMapping(row: MappingRow): Mapping {
  return {
    id: row.id,
    rawKey: row.raw_key,
    rawName: row.raw_name,
    rawEmail: row.raw_email,
    studentId: row.student_id,
    createdAt: row.created_at,
  };
}

export interface UpsertMappingInput {
  rawKey: string;
  rawName: string;
  rawEmail?: string | null;
  studentId: string;
}

export class MappingRepo {
  constructor(private readonly db: DB) {}

  list(): Mapping[] {
    const rows = this.db.prepare('SELECT * FROM mappings ORDER BY raw_key').all() as MappingRow[];
    return rows.map(toMapping);
  }

  listByStudent(studentId: string): Mapping[] {
    const rows = this.db
      .prepare('SELECT * FROM mappings WHERE student_id = ? ORDER BY raw_key')
      .all(studentId) as MappingRow[];
    return rows.map(toMapping);
  }

  getByKey(rawKey: string): Mapping | null {
    const row = this.db.prepare('SELECT * FROM mappings WHERE raw_key = ?').get(rawKey) as
      MappingRow | undefined;
    return row ? toMapping(row) : null;
  }

  /** Creates the mapping or repoints an existing raw identity to a new student. */
  upsert(input: UpsertMappingInput): Mapping {
    const existing = this.getByKey(input.rawKey);
    if (existing) {
      this.db
        .prepare('UPDATE mappings SET raw_name = ?, raw_email = ?, student_id = ? WHERE id = ?')
        .run(input.rawName, input.rawEmail ?? null, input.studentId, existing.id);
      return {
        ...existing,
        rawName: input.rawName,
        rawEmail: input.rawEmail ?? null,
        studentId: input.studentId,
      };
    }
    const mapping: Mapping = {
      id: randomUUID(),
      rawKey: input.rawKey,
      rawName: input.rawName,
      rawEmail: input.rawEmail ?? null,
      studentId: input.studentId,
      createdAt: new Date().toISOString(),
    };
    this.db
      .prepare(
        'INSERT INTO mappings (id, raw_key, raw_name, raw_email, student_id, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .run(
        mapping.id,
        mapping.rawKey,
        mapping.rawName,
        mapping.rawEmail,
        mapping.studentId,
        mapping.createdAt,
      );
    return mapping;
  }

  delete(id: string): boolean {
    const info = this.db.prepare('DELETE FROM mappings WHERE id = ?').run(id);
    return info.changes > 0;
  }

  deleteByKey(rawKey: string): boolean {
    const info = this.db.prepare('DELETE FROM mappings WHERE raw_key = ?').run(rawKey);
    return info.changes > 0;
  }
}
