import { randomUUID } from 'node:crypto';
import type { DB } from '../db/client.js';
import type { Student } from '../domain/types.js';

interface StudentRow {
  id: string;
  name: string;
  email: string;
  section: string;
  created_at: string;
}

function toStudent(row: StudentRow): Student {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    section: row.section,
    createdAt: row.created_at,
  };
}

export interface UpsertStudentInput {
  name: string;
  email: string;
  section?: string;
}

export class StudentRepo {
  constructor(private readonly db: DB) {}

  list(): Student[] {
    const rows = this.db
      .prepare('SELECT * FROM students ORDER BY section, name')
      .all() as StudentRow[];
    return rows.map(toStudent);
  }

  get(id: string): Student | null {
    const row = this.db.prepare('SELECT * FROM students WHERE id = ?').get(id) as
      StudentRow | undefined;
    return row ? toStudent(row) : null;
  }

  getByEmail(email: string): Student | null {
    const row = this.db
      .prepare('SELECT * FROM students WHERE lower(email) = lower(?)')
      .get(email.trim()) as StudentRow | undefined;
    return row ? toStudent(row) : null;
  }

  count(): number {
    const row = this.db.prepare('SELECT COUNT(*) AS n FROM students').get() as { n: number };
    return row.n;
  }

  create(input: UpsertStudentInput): Student {
    const student: Student = {
      id: randomUUID(),
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      section: input.section?.trim() ?? '',
      createdAt: new Date().toISOString(),
    };
    this.db
      .prepare('INSERT INTO students (id, name, email, section, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(student.id, student.name, student.email, student.section, student.createdAt);
    return student;
  }

  /** Creates the student or updates name/section when the email already exists. */
  upsert(input: UpsertStudentInput): Student {
    const existing = this.getByEmail(input.email);
    if (!existing) return this.create(input);
    const name = input.name.trim() || existing.name;
    const section = input.section?.trim() || existing.section;
    this.db
      .prepare('UPDATE students SET name = ?, section = ? WHERE id = ?')
      .run(name, section, existing.id);
    return { ...existing, name, section };
  }

  delete(id: string): boolean {
    const info = this.db.prepare('DELETE FROM students WHERE id = ?').run(id);
    return info.changes > 0;
  }
}
