const { v4: uuidv4 } = require('uuid');
const pool = require('../data/db');

function mapRow(row) {
  return {
    id: row.id,
    name: row.name,
    departmentId: row.department_id,
    leadUserId: row.lead_user_id,
    createdAt: row.created_at,
  };
}

async function list() {
  const res = await pool.query('SELECT * FROM teams ORDER BY name ASC');
  return res.rows.map(mapRow);
}

async function findById(id) {
  const res = await pool.query('SELECT * FROM teams WHERE id = $1', [id]);
  return res.rows.length ? mapRow(res.rows[0]) : null;
}

async function findByLeadUserId(userId) {
  const res = await pool.query('SELECT * FROM teams WHERE lead_user_id = $1', [userId]);
  return res.rows.length ? mapRow(res.rows[0]) : null;
}

async function create(data) {
  const id = uuidv4();
  const res = await pool.query(
    'INSERT INTO teams (id, name, department_id, lead_user_id, created_at) VALUES ($1,$2,$3,$4,now()) RETURNING *',
    [id, data.name, data.departmentId, data.leadUserId || null]
  );
  return mapRow(res.rows[0]);
}

async function update(id, data) {
  const res = await pool.query(
    'UPDATE teams SET name = $1, department_id = $2, lead_user_id = $3 WHERE id = $4 RETURNING *',
    [data.name, data.departmentId, data.leadUserId || null, id]
  );
  return res.rows.length ? mapRow(res.rows[0]) : null;
}

async function remove(id) {
  await pool.query('DELETE FROM teams WHERE id = $1', [id]);
}

module.exports = { list, findById, findByLeadUserId, create, update, remove };
