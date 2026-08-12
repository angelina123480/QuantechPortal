const { v4: uuidv4 } = require('uuid');
const pool = require('../data/db');

function mapRow(row) {
  return {
    id: row.id,
    ticketId: row.ticket_id,
    clientUserId: row.client_user_id,
    stars: row.stars,
    feedback: row.feedback,
    createdAt: row.created_at,
  };
}

async function findByTicketId(ticketId) {
  const res = await pool.query('SELECT * FROM ticket_ratings WHERE ticket_id = $1', [ticketId]);
  return res.rows.length ? mapRow(res.rows[0]) : null;
}

async function findByTicketIds(ticketIds) {
  if (!ticketIds.length) return [];
  const res = await pool.query('SELECT * FROM ticket_ratings WHERE ticket_id = ANY($1)', [ticketIds]);
  return res.rows.map(mapRow);
}

// Relies on ticket_ratings.ticket_id UNIQUE constraint — a second insert for
// the same ticket throws (caught by the controller), enforcing "no repeat rating" in the DB.
async function create({ ticketId, clientUserId, stars, feedback }) {
  const id = uuidv4();
  const res = await pool.query(
    'INSERT INTO ticket_ratings (id, ticket_id, client_user_id, stars, feedback, created_at) VALUES ($1,$2,$3,$4,$5,now()) RETURNING *',
    [id, ticketId, clientUserId, stars, feedback || null]
  );
  return mapRow(res.rows[0]);
}

// Pass a ticketIds array to scope to a team/company/date-range's tickets
// (join with whatever set the caller already computed); omit for org-wide.
async function stats(ticketIds) {
  const res = ticketIds
    ? await pool.query('SELECT stars FROM ticket_ratings WHERE ticket_id = ANY($1)', [ticketIds])
    : await pool.query('SELECT stars FROM ticket_ratings');

  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let total = 0;
  let sum = 0;
  for (const r of res.rows) {
    distribution[r.stars] = (distribution[r.stars] || 0) + 1;
    total += 1;
    sum += r.stars;
  }
  return { total, average: total > 0 ? Math.round((sum / total) * 10) / 10 : null, distribution };
}

module.exports = { findByTicketId, findByTicketIds, create, stats };
