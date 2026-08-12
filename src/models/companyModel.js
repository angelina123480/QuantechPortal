const pool = require('../data/db');

function mapRow(row) {
  return {
    name: row.name,
    contactName: row.contact_name,
    contactEmail: row.contact_email,
    contactPhone: row.contact_phone,
    industry: row.industry,
    teamId: row.team_id,
    createdAt: row.created_at,
  };
}

async function list() {
  const res = await pool.query('SELECT * FROM companies ORDER BY name ASC');
  return res.rows.map(mapRow);
}

async function findByName(name) {
  const res = await pool.query('SELECT * FROM companies WHERE name = $1', [name]);
  return res.rows.length ? mapRow(res.rows[0]) : null;
}

async function create(data) {
  const res = await pool.query(
    `INSERT INTO companies (name, contact_name, contact_email, contact_phone, industry, team_id, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,now()) RETURNING *`,
    [data.name, data.contactName || null, data.contactEmail || null, data.contactPhone || null, data.industry || null, data.teamId || null]
  );
  return mapRow(res.rows[0]);
}

async function update(name, data) {
  const res = await pool.query(
    `UPDATE companies SET contact_name = $1, contact_email = $2, contact_phone = $3, industry = $4, team_id = $5 WHERE name = $6 RETURNING *`,
    [data.contactName || null, data.contactEmail || null, data.contactPhone || null, data.industry || null, data.teamId || null, name]
  );
  return res.rows.length ? mapRow(res.rows[0]) : null;
}

async function remove(name) {
  await pool.query('DELETE FROM companies WHERE name = $1', [name]);
}

module.exports = { list, findByName, create, update, remove };
