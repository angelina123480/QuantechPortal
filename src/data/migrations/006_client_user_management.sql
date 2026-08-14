-- Phase 4: Client & User Management. Additive to 005_projects.sql (never
-- edit an already-applied migration). migrate.js re-runs every .sql file on
-- each invocation, so every statement here must be safe to execute more than once.

ALTER TABLE companies ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE sub_clients ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

-- Company rename support: add ON UPDATE CASCADE to every FK referencing
-- companies(name), so `UPDATE companies SET name = $1 WHERE name = $2` is
-- all a rename needs — no app-level multi-table transaction (this app's
-- Neon driver has zero precedent for multi-statement transactions anywhere
-- in the codebase). Exact current constraint names confirmed directly
-- against the dev branch via pg_constraint before writing this — safe to
-- hardcode. DROP+ADD is naturally idempotent across repeated migrate.js runs.
ALTER TABLE users DROP CONSTRAINT IF EXISTS fk_users_company;
ALTER TABLE users ADD CONSTRAINT fk_users_company FOREIGN KEY (company) REFERENCES companies(name) ON UPDATE CASCADE;

ALTER TABLE tickets DROP CONSTRAINT IF EXISTS fk_tickets_company;
ALTER TABLE tickets ADD CONSTRAINT fk_tickets_company FOREIGN KEY (company) REFERENCES companies(name) ON UPDATE CASCADE;

ALTER TABLE sub_clients DROP CONSTRAINT IF EXISTS sub_clients_parent_company_fkey;
ALTER TABLE sub_clients ADD CONSTRAINT sub_clients_parent_company_fkey FOREIGN KEY (parent_company) REFERENCES companies(name) ON UPDATE CASCADE;

ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_company_fkey;
ALTER TABLE projects ADD CONSTRAINT projects_company_fkey FOREIGN KEY (company) REFERENCES companies(name) ON UPDATE CASCADE;

-- Invite flow reuses password_reset_tokens (no new token table/model).
ALTER TABLE password_reset_tokens ADD COLUMN IF NOT EXISTS purpose TEXT NOT NULL DEFAULT 'reset';

-- Display-only bookkeeping for the user-detail page ("Invited on <date>,
-- no login yet"). Nullable, never read by any access-control check.
ALTER TABLE users ADD COLUMN IF NOT EXISTS invited_at TIMESTAMPTZ;
