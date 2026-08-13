const { v4: uuidv4 } = require('uuid');
const pool = require('../data/db');

function mapRow(row) {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    title: row.title,
    body: row.body,
    ticketId: row.ticket_id,
    taskId: row.task_id,
    milestoneId: row.milestone_id,
    projectId: row.project_id,
    isRead: row.is_read,
    createdAt: row.created_at,
  };
}

async function create({ userId, type, title, body, ticketId, taskId, milestoneId, projectId }) {
  const id = uuidv4();
  await pool.query(
    'INSERT INTO notifications (id, user_id, type, title, body, ticket_id, task_id, milestone_id, project_id, is_read, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,false,now())',
    [id, userId, type, title, body || null, ticketId || null, taskId || null, milestoneId || null, projectId || null]
  );
  return { id, userId, type, title, body, ticketId, taskId, milestoneId, projectId, isRead: false };
}

// Same notification fanned out to multiple recipients (e.g. every member of a team).
async function createMany(userIds, payload) {
  const unique = Array.from(new Set(userIds)).filter(Boolean);
  return Promise.all(unique.map((userId) => create({ ...payload, userId })));
}

async function listForUser(userId, { unreadOnly = false, limit = 50 } = {}) {
  const clauses = ['user_id = $1'];
  const params = [userId];
  if (unreadOnly) clauses.push('is_read = FALSE');
  params.push(limit);
  const res = await pool.query(
    `SELECT * FROM notifications WHERE ${clauses.join(' AND ')} ORDER BY created_at DESC LIMIT $${params.length}`,
    params
  );
  return res.rows.map(mapRow);
}

async function unreadCount(userId) {
  const res = await pool.query('SELECT count(*) AS n FROM notifications WHERE user_id = $1 AND is_read = FALSE', [userId]);
  return Number(res.rows[0].n);
}

async function markRead(id, userId) {
  await pool.query('UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2', [id, userId]);
}

async function markAllRead(userId) {
  await pool.query('UPDATE notifications SET is_read = TRUE WHERE user_id = $1 AND is_read = FALSE', [userId]);
}

async function remove(id, userId) {
  await pool.query('DELETE FROM notifications WHERE id = $1 AND user_id = $2', [id, userId]);
}

module.exports = { create, createMany, listForUser, unreadCount, markRead, markAllRead, remove };
