const pool = require('../data/db');

function mapRow(row) {
  return {
    priority: row.priority,
    responseMinutes: row.response_minutes,
    resolutionMinutes: row.resolution_minutes,
    updatedAt: row.updated_at,
  };
}

async function list() {
  const res = await pool.query('SELECT * FROM sla_policies ORDER BY resolution_minutes ASC');
  return res.rows.map(mapRow);
}

async function findByPriority(priority) {
  const res = await pool.query('SELECT * FROM sla_policies WHERE priority = $1', [priority]);
  return res.rows.length ? mapRow(res.rows[0]) : null;
}

async function asMap() {
  const policies = await list();
  return Object.fromEntries(policies.map((p) => [p.priority, p]));
}

async function update(priority, { responseMinutes, resolutionMinutes }) {
  const res = await pool.query(
    'UPDATE sla_policies SET response_minutes = $1, resolution_minutes = $2, updated_at = now() WHERE priority = $3 RETURNING *',
    [responseMinutes, resolutionMinutes, priority]
  );
  return res.rows.length ? mapRow(res.rows[0]) : null;
}

async function getBusinessHours() {
  const res = await pool.query("SELECT value FROM system_settings WHERE key = 'business_hours'");
  return res.rows.length ? res.rows[0].value : null;
}

async function setBusinessHours(value) {
  await pool.query(
    `INSERT INTO system_settings (key, value, updated_at) VALUES ('business_hours', $1, now())
     ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = now()`,
    [JSON.stringify(value)]
  );
}

module.exports = { list, findByPriority, asMap, update, getBusinessHours, setBusinessHours };
