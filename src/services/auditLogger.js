const { v4: uuidv4 } = require('uuid');
const pool = require('../data/db');

/**
 * Records one audit_logs row. `user` may be null for unauthenticated events
 * (e.g. a failed login). `req` is optional and only used to capture the
 * client IP. Never throws — audit logging must never break the request it's
 * observing, so failures are swallowed after being logged to the console.
 */
async function log({ user, action, entityType = null, entityId = null, before = null, after = null, req = null }) {
  try {
    await pool.query(
      `INSERT INTO audit_logs (id, user_id, user_name, action, entity_type, entity_id, before_value, after_value, ip_address, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,now())`,
      [
        uuidv4(),
        user ? user.id : null,
        user ? user.name : null,
        action,
        entityType,
        entityId,
        before !== null ? JSON.stringify(before) : null,
        after !== null ? JSON.stringify(after) : null,
        req ? (req.ip || req.headers['x-forwarded-for'] || null) : null,
      ]
    );
  } catch (err) {
    console.error('[auditLogger] failed to write audit log row:', err.message);
  }
}

module.exports = { log };
