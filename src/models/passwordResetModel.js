const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const pool = require('../data/db');

const TOKEN_TTL_MINUTES = 30;

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Returns the raw token (put in the emailed link) — only the hash is stored.
// purpose distinguishes a self-service "reset" from an admin-sent "invite"
// (see authController's /reset-password/:token, which reads it back to show
// the right copy) — both consume the exact same table/flow.
async function create(userId, { ttlMinutes = TOKEN_TTL_MINUTES, purpose = 'reset' } = {}) {
  const token = crypto.randomBytes(32).toString('hex');
  const id = uuidv4();
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
  await pool.query(
    'INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, purpose, created_at) VALUES ($1,$2,$3,$4,$5,now())',
    [id, userId, hashToken(token), expiresAt, purpose]
  );
  return token;
}

async function findValid(token) {
  const res = await pool.query(
    'SELECT * FROM password_reset_tokens WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()',
    [hashToken(token)]
  );
  if (!res.rows.length) return null;
  const row = res.rows[0];
  return { id: row.id, userId: row.user_id, expiresAt: row.expires_at, purpose: row.purpose };
}

async function markUsed(id) {
  await pool.query('UPDATE password_reset_tokens SET used_at = now() WHERE id = $1', [id]);
}

module.exports = { create, findValid, markUsed };
