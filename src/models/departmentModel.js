const { v4: uuidv4 } = require('uuid');
const pool = require('../data/db');

function mapRow(row) {
  return { id: row.id, name: row.name, description: row.description, createdAt: row.created_at };
}

async function list() {
  const res = await pool.query('SELECT * FROM departments ORDER BY name ASC');
  return res.rows.map(mapRow);
}

async function findById(id) {
  const res = await pool.query('SELECT * FROM departments WHERE id = $1', [id]);
  return res.rows.length ? mapRow(res.rows[0]) : null;
}

async function create(data) {
  const id = uuidv4();
  const res = await pool.query('INSERT INTO departments (id, name, description, created_at) VALUES ($1,$2,$3,now()) RETURNING *', [id, data.name, data.description || null]);
  return mapRow(res.rows[0]);
}

async function update(id, data) {
  const res = await pool.query('UPDATE departments SET name = $1, description = $2 WHERE id = $3 RETURNING *', [data.name, data.description || null, id]);
  return res.rows.length ? mapRow(res.rows[0]) : null;
}

async function remove(id) {
  await pool.query('DELETE FROM departments WHERE id = $1', [id]);
}

module.exports = { list, findById, create, update, remove };
