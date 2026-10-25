-- Per-session simulator clock offset (ms) relative to wall clock, updated by
-- the simulator while a session is playing at speed != 1. 0 for real-time
-- providers (google, csv).
ALTER TABLE class_sessions ADD COLUMN clock_offset_ms INTEGER NOT NULL DEFAULT 0;
