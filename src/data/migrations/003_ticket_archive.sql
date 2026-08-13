-- Manual ticket archiving. Additive to 002_enterprise_features.sql (never edit
-- an already-applied migration). migrate.js re-runs every .sql file on each
-- invocation, so every statement here must be safe to execute more than once.

ALTER TABLE tickets ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS archived_by TEXT REFERENCES users(id);
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS archive_reason TEXT;
-- Only 'manual' is produced today; 'automatic' is reserved for a future
-- scheduled-job phase so no further migration is needed to introduce it.
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS archive_type TEXT;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS restored_at TIMESTAMPTZ;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS restored_by TEXT REFERENCES users(id);

CREATE INDEX IF NOT EXISTS idx_tickets_archived ON tickets(is_archived, updated_at DESC);
