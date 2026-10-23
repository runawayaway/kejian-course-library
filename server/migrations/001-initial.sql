CREATE TABLE entries (
 id TEXT PRIMARY KEY, kind TEXT NOT NULL, course_id TEXT NOT NULL,
 data TEXT NOT NULL, owner_hash TEXT, version INTEGER NOT NULL DEFAULT 1,
 file_key TEXT, filename TEXT, size BIGINT NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX entries_course_idx ON entries(course_id);
CREATE TABLE revisions (
 id TEXT PRIMARY KEY, entry_id TEXT NOT NULL, version INTEGER NOT NULL,
 data TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE rate_limits (id TEXT PRIMARY KEY, count INTEGER NOT NULL DEFAULT 0);
