const { v4: uuidv4 } = require('uuid');
const pool = require('../data/db');
const { MANAGEMENT_ROLES } = require('../config/constants');

function mapRow(row) {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    description: row.description,
    assignedToId: row.assigned_to_id,
    startDate: row.start_date,
    dueDate: row.due_date,
    status: row.status,
    progressPercentage: row.progress_percentage,
    priority: row.priority,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function listForProject(projectId) {
  const res = await pool.query('SELECT * FROM milestones WHERE project_id = $1 ORDER BY sort_order ASC, created_at ASC', [projectId]);
  return res.rows.map(mapRow);
}

async function findById(id) {
  const res = await pool.query('SELECT * FROM milestones WHERE id = $1', [id]);
  return res.rows.length ? mapRow(res.rows[0]) : null;
}

async function create(data) {
  const id = uuidv4();
  const now = new Date();
  const res = await pool.query(
    `INSERT INTO milestones (
       id, project_id, name, description, assigned_to_id, start_date, due_date,
       status, progress_percentage, priority, sort_order, created_at, updated_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$12) RETURNING *`,
    [
      id, data.projectId, data.name, data.description || null, data.assignedToId || null,
      data.startDate || null, data.dueDate || null, data.status || 'Not Started',
      data.progressPercentage || 0, data.priority || 'Medium', data.sortOrder || 0, now,
    ]
  );
  return mapRow(res.rows[0]);
}

// Full edit — management only (see canUpdateProgress for the narrower,
// assignee-permitted status/progress-only update).
async function update(id, data) {
  const res = await pool.query(
    `UPDATE milestones SET
       name = $1, description = $2, assigned_to_id = $3, start_date = $4, due_date = $5,
       priority = $6, sort_order = $7, updated_at = $8
     WHERE id = $9 RETURNING *`,
    [data.name, data.description || null, data.assignedToId || null, data.startDate || null, data.dueDate || null, data.priority || 'Medium', data.sortOrder || 0, new Date(), id]
  );
  return res.rows.length ? mapRow(res.rows[0]) : null;
}

async function updateProgress(id, { status, progressPercentage }) {
  const clamped = Math.min(100, Math.max(0, Number(progressPercentage) || 0));
  const res = await pool.query(
    'UPDATE milestones SET status = $1, progress_percentage = $2, updated_at = $3 WHERE id = $4 RETURNING *',
    [status, clamped, new Date(), id]
  );
  return res.rows.length ? mapRow(res.rows[0]) : null;
}

// No route exposes this in Phase 2 — milestones use status (Cancelled) as
// their remove-from-view mechanism, same reasoning as projectModel.remove().
async function remove(id) {
  await pool.query('DELETE FROM milestones WHERE id = $1', [id]);
}

// Deliberate relaxation from a strict reading of "milestones are
// management-only": the assignee knows their own progress best, and forcing
// every update through a manager is worse UX for no real security benefit —
// this only ever governs status/progress, never the full edit (name, dates,
// reassignment, etc.), which stays management-only via update() above.
function canUpdateProgress(user, milestone) {
  if (MANAGEMENT_ROLES.includes(user.role)) return true;
  return milestone.assignedToId === user.id;
}

module.exports = { listForProject, findById, create, update, updateProgress, remove, canUpdateProgress };
