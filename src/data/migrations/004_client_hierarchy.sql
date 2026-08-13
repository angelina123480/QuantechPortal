-- Client hierarchy: sub-clients/end-clients beneath a company. Additive to
-- 002_enterprise_features.sql / 003_ticket_archive.sql (never edit an
-- already-applied migration). migrate.js re-runs every .sql file on each
-- invocation, so every statement here must be safe to execute more than once.

CREATE TABLE IF NOT EXISTS sub_clients (
  id TEXT PRIMARY KEY,
  parent_company TEXT NOT NULL REFERENCES companies(name),
  name TEXT NOT NULL,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(parent_company, name)
);
CREATE INDEX IF NOT EXISTS idx_sub_clients_company ON sub_clients(parent_company);

-- NULL means "scoped to the whole company" (every staff user, plus
-- client/client_admin); non-null means "scoped to just this branch"
-- (end_client_user, and tickets they create).
ALTER TABLE users ADD COLUMN IF NOT EXISTS sub_client_id TEXT REFERENCES sub_clients(id);
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS sub_client_id TEXT REFERENCES sub_clients(id);
CREATE INDEX IF NOT EXISTS idx_users_sub_client ON users(sub_client_id);
CREATE INDEX IF NOT EXISTS idx_tickets_sub_client ON tickets(sub_client_id);
