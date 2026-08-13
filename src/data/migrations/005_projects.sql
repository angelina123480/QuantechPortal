-- Projects, Milestones, and Tasks (Phase 2). Additive to 004_client_hierarchy.sql
-- (never edit an already-applied migration). migrate.js re-runs every .sql file
-- on each invocation, so every statement here must be safe to execute more than once.

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  company TEXT NOT NULL REFERENCES companies(name),
  sub_client_id TEXT REFERENCES sub_clients(id),
  project_manager_id TEXT REFERENCES users(id),
  team_id TEXT REFERENCES teams(id),
  start_date TIMESTAMPTZ,
  expected_completion_date TIMESTAMPTZ,
  actual_completion_date TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'Planning',
  priority TEXT NOT NULL DEFAULT 'Medium',
  budget NUMERIC(14,2),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_projects_company ON projects(company);
CREATE INDEX IF NOT EXISTS idx_projects_team ON projects(team_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);

-- Progress is intentionally not a column here — it's computed server-side as
-- the average of this project's milestones' progress_percentage (see
-- projectModel.computeProgress), so there's exactly one source of truth for
-- "how far along is this" rather than a stored value that can drift from
-- what the milestones actually say.
CREATE TABLE IF NOT EXISTS milestones (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  assigned_to_id TEXT REFERENCES users(id),
  start_date TIMESTAMPTZ,
  due_date TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'Not Started',
  progress_percentage INTEGER NOT NULL DEFAULT 0 CHECK (progress_percentage BETWEEN 0 AND 100),
  priority TEXT NOT NULL DEFAULT 'Medium',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_milestones_project ON milestones(project_id);
CREATE INDEX IF NOT EXISTS idx_milestones_assigned ON milestones(assigned_to_id);

-- project_id/milestone_id/ticket_id are all nullable and independent — a task
-- can be a fully personal to-do (all three null), or linked to any subset.
-- milestone_id is ON DELETE SET NULL (deleting a milestone detaches its
-- tasks rather than destroying them); project_id/ticket_id cascade, matching
-- how ticket_history/attachments already cascade off tickets.
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  assigned_to_id TEXT REFERENCES users(id),
  created_by_id TEXT NOT NULL REFERENCES users(id),
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  milestone_id TEXT REFERENCES milestones(id) ON DELETE SET NULL,
  ticket_id TEXT REFERENCES tickets(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'To Do',
  priority TEXT NOT NULL DEFAULT 'Medium',
  due_date TIMESTAMPTZ,
  checklist JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_to_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_milestone ON tasks(milestone_id);
CREATE INDEX IF NOT EXISTS idx_tasks_ticket ON tasks(ticket_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);

-- Notification deep-linking for the new domain, mirroring the existing ticket_id.
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS task_id TEXT REFERENCES tasks(id) ON DELETE CASCADE;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS milestone_id TEXT REFERENCES milestones(id) ON DELETE CASCADE;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS project_id TEXT REFERENCES projects(id) ON DELETE CASCADE;
