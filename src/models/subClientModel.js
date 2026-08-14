const { v4: uuidv4 } = require('uuid');
const pool = require('../data/db');

function mapRow(row) {
  return {
    id: row.id,
    parentCompany: row.parent_company,
    name: row.name,
    contactName: row.contact_name,
    contactEmail: row.contact_email,
    contactPhone: row.contact_phone,
    isActive: row.is_active,
    createdAt: row.created_at,
  };
}

// Every sub-client across every company — used by the user admin forms'
// sub-client picker, which isn't scoped to a single company's create form.
async function listAll() {
  const res = await pool.query('SELECT * FROM sub_clients ORDER BY parent_company ASC, name ASC');
  return res.rows.map(mapRow);
}

async function list(parentCompany) {
  const res = await pool.query('SELECT * FROM sub_clients WHERE parent_company = $1 ORDER BY name ASC', [parentCompany]);
  return res.rows.map(mapRow);
}

async function findById(id) {
  const res = await pool.query('SELECT * FROM sub_clients WHERE id = $1', [id]);
  return res.rows.length ? mapRow(res.rows[0]) : null;
}

async function create(data) {
  const id = uuidv4();
  const res = await pool.query(
    `INSERT INTO sub_clients (id, parent_company, name, contact_name, contact_email, contact_phone, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,now()) RETURNING *`,
    [id, data.parentCompany, data.name, data.contactName || null, data.contactEmail || null, data.contactPhone || null]
  );
  return mapRow(res.rows[0]);
}

async function update(id, data) {
  const res = await pool.query(
    `UPDATE sub_clients SET name = $1, contact_name = $2, contact_email = $3, contact_phone = $4 WHERE id = $5 RETURNING *`,
    [data.name, data.contactName || null, data.contactEmail || null, data.contactPhone || null, id]
  );
  return res.rows.length ? mapRow(res.rows[0]) : null;
}

async function setActive(id, isActive) {
  const res = await pool.query('UPDATE sub_clients SET is_active = $1 WHERE id = $2 RETURNING *', [isActive, id]);
  return res.rows.length ? mapRow(res.rows[0]) : null;
}

async function countsByCompany() {
  const res = await pool.query('SELECT parent_company, count(*)::int AS n FROM sub_clients GROUP BY parent_company');
  return Object.fromEntries(res.rows.map((r) => [r.parent_company, r.n]));
}

module.exports = { listAll, list, findById, create, update, setActive, countsByCompany };
