-- QuanTech Support Portal — initial schema.
-- IDs are kept as plain TEXT (u1, t1, a1, ...) to match the ids the app has
-- always used, rather than introducing UUIDs/serials for this migration.

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL,
  company TEXT NOT NULL,
  department TEXT NOT NULL,
  title TEXT NOT NULL,
  phone TEXT,
  notification_prefs JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tickets (
  id TEXT PRIMARY KEY,
  ticket_number TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  priority TEXT NOT NULL,
  status TEXT NOT NULL,
  affected_service TEXT,
  company TEXT NOT NULL,
  department TEXT,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  client_user_id TEXT NOT NULL REFERENCES users(id),
  assigned_technician_id TEXT REFERENCES users(id),
  due_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_tickets_company ON tickets(company);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned_technician ON tickets(assigned_technician_id);

CREATE TABLE IF NOT EXISTS ticket_history (
  id TEXT PRIMARY KEY,
  ticket_id TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  author_id TEXT REFERENCES users(id),
  author_name TEXT NOT NULL,
  author_role TEXT NOT NULL,
  message TEXT,
  from_status TEXT,
  to_status TEXT,
  from_priority TEXT,
  to_priority TEXT,
  internal BOOLEAN NOT NULL DEFAULT FALSE,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ticket_history_ticket ON ticket_history(ticket_id);

CREATE TABLE IF NOT EXISTS attachments (
  filename TEXT PRIMARY KEY,
  ticket_id TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  original_name TEXT NOT NULL,
  size INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  url TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS articles (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  summary TEXT NOT NULL,
  body TEXT NOT NULL,
  tags TEXT[] NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Continues QuanTech's ticket numbering from where the in-memory prototype
-- left off (seeded tickets ran through QNT-2026-00124/00125).
CREATE SEQUENCE IF NOT EXISTS ticket_number_seq START WITH 126;
