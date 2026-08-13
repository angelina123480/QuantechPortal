const { v4: uuidv4 } = require('uuid');
const pool = require('../data/db');
const { MANAGEMENT_ROLES } = require('../config/constants');

function mapRow(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    assignedToId: row.assigned_to_id,
    createdById: row.created_by_id,
    projectId: row.project_id,
    milestoneId: row.milestone_id,
    ticketId: row.ticket_id,
    status: row.status,
    priority: row.priority,
    dueDate: row.due_date,
    checklist: row.checklist || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
  };
}

function buildFilterClauses(filters) {
  const clauses = [];
  const params = [];

  function addClause(sql, value) {
    params.push(value);
    clauses.push(sql.replace('?', `$${params.length}`));
  }

  if (filters.assignedToId) addClause('assigned_to_id = ?', filters.assignedToId);
  if (filters.status) addClause('status = ?', filters.status);
  if (filters.priority) addClause('priority = ?', filters.priority);
  if (filters.projectId) addClause('project_id = ?', filters.projectId);
  if (filters.milestoneId) addClause('milestone_id = ?', filters.milestoneId);
  if (filters.ticketId) addClause('ticket_id = ?', filters.ticketId);
  if (filters.search) {
    params.push(`%${filters.search.trim().toLowerCase()}%`);
    clauses.push(`lower(title) LIKE $${params.length}`);
  }

  return { where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', params };
}

// No pagination — task lists are always bounded (one worker's queue, or one
// project's tasks), unlike tickets which can grow unbounded across the org.
async function list(filters = {}) {
  const { where, params } = buildFilterClauses(filters);
  const res = await pool.query(`SELECT * FROM tasks ${where} ORDER BY due_date ASC NULLS LAST, created_at DESC`, params);
  return res.rows.map(mapRow);
}

async function findById(id) {
  const res = await pool.query('SELECT * FROM tasks WHERE id = $1', [id]);
  return res.rows.length ? mapRow(res.rows[0]) : null;
}

async function create(data) {
  const id = uuidv4();
  const now = new Date();
  const res = await pool.query(
    `INSERT INTO tasks (
       id, title, description, assigned_to_id, created_by_id, project_id, milestone_id, ticket_id,
       status, priority, due_date, checklist, created_at, updated_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$13) RETURNING *`,
    [
      id, data.title, data.description || null, data.assignedToId || null, data.createdById,
      data.projectId || null, data.milestoneId || null, data.ticketId || null,
      data.status || 'To Do', data.priority || 'Medium', data.dueDate || null,
      JSON.stringify(data.checklist || []), now,
    ]
  );
  return mapRow(res.rows[0]);
}

async function update(id, data) {
  const res = await pool.query(
    `UPDATE tasks SET title = $1, description = $2, due_date = $3, priority = $4, updated_at = $5 WHERE id = $6 RETURNING *`,
    [data.title, data.description || null, data.dueDate || null, data.priority || 'Medium', new Date(), id]
  );
  return res.rows.length ? mapRow(res.rows[0]) : null;
}

async function updateStatus(id, status) {
  const now = new Date();
  const completedAt = status === 'Completed' ? now : null;
  const res = await pool.query(
    'UPDATE tasks SET status = $1, completed_at = $2, updated_at = $3 WHERE id = $4 RETURNING *',
    [status, completedAt, now, id]
  );
  return res.rows.length ? mapRow(res.rows[0]) : null;
}

async function assign(id, assignedToId) {
  const res = await pool.query(
    'UPDATE tasks SET assigned_to_id = $1, updated_at = $2 WHERE id = $3 RETURNING *',
    [assignedToId || null, new Date(), id]
  );
  return res.rows.length ? mapRow(res.rows[0]) : null;
}

// Read-modify-write the whole array — same convention as
// userModel.updateNotificationPrefs overwriting its whole JSON blob, rather
// than SQL jsonb_set path surgery. Fine for single-owner editing; not
// concurrency-safe against two simultaneous editors, which isn't a realistic
// scenario for a personal task's checklist.
async function setChecklist(id, checklist) {
  const res = await pool.query(
    'UPDATE tasks SET checklist = $1, updated_at = $2 WHERE id = $3 RETURNING *',
    [JSON.stringify(checklist), new Date(), id]
  );
  return res.rows.length ? mapRow(res.rows[0]) : null;
}

// Tasks are lightweight personal to-dos with nothing to cascade, unlike
// projects/milestones — hard delete is the normal, low-risk action here.
async function remove(id) {
  await pool.query('DELETE FROM tasks WHERE id = $1', [id]);
}

function canManage(user, task) {
  if (MANAGEMENT_ROLES.includes(user.role)) return true;
  return task.assignedToId === user.id || task.createdById === user.id;
}

module.exports = { list, findById, create, update, updateStatus, assign, setChecklist, remove, canManage };
