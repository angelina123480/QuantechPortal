const bcrypt = require('bcryptjs');
const pool = require('../data/db');
const { ROLES, STAFF_ROLES, CLIENT_ROLES, MANAGEMENT_ROLES } = require('../config/constants');

function mapUserRow(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    passwordHash: row.password_hash,
    role: row.role,
    company: row.company,
    subClientId: row.sub_client_id,
    department: row.department,
    title: row.title,
    phone: row.phone,
    notificationPrefs: row.notification_prefs,
    createdAt: row.created_at,
    teamId: row.team_id,
    isActive: row.is_active,
    totpEnabled: row.totp_enabled,
    totpSecret: row.totp_secret,
    invitedAt: row.invited_at,
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

// All staff (agent/team_leader/admin) — used for the ticket "assign to"
// picker, which any staff member (not just agents) can be assigned to.
async function listTechnicians() {
  const res = await pool.query('SELECT * FROM users WHERE role = ANY($1) AND is_active = TRUE ORDER BY name ASC', [STAFF_ROLES]);
  return res.rows.map(mapUserRow);
}

async function listByTeam(teamId) {
  const res = await pool.query('SELECT * FROM users WHERE team_id = $1 AND is_active = TRUE ORDER BY name ASC', [teamId]);
  return res.rows.map(mapUserRow);
}

/**
 * filters: { role, company, teamId, subClientId, group ('staff'|'client'), search, page, pageSize }
 * When filters.page is set, returns { users, total, page, pageSize } instead
 * of a bare array — same opt-in pagination shape as ticketModel.listVisibleTo
 * and projectModel.list.
 */
async function listAll(filters = {}) {
  const clauses = [];
  const params = [];
  function addClause(sql, value) {
    params.push(value);
    clauses.push(sql.replace('?', `$${params.length}`));
  }
  if (filters.role) addClause('role = ?', filters.role);
  if (filters.company) addClause('company = ?', filters.company);
  if (filters.teamId) addClause('team_id = ?', filters.teamId);
  if (filters.subClientId) addClause('sub_client_id = ?', filters.subClientId);
  if (filters.group === 'staff') addClause('role = ANY(?)', STAFF_ROLES);
  else if (filters.group === 'client') addClause('role = ANY(?)', CLIENT_ROLES);
  if (filters.search) {
    const q = `%${filters.search.trim().toLowerCase()}%`;
    params.push(q);
    const p = `$${params.length}`;
    clauses.push(`(lower(name) LIKE ${p} OR lower(email) LIKE ${p})`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

  if (filters.page) {
    const pageSize = filters.pageSize || 25;
    const page = Math.max(1, filters.page);
    const countRes = await pool.query(`SELECT count(*) AS n FROM users ${where}`, params);
    const total = Number(countRes.rows[0].n);
    const pagedParams = [...params, pageSize, (page - 1) * pageSize];
    const res = await pool.query(
      `SELECT * FROM users ${where} ORDER BY role ASC, name ASC LIMIT $${pagedParams.length - 1} OFFSET $${pagedParams.length}`,
      pagedParams
    );
    return { users: res.rows.map(mapUserRow), total, page, pageSize };
  }

  const res = await pool.query(`SELECT * FROM users ${where} ORDER BY role ASC, name ASC`, params);
  return res.rows.map(mapUserRow);
}

async function countsByCompany() {
  const res = await pool.query('SELECT company, count(*)::int AS n FROM users WHERE company IS NOT NULL GROUP BY company');
  return Object.fromEntries(res.rows.map((r) => [r.company, r.n]));
}

function isStaff(user) {
  return !!user && STAFF_ROLES.includes(user.role);
}

function isClient(user) {
  return !!user && user.role === ROLES.CLIENT;
}

function isManager(user) {
  return !!user && MANAGEMENT_ROLES.includes(user.role);
}

// "Admin or higher" — matches requireAdmin/res.locals.isAdmin, since super
// admin is a strict superset of admin. Use isSuperAdmin() below when a check
// genuinely needs to distinguish the two (e.g. the last-super-admin guard).
function isAdmin(user) {
  return !!user && (user.role === ROLES.ADMIN || user.role === ROLES.SUPER_ADMIN);
}

function isSuperAdmin(user) {
  return !!user && user.role === ROLES.SUPER_ADMIN;
}

function isEndClientUser(user) {
  return !!user && user.role === ROLES.END_CLIENT_USER;
}

async function create(data) {
  const { v4: uuidv4 } = require('uuid');
  const id = uuidv4();
  const passwordHash = bcrypt.hashSync(data.password, 10);
  const res = await pool.query(
    `INSERT INTO users (id, name, email, password_hash, role, company, sub_client_id, department, title, phone, notification_prefs, created_at, team_id, is_active, invited_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,now(),$12,$13,$14) RETURNING *`,
    [
      id, data.name, data.email.trim().toLowerCase(), passwordHash, data.role, data.company, data.subClientId || null,
      data.department || '', data.title || '', data.phone || null,
      JSON.stringify({ emailOnReply: true, emailOnStatusChange: true, emailOnAssignment: data.role !== ROLES.CLIENT }),
      data.teamId || null, data.isActive !== false, data.invited ? new Date() : null,
    ]
  );
  return mapUserRow(res.rows[0]);
}

// Self-service only — deliberately excludes company/sub_client_id/role.
// Reassigning what data a user can see is an admin action (adminUpdate),
// never something a user can do to themselves.
async function updateProfile(id, updates) {
  const allowed = ['name', 'phone', 'department'];
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

// Admin user-management update — role/team/active status, unlike updateProfile
// which is the self-service subset a logged-in user can change about themselves.
async function adminUpdate(id, updates) {
  const allowed = { role: 'role', teamId: 'team_id', company: 'company', subClientId: 'sub_client_id', department: 'department', title: 'title', isActive: 'is_active', name: 'name', phone: 'phone' };
  const sets = [];
  const params = [];
  for (const [key, column] of Object.entries(allowed)) {
    if (updates[key] !== undefined) {
      params.push(updates[key]);
      sets.push(`${column} = $${params.length}`);
    }
  }
  if (sets.length === 0) return findById(id);
  params.push(id);
  const res = await pool.query(`UPDATE users SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`, params);
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

async function setTotp(id, { secret, enabled }) {
  const res = await pool.query('UPDATE users SET totp_secret = $1, totp_enabled = $2 WHERE id = $3 RETURNING *', [secret, enabled, id]);
  return res.rows.length ? mapUserRow(res.rows[0]) : null;
}

module.exports = {
  findById,
  findByIds,
  findByEmail,
  verifyPassword,
  listTechnicians,
  listByTeam,
  listAll,
  countsByCompany,
  isStaff,
  isClient,
  isManager,
  isAdmin,
  isSuperAdmin,
  isEndClientUser,
  create,
  updateProfile,
  adminUpdate,
  updateNotificationPrefs,
  updatePassword,
  setTotp,
};
