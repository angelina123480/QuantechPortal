const { v4: uuidv4 } = require('uuid');
const pool = require('../data/db');

function mapRow(row) {
  return {
    id: row.id,
    ticketId: row.ticket_id,
    linkedTicketId: row.linked_ticket_id,
    linkType: row.link_type,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

// Links are stored one-directional but treated as symmetric for display —
// listForTicket returns both "I link to X" and "X links to me" rows.
async function listForTicket(ticketId) {
  const res = await pool.query(
    `SELECT id, ticket_id, linked_ticket_id, link_type, created_by, created_at FROM ticket_links WHERE ticket_id = $1
     UNION ALL
     SELECT id, linked_ticket_id AS ticket_id, ticket_id AS linked_ticket_id, link_type, created_by, created_at FROM ticket_links WHERE linked_ticket_id = $1`,
    [ticketId]
  );
  return res.rows.map(mapRow);
}

async function create({ ticketId, linkedTicketId, linkType, createdBy }) {
  const id = uuidv4();
  const res = await pool.query(
    'INSERT INTO ticket_links (id, ticket_id, linked_ticket_id, link_type, created_by, created_at) VALUES ($1,$2,$3,$4,$5,now()) RETURNING *',
    [id, ticketId, linkedTicketId, linkType, createdBy]
  );
  return mapRow(res.rows[0]);
}

async function remove(id) {
  await pool.query('DELETE FROM ticket_links WHERE id = $1', [id]);
}

module.exports = { listForTicket, create, remove };
