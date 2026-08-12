const { v4: uuidv4 } = require('uuid');
const pool = require('../data/db');

function mapRow(row) {
  return {
    id: row.id,
    ticketId: row.ticket_id,
    reason: row.reason,
    escalatedBy: row.escalated_by,
    escalatedToTeamId: row.escalated_to_team_id,
    note: row.note,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
  };
}

async function create({ ticketId, reason, escalatedBy, escalatedToTeamId, note }) {
  const id = uuidv4();
  const res = await pool.query(
    'INSERT INTO escalations (id, ticket_id, reason, escalated_by, escalated_to_team_id, note, created_at) VALUES ($1,$2,$3,$4,$5,$6,now()) RETURNING *',
    [id, ticketId, reason, escalatedBy || null, escalatedToTeamId || null, note || null]
  );
  return mapRow(res.rows[0]);
}

async function listForTeam(teamId, { unresolvedOnly = false } = {}) {
  const clauses = ['escalated_to_team_id = $1'];
  const params = [teamId];
  if (unresolvedOnly) clauses.push('resolved_at IS NULL');
  const res = await pool.query(`SELECT * FROM escalations WHERE ${clauses.join(' AND ')} ORDER BY created_at DESC`, params);
  return res.rows.map(mapRow);
}

async function listForTicket(ticketId) {
  const res = await pool.query('SELECT * FROM escalations WHERE ticket_id = $1 ORDER BY created_at DESC', [ticketId]);
  return res.rows.map(mapRow);
}

async function hasOpenEscalation(ticketId) {
  const res = await pool.query('SELECT 1 FROM escalations WHERE ticket_id = $1 AND resolved_at IS NULL LIMIT 1', [ticketId]);
  return res.rows.length > 0;
}

async function resolve(id) {
  await pool.query('UPDATE escalations SET resolved_at = now() WHERE id = $1', [id]);
}

module.exports = { create, listForTeam, listForTicket, hasOpenEscalation, resolve };
