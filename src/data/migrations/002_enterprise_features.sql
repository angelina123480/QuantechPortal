-- QuanTech Support Portal — enterprise ITSM feature set.
-- Additive to 001_init.sql (never edit an already-applied migration).
-- migrate.js re-runs every .sql file on each invocation, so every
-- statement here must be safe to execute more than once.

-- One-time transition: the pre-enterprise schema had free-text company
-- values with no `companies` table to reference. This migration adds a
-- companies table + FK, and the project's own call was a full reset/reseed
-- (see scripts/seed.js) rather than backfilling old rows. Clear the old
-- incompatible data once, guarded so this is a no-op on every subsequent
-- `npm run migrate` once fk_users_company exists.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_users_company') THEN
    TRUNCATE TABLE ticket_history, attachments, tickets, users, articles CASCADE;
  END IF;
END $$;

-- ---------- Departments & Teams ----------
CREATE TABLE IF NOT EXISTS departments (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS teams (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  department_id TEXT NOT NULL REFERENCES departments(id),
  lead_user_id TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_teams_department ON teams(department_id);

-- ---------- Companies ----------
CREATE TABLE IF NOT EXISTS companies (
  name TEXT PRIMARY KEY,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  industry TEXT,
  team_id TEXT REFERENCES teams(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- Categories & Subcategories ----------
CREATE TABLE IF NOT EXISTS categories (
  name TEXT PRIMARY KEY,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS subcategories (
  id TEXT PRIMARY KEY,
  category_name TEXT NOT NULL REFERENCES categories(name) ON DELETE CASCADE,
  name TEXT NOT NULL,
  UNIQUE(category_name, name)
);
CREATE INDEX IF NOT EXISTS idx_subcategories_category ON subcategories(category_name);

-- ---------- users: org structure, activation, 2FA ----------
ALTER TABLE users ADD COLUMN IF NOT EXISTS team_id TEXT REFERENCES teams(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_secret TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_users_team ON users(team_id);

DO $$ BEGIN
  ALTER TABLE users ADD CONSTRAINT fk_users_company FOREIGN KEY (company) REFERENCES companies(name);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------- tickets: rename client-side department, add team/category/SLA columns ----------
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets' AND column_name = 'department')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets' AND column_name = 'client_department') THEN
    ALTER TABLE tickets RENAME COLUMN department TO client_department;
  END IF;
END $$;

ALTER TABLE tickets ADD COLUMN IF NOT EXISTS team_id TEXT REFERENCES teams(id);
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS subcategory_id TEXT REFERENCES subcategories(id);
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS first_response_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_tickets_team ON tickets(team_id);

DO $$ BEGIN
  ALTER TABLE tickets ADD CONSTRAINT fk_tickets_company FOREIGN KEY (company) REFERENCES companies(name);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE tickets ADD CONSTRAINT fk_tickets_category FOREIGN KEY (category) REFERENCES categories(name);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------- attachments: uploader + internal visibility ----------
ALTER TABLE attachments ADD COLUMN IF NOT EXISTS uploaded_by TEXT REFERENCES users(id);
ALTER TABLE attachments ADD COLUMN IF NOT EXISTS internal BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_attachments_ticket ON attachments(ticket_id);

-- ---------- articles (knowledge base): publishing workflow ----------
ALTER TABLE articles ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'published';
ALTER TABLE articles ADD COLUMN IF NOT EXISTS author_id TEXT REFERENCES users(id);
ALTER TABLE articles ADD COLUMN IF NOT EXISTS view_count INTEGER NOT NULL DEFAULT 0;

DO $$ BEGIN
  ALTER TABLE articles ADD CONSTRAINT fk_articles_category FOREIGN KEY (category) REFERENCES categories(name);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------- Roles & permissions ----------
CREATE TABLE IF NOT EXISTS permissions (
  key TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  description TEXT
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role TEXT NOT NULL,
  permission_key TEXT NOT NULL REFERENCES permissions(key) ON DELETE CASCADE,
  PRIMARY KEY (role, permission_key)
);

-- ---------- SLA policies & system settings (business hours, etc.) ----------
CREATE TABLE IF NOT EXISTS sla_policies (
  priority TEXT PRIMARY KEY,
  response_minutes INTEGER NOT NULL,
  resolution_minutes INTEGER NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- SLA events & escalations ----------
CREATE TABLE IF NOT EXISTS sla_events (
  id TEXT PRIMARY KEY,
  ticket_id TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  meta JSONB
);
CREATE INDEX IF NOT EXISTS idx_sla_events_ticket ON sla_events(ticket_id);

CREATE TABLE IF NOT EXISTS escalations (
  id TEXT PRIMARY KEY,
  ticket_id TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  escalated_by TEXT REFERENCES users(id),
  escalated_to_team_id TEXT REFERENCES teams(id),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_escalations_ticket ON escalations(ticket_id);

-- ---------- Notifications ----------
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  ticket_id TEXT REFERENCES tickets(id) ON DELETE CASCADE,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);

-- ---------- Canned responses ----------
CREATE TABLE IF NOT EXISTS canned_responses (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  category TEXT,
  created_by TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- Ticket ratings (CSAT) ----------
CREATE TABLE IF NOT EXISTS ticket_ratings (
  id TEXT PRIMARY KEY,
  ticket_id TEXT NOT NULL UNIQUE REFERENCES tickets(id) ON DELETE CASCADE,
  client_user_id TEXT REFERENCES users(id),
  stars INTEGER NOT NULL CHECK (stars BETWEEN 1 AND 5),
  feedback TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- Audit logs ----------
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  user_name TEXT,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  before_value JSONB,
  after_value JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);

-- ---------- Ticket links (merge / duplicate / related) ----------
CREATE TABLE IF NOT EXISTS ticket_links (
  id TEXT PRIMARY KEY,
  ticket_id TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  linked_ticket_id TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  link_type TEXT NOT NULL,
  created_by TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ticket_links_ticket ON ticket_links(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_links_linked ON ticket_links(linked_ticket_id);

-- ---------- Assignment rules ----------
CREATE TABLE IF NOT EXISTS assignment_rules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT REFERENCES categories(name),
  priority TEXT,
  department_id TEXT REFERENCES departments(id),
  team_id TEXT REFERENCES teams(id),
  agent_id TEXT REFERENCES users(id),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- Password reset tokens ----------
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_password_reset_user ON password_reset_tokens(user_id);
