const bcrypt = require('bcryptjs');
const pool = require('../data/db');
const { ROLES, STAFF_ROLES } = require('../config/constants');

function mapUserRow(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    passwordHash: row.password_hash,
    role: row.role,
    company: row.company,
    department: row.department,
    title: row.title,
    phone: row.phone,
    notificationPrefs: row.notification_prefs,
    createdAt: row.created_at,
  };
}

async function findById(id) {
  const res = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
  return res.rows.length ? mapUserRow(res.rows[0]) : null;
}

async function findByIds(ids) {
  const unique = Array.from(new Set(ids)).filter(Boolean);
  if (unique.length === 0) return [];
  const res = await pool.query('SELECT * FROM users WHERE id = ANY($1)', [unique]);
  return res.rows.map(mapUserRow);
}

async function findByEmail(email) {
  const normalized = String(email || '').trim().toLowerCase();
  const res = await pool.query('SELECT * FROM users WHERE lower(email) = $1', [normalized]);
  return res.rows.length ? mapUserRow(res.rows[0]) : null;
}

function verifyPassword(user, plainPassword) {
  return bcrypt.compareSync(plainPassword, user.passwordHash);
}

async function listTechnicians() {
  const res = await pool.query('SELECT * FROM users WHERE role = ANY($1) ORDER BY name ASC', [STAFF_ROLES]);
  return res.rows.map(mapUserRow);
}

function isStaff(user) {
  return !!user && STAFF_ROLES.includes(user.role);
}

function isClient(user) {
  return !!user && user.role === ROLES.CLIENT;
}

async function updateProfile(id, updates) {
  const allowed = ['name', 'phone', 'department', 'company'];
  const sets = [];
  const params = [];

  for (const key of allowed) {
    if (updates[key] !== undefined && updates[key] !== '') {
      params.push(updates[key]);
      sets.push(`${key === 'name' ? 'name' : key} = $${params.length}`);
    }
  }
  if (sets.length === 0) return findById(id);

  params.push(id);
  const res = await pool.query(
    `UPDATE users SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
    params
  );
  return res.rows.length ? mapUserRow(res.rows[0]) : null;
}

async function updateNotificationPrefs(id, prefs) {
  const notificationPrefs = {
    emailOnReply: !!prefs.emailOnReply,
    emailOnStatusChange: !!prefs.emailOnStatusChange,
    emailOnAssignment: !!prefs.emailOnAssignment,
  };
  const res = await pool.query(
    'UPDATE users SET notification_prefs = $1 WHERE id = $2 RETURNING *',
    [JSON.stringify(notificationPrefs), id]
  );
  return res.rows.length ? mapUserRow(res.rows[0]) : null;
}

async function updatePassword(id, newPlainPassword) {
  const passwordHash = bcrypt.hashSync(newPlainPassword, 10);
  const res = await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2 RETURNING *', [passwordHash, id]);
  return res.rows.length ? mapUserRow(res.rows[0]) : null;
}

module.exports = {
  findById,
  findByIds,
  findByEmail,
  verifyPassword,
  listTechnicians,
  isStaff,
  isClient,
  updateProfile,
  updateNotificationPrefs,
  updatePassword,
};
