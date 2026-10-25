-- MeetWatch initial schema. Timestamps are ISO-8601 UTC strings; booleans are 0/1.

CREATE TABLE IF NOT EXISTS schema_migrations (
  id TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS students (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  section TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_students_section ON students(section);

CREATE TABLE IF NOT EXISTS class_sessions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  section TEXT NOT NULL DEFAULT '',
  meeting_code TEXT NOT NULL,
  starts_at TEXT NOT NULL,
  ends_at TEXT,
  late_threshold_minutes INTEGER NOT NULL DEFAULT 10,
  min_attendance_pct INTEGER NOT NULL DEFAULT 75,
  status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'active', 'ended')),
  time_scale REAL NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_starts_at ON class_sessions(starts_at);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON class_sessions(status);

-- One row per join/leave interval of a Meet participant inside a session.
-- An open interval (left_at IS NULL) means the participant is in the call now.
CREATE TABLE IF NOT EXISTS intervals (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES class_sessions(id) ON DELETE CASCADE,
  participant_key TEXT NOT NULL,
  email TEXT,
  display_name TEXT NOT NULL,
  joined_at TEXT NOT NULL,
  left_at TEXT,
  source TEXT NOT NULL DEFAULT 'unknown',
  created_at TEXT NOT NULL,
  UNIQUE (session_id, participant_key, joined_at)
);

CREATE INDEX IF NOT EXISTS idx_intervals_session ON intervals(session_id, joined_at);
CREATE INDEX IF NOT EXISTS idx_intervals_open ON intervals(session_id, left_at);

-- Manual participant → student mappings, keyed by a normalized raw identity
-- (email if available, else normalized display name).
CREATE TABLE IF NOT EXISTS mappings (
  id TEXT PRIMARY KEY,
  raw_key TEXT NOT NULL UNIQUE,
  raw_name TEXT NOT NULL,
  raw_email TEXT,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_mappings_student ON mappings(student_id);

-- Key/value store: provider choice, thresholds, simulator speed, Google tokens.
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
