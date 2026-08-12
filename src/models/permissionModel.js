const pool = require('../data/db');

async function list() {
  const res = await pool.query('SELECT * FROM permissions ORDER BY key ASC');
  return res.rows.map((r) => ({ key: r.key, label: r.label, description: r.description }));
}

async function listRolePermissions() {
  const res = await pool.query('SELECT * FROM role_permissions');
  return res.rows.map((r) => ({ role: r.role, permissionKey: r.permission_key }));
}

async function roleHasPermission(role, key) {
  const res = await pool.query('SELECT 1 FROM role_permissions WHERE role = $1 AND permission_key = $2', [role, key]);
  return res.rows.length > 0;
}

async function setRolePermission(role, key, granted) {
  if (granted) {
    await pool.query('INSERT INTO role_permissions (role, permission_key) VALUES ($1,$2) ON CONFLICT DO NOTHING', [role, key]);
  } else {
    await pool.query('DELETE FROM role_permissions WHERE role = $1 AND permission_key = $2', [role, key]);
  }
}

module.exports = { list, listRolePermissions, roleHasPermission, setRolePermission };
