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

module.exports = { listAll, list, findById, create };
