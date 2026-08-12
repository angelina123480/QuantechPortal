const { v4: uuidv4 } = require('uuid');
const pool = require('../data/db');

function mapRow(row) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    priority: row.priority,
    departmentId: row.department_id,
    teamId: row.team_id,
    agentId: row.agent_id,
    isActive: row.is_active,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  };
}

async function list() {
  const res = await pool.query('SELECT * FROM assignment_rules ORDER BY sort_order ASC, created_at ASC');
  return res.rows.map(mapRow);
}

async function findById(id) {
  const res = await pool.query('SELECT * FROM assignment_rules WHERE id = $1', [id]);
  return res.rows.length ? mapRow(res.rows[0]) : null;
}

async function create(data) {
  const id = uuidv4();
  const res = await pool.query(
    `INSERT INTO assignment_rules (id, name, category, priority, department_id, team_id, agent_id, is_active, sort_order, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,now()) RETURNING *`,
    [id, data.name, data.category || null, data.priority || null, data.departmentId || null, data.teamId || null, data.agentId || null, data.isActive !== false, data.sortOrder || 0]
  );
  return mapRow(res.rows[0]);
}

async function update(id, data) {
  const res = await pool.query(
    `UPDATE assignment_rules SET name = $1, category = $2, priority = $3, department_id = $4, team_id = $5, agent_id = $6, is_active = $7, sort_order = $8
     WHERE id = $9 RETURNING *`,
    [data.name, data.category || null, data.priority || null, data.departmentId || null, data.teamId || null, data.agentId || null, data.isActive !== false, data.sortOrder || 0, id]
  );
  return res.rows.length ? mapRow(res.rows[0]) : null;
}

async function remove(id) {
  await pool.query('DELETE FROM assignment_rules WHERE id = $1', [id]);
}

module.exports = { list, findById, create, update, remove };
