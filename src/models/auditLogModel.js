const pool = require('../data/db');

function mapRow(row) {
  return {
    id: row.id,
    userId: row.user_id,
    userName: row.user_name,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    beforeValue: row.before_value,
    afterValue: row.after_value,
    ipAddress: row.ip_address,
    createdAt: row.created_at,
  };
}

async function list(filters = {}) {
  const clauses = [];
  const params = [];
  function addClause(sql, value) {
    params.push(value);
    clauses.push(sql.replace('?', `$${params.length}`));
  }
  if (filters.userId) addClause('user_id = ?', filters.userId);
  if (filters.action) addClause('action = ?', filters.action);
  if (filters.entityType) addClause('entity_type = ?', filters.entityType);
  if (filters.dateFrom) addClause('created_at >= ?', filters.dateFrom);
  if (filters.dateTo) addClause('created_at <= ?', filters.dateTo);
  if (filters.search) {
    const q = `%${filters.search.trim().toLowerCase()}%`;
    params.push(q);
    const p = `$${params.length}`;
    clauses.push(`(lower(user_name) LIKE ${p} OR lower(action) LIKE ${p} OR lower(entity_id) LIKE ${p})`);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const page = Math.max(1, filters.page || 1);
  const pageSize = filters.pageSize || 50;

  const countRes = await pool.query(`SELECT count(*) AS n FROM audit_logs ${where}`, params);
  const total = Number(countRes.rows[0].n);

  const pagedParams = [...params, pageSize, (page - 1) * pageSize];
  const res = await pool.query(
    `SELECT * FROM audit_logs ${where} ORDER BY created_at DESC LIMIT $${pagedParams.length - 1} OFFSET $${pagedParams.length}`,
    pagedParams
  );

  return { logs: res.rows.map(mapRow), total, page, pageSize };
}

async function listActions() {
  const res = await pool.query('SELECT DISTINCT action FROM audit_logs ORDER BY action ASC');
  return res.rows.map((r) => r.action);
}

module.exports = { list, listActions };
