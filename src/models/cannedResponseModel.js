const { v4: uuidv4 } = require('uuid');
const pool = require('../data/db');

function mapRow(row) {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    category: row.category,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function list() {
  const res = await pool.query('SELECT * FROM canned_responses ORDER BY title ASC');
  return res.rows.map(mapRow);
}

async function findById(id) {
  const res = await pool.query('SELECT * FROM canned_responses WHERE id = $1', [id]);
  return res.rows.length ? mapRow(res.rows[0]) : null;
}

async function create(data, author) {
  const id = uuidv4();
  const res = await pool.query(
    'INSERT INTO canned_responses (id, title, body, category, created_by, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,now(),now()) RETURNING *',
    [id, data.title, data.body, data.category || null, author.id]
  );
  return mapRow(res.rows[0]);
}

async function update(id, data) {
  const res = await pool.query(
    'UPDATE canned_responses SET title = $1, body = $2, category = $3, updated_at = now() WHERE id = $4 RETURNING *',
    [data.title, data.body, data.category || null, id]
  );
  return res.rows.length ? mapRow(res.rows[0]) : null;
}

async function remove(id) {
  await pool.query('DELETE FROM canned_responses WHERE id = $1', [id]);
}

module.exports = { list, findById, create, update, remove };
