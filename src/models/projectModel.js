const { v4: uuidv4 } = require('uuid');
const pool = require('../data/db');
const userModel = require('./userModel');

function mapRow(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    company: row.company,
    subClientId: row.sub_client_id,
    projectManagerId: row.project_manager_id,
    teamId: row.team_id,
    startDate: row.start_date,
    expectedCompletionDate: row.expected_completion_date,
    actualCompletionDate: row.actual_completion_date,
    status: row.status,
    priority: row.priority,
    budget: row.budget,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Same two-tier rule as ticketModel.canAccess: staff see everything;
// end_client_user (subClientId set) is scoped to that sub-client;
// client/client_admin (subClientId null) see the whole company.
function canAccess(user, project) {
  if (!user || !project) return false;
  if (userModel.isStaff(user)) return true;
  if (user.subClientId) return project.subClientId === user.subClientId;
  return project.company === user.company;
}

function buildFilterClauses(user, filters) {
  const clauses = [];
  const params = [];

  function addClause(sql, value) {
    params.push(value);
    clauses.push(sql.replace('?', `$${params.length}`));
  }

  if (!userModel.isStaff(user)) {
    if (user.subClientId) addClause('sub_client_id = ?', user.subClientId);
    else addClause('company = ?', user.company);
  }

  if (filters.status) addClause('status = ?', filters.status);
  if (filters.priority) addClause('priority = ?', filters.priority);
  if (filters.company) addClause('company = ?', filters.company);
  if (filters.teamId) addClause('team_id = ?', filters.teamId);
  if (filters.projectManagerId) addClause('project_manager_id = ?', filters.projectManagerId);
  if (filters.search) {
    const q = `%${filters.search.trim().toLowerCase()}%`;
    params.push(q);
    const p = `$${params.length}`;
    clauses.push(`(lower(name) LIKE ${p} OR lower(company) LIKE ${p})`);
  }

  return { where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', params };
}

/**
 * filters: { status, priority, company, teamId, search, page, pageSize }
 * When filters.page is set, returns { projects, total, page, pageSize }
 * instead of a bare array — same shape as ticketModel.listVisibleTo.
 */
async function list(user, filters = {}) {
  const { where, params } = buildFilterClauses(user, filters);

  if (filters.page) {
    const pageSize = filters.pageSize || 25;
    const page = Math.max(1, filters.page);
    const countRes = await pool.query(`SELECT count(*) AS n FROM projects ${where}`, params);
    const total = Number(countRes.rows[0].n);
    const pagedParams = [...params, pageSize, (page - 1) * pageSize];
    const res = await pool.query(
      `SELECT * FROM projects ${where} ORDER BY updated_at DESC LIMIT $${pagedParams.length - 1} OFFSET $${pagedParams.length}`,
      pagedParams
    );
    return { projects: res.rows.map(mapRow), total, page, pageSize };
  }

  const res = await pool.query(`SELECT * FROM projects ${where} ORDER BY updated_at DESC`, params);
  return res.rows.map(mapRow);
}

async function findById(id) {
  const res = await pool.query('SELECT * FROM projects WHERE id = $1', [id]);
  return res.rows.length ? mapRow(res.rows[0]) : null;
}

async function create(data) {
  const id = uuidv4();
  const now = new Date();
  const res = await pool.query(
    `INSERT INTO projects (
       id, name, description, company, sub_client_id, project_manager_id, team_id,
       start_date, expected_completion_date, actual_completion_date, status, priority,
       budget, notes, created_at, updated_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$15) RETURNING *`,
    [
      id, data.name, data.description || null, data.company, data.subClientId || null,
      data.projectManagerId || null, data.teamId || null, data.startDate || null,
      data.expectedCompletionDate || null, data.actualCompletionDate || null,
      data.status || 'Planning', data.priority || 'Medium', data.budget || null,
      data.notes || null, now,
    ]
  );
  return mapRow(res.rows[0]);
}

async function update(id, data) {
  const res = await pool.query(
    `UPDATE projects SET
       name = $1, description = $2, company = $3, sub_client_id = $4, project_manager_id = $5,
       team_id = $6, start_date = $7, expected_completion_date = $8, actual_completion_date = $9,
       priority = $10, budget = $11, notes = $12, updated_at = $13
     WHERE id = $14 RETURNING *`,
    [
      data.name, data.description || null, data.company, data.subClientId || null,
      data.projectManagerId || null, data.teamId || null, data.startDate || null,
      data.expectedCompletionDate || null, data.actualCompletionDate || null,
      data.priority || 'Medium', data.budget || null, data.notes || null, new Date(), id,
    ]
  );
  return res.rows.length ? mapRow(res.rows[0]) : null;
}

async function updateStatus(id, status) {
  const now = new Date();
  const actualCompletionDate = status === 'Completed' ? now : null;
  const res = await pool.query(
    `UPDATE projects SET status = $1, actual_completion_date = COALESCE($2, actual_completion_date), updated_at = $3 WHERE id = $4 RETURNING *`,
    [status, actualCompletionDate, now, id]
  );
  return res.rows.length ? mapRow(res.rows[0]) : null;
}

// Kept for completeness/scripting use (same precedent as companyModel.remove()
// existing with no route calling it) — no Phase 2 route exposes this, since
// projects use status (Cancelled/Archived) as their remove-from-view
// mechanism rather than a destructive cascade over their milestones/tasks.
async function remove(id) {
  await pool.query('DELETE FROM projects WHERE id = $1', [id]);
}

// Pure helper — a project's progress is never stored, always derived from
// its milestones so there's exactly one source of truth.
function computeProgress(milestones) {
  if (!milestones.length) return 0;
  const total = milestones.reduce((sum, m) => sum + (Number(m.progressPercentage) || 0), 0);
  return Math.round(total / milestones.length);
}

async function countsByCompany() {
  const res = await pool.query('SELECT company, count(*)::int AS n FROM projects WHERE company IS NOT NULL GROUP BY company');
  return Object.fromEntries(res.rows.map((r) => [r.company, r.n]));
}

module.exports = { list, findById, create, update, updateStatus, remove, computeProgress, canAccess, countsByCompany };
