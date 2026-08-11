const { v4: uuidv4 } = require('uuid');
const pool = require('../data/db');
const userModel = require('./userModel');
const {
  STATUSES,
  OPEN_STATUSES,
  CATEGORIES,
  PRIORITIES,
  SLA_HOURS_BY_PRIORITY,
} = require('../config/constants');

function mapTicketRow(row) {
  return {
    id: row.id,
    ticketNumber: row.ticket_number,
    title: row.title,
    description: row.description,
    category: row.category,
    priority: row.priority,
    status: row.status,
    affectedService: row.affected_service,
    company: row.company,
    department: row.department,
    contactName: row.contact_name,
    contactEmail: row.contact_email,
    contactPhone: row.contact_phone,
    clientUserId: row.client_user_id,
    assignedTechnicianId: row.assigned_technician_id,
    dueAt: row.due_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    resolvedAt: row.resolved_at,
    closedAt: row.closed_at,
    attachments: [],
    history: [],
  };
}

function mapHistoryRow(row) {
  return {
    id: row.id,
    type: row.type,
    authorId: row.author_id,
    authorName: row.author_name,
    authorRole: row.author_role,
    message: row.message,
    fromStatus: row.from_status,
    toStatus: row.to_status,
    fromPriority: row.from_priority,
    toPriority: row.to_priority,
    internal: row.internal,
    timestamp: row.occurred_at,
  };
}

function mapAttachmentRow(row) {
  return {
    filename: row.filename,
    originalName: row.original_name,
    size: row.size,
    mimeType: row.mime_type,
    uploadedAt: row.uploaded_at,
    url: row.url,
  };
}

async function attachHistoryAndAttachments(tickets) {
  if (tickets.length === 0) return tickets;
  const ids = tickets.map((t) => t.id);

  const [historyRes, attachmentsRes] = await Promise.all([
    pool.query('SELECT * FROM ticket_history WHERE ticket_id = ANY($1) ORDER BY occurred_at ASC', [ids]),
    pool.query('SELECT * FROM attachments WHERE ticket_id = ANY($1) ORDER BY uploaded_at ASC', [ids]),
  ]);

  const historyByTicket = {};
  for (const row of historyRes.rows) {
    (historyByTicket[row.ticket_id] = historyByTicket[row.ticket_id] || []).push(mapHistoryRow(row));
  }
  const attachmentsByTicket = {};
  for (const row of attachmentsRes.rows) {
    (attachmentsByTicket[row.ticket_id] = attachmentsByTicket[row.ticket_id] || []).push(mapAttachmentRow(row));
  }

  for (const ticket of tickets) {
    ticket.history = historyByTicket[ticket.id] || [];
    ticket.attachments = attachmentsByTicket[ticket.id] || [];
  }
  return tickets;
}

async function findById(id) {
  const res = await pool.query('SELECT * FROM tickets WHERE id = $1', [id]);
  if (res.rows.length === 0) return null;
  const [ticket] = await attachHistoryAndAttachments([mapTicketRow(res.rows[0])]);
  return ticket;
}

function canAccess(user, ticket) {
  if (!user || !ticket) return false;
  if (userModel.isStaff(user)) return true;
  return ticket.company === user.company;
}

function isOverdue(ticket) {
  if (!OPEN_STATUSES.includes(ticket.status)) return false;
  return Date.now() > new Date(ticket.dueAt).getTime();
}

/**
 * Returns tickets visible to `user`, optionally filtered. History is always
 * populated (dashboards flatten it for the activity feed); attachments are
 * not, since no list view needs them — only ticket detail does, via findById.
 * filters: { status, priority, category, search, assignedTechnicianId, company, overdueOnly, unassignedOnly }
 */
async function listVisibleTo(user, filters = {}) {
  const clauses = [];
  const params = [];

  function addClause(sql, value) {
    params.push(value);
    clauses.push(sql.replace('?', `$${params.length}`));
  }

  if (userModel.isStaff(user)) {
    // no company restriction
  } else {
    addClause('company = ?', user.company);
  }

  if (filters.status) addClause('status = ?', filters.status);
  if (filters.priority) addClause('priority = ?', filters.priority);
  if (filters.category) addClause('category = ?', filters.category);
  if (filters.company) addClause('company = ?', filters.company);
  if (filters.assignedTechnicianId) addClause('assigned_technician_id = ?', filters.assignedTechnicianId);
  if (filters.unassignedOnly) clauses.push('assigned_technician_id IS NULL');
  if (filters.overdueOnly) {
    addClause('status = ANY(?)', OPEN_STATUSES);
    clauses.push('due_at < now()');
  }
  if (filters.search) {
    const q = `%${filters.search.trim().toLowerCase()}%`;
    params.push(q);
    const p = `$${params.length}`;
    clauses.push(`(lower(ticket_number) LIKE ${p} OR lower(title) LIKE ${p} OR lower(description) LIKE ${p} OR lower(company) LIKE ${p})`);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const res = await pool.query(`SELECT * FROM tickets ${where} ORDER BY updated_at DESC`, params);
  const tickets = res.rows.map(mapTicketRow);
  return attachHistoryAndAttachments(tickets);
}

async function nextTicketNumber() {
  const res = await pool.query("SELECT nextval('ticket_number_seq') AS n");
  const year = new Date().getFullYear();
  return `QNT-${year}-${String(res.rows[0].n).padStart(5, '0')}`;
}

async function create(data, clientUser, attachments = []) {
  const id = uuidv4();
  const now = new Date();
  const priority = PRIORITIES.includes(data.priority) ? data.priority : 'Medium';
  const category = CATEGORIES.includes(data.category) ? data.category : 'Other';
  const ticketNumber = await nextTicketNumber();
  const dueAt = new Date(now.getTime() + SLA_HOURS_BY_PRIORITY[priority] * 60 * 60 * 1000);

  await pool.query(
    `INSERT INTO tickets (
       id, ticket_number, title, description, category, priority, status,
       affected_service, company, department, contact_name, contact_email, contact_phone,
       client_user_id, assigned_technician_id, due_at, created_at, updated_at
     ) VALUES ($1,$2,$3,$4,$5,$6,'Open',$7,$8,$9,$10,$11,$12,$13,NULL,$14,$15,$15)`,
    [
      id, ticketNumber, data.title, data.description, category, priority,
      data.affectedService || category, clientUser.company, data.department || clientUser.department,
      data.contactName || clientUser.name, data.contactEmail || clientUser.email, data.contactPhone || clientUser.phone,
      clientUser.id, dueAt, now,
    ]
  );

  const historyId = uuidv4();
  await pool.query(
    `INSERT INTO ticket_history (id, ticket_id, type, author_id, author_name, author_role, message, internal, occurred_at)
     VALUES ($1,$2,'created',$3,$4,$5,$6,false,$7)`,
    [historyId, id, clientUser.id, clientUser.name, clientUser.role, data.description, now]
  );

  if (attachments.length > 0) {
    for (const file of attachments) {
      await pool.query(
        `INSERT INTO attachments (filename, ticket_id, original_name, size, mime_type, url, uploaded_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [file.filename, id, file.originalName, file.size, file.mimeType, file.url, file.uploadedAt]
      );
    }
  }

  return findById(id);
}

async function insertHistory(ticket, entry) {
  const id = uuidv4();
  const timestamp = new Date();
  await pool.query(
    `INSERT INTO ticket_history (id, ticket_id, type, author_id, author_name, author_role, message, from_status, to_status, from_priority, to_priority, internal, occurred_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
    [
      id, ticket.id, entry.type,
      entry.author ? entry.author.id : null,
      entry.author ? entry.author.name : 'System',
      entry.author ? entry.author.role : 'system',
      entry.message || null, entry.fromStatus || null, entry.toStatus || null,
      entry.fromPriority || null, entry.toPriority || null, !!entry.internal, timestamp,
    ]
  );
  const record = {
    id, type: entry.type,
    authorId: entry.author ? entry.author.id : null,
    authorName: entry.author ? entry.author.name : 'System',
    authorRole: entry.author ? entry.author.role : 'system',
    message: entry.message || null,
    fromStatus: entry.fromStatus || null,
    toStatus: entry.toStatus || null,
    fromPriority: entry.fromPriority || null,
    toPriority: entry.toPriority || null,
    internal: !!entry.internal,
    timestamp,
  };
  ticket.history.push(record);
  return record;
}

async function addReply(ticket, author, message, { internal = false } = {}) {
  await insertHistory(ticket, { type: internal ? 'note' : 'reply', author, message, internal });
  ticket.updatedAt = new Date();
  await pool.query('UPDATE tickets SET updated_at = $1 WHERE id = $2', [ticket.updatedAt, ticket.id]);
  return ticket;
}

async function changeStatus(ticket, author, newStatus) {
  if (!STATUSES.includes(newStatus) || newStatus === ticket.status) return ticket;
  const fromStatus = ticket.status;
  const now = new Date();

  ticket.status = newStatus;
  ticket.updatedAt = now;

  if (newStatus === 'Resolved') {
    ticket.resolvedAt = now;
    ticket.closedAt = null;
  } else if (newStatus === 'Closed') {
    ticket.closedAt = now;
    if (!ticket.resolvedAt) ticket.resolvedAt = now;
  } else if (OPEN_STATUSES.includes(newStatus)) {
    ticket.resolvedAt = null;
    ticket.closedAt = null;
  }

  await pool.query(
    'UPDATE tickets SET status = $1, updated_at = $2, resolved_at = $3, closed_at = $4 WHERE id = $5',
    [ticket.status, ticket.updatedAt, ticket.resolvedAt, ticket.closedAt, ticket.id]
  );
  await insertHistory(ticket, { type: 'status_change', author, fromStatus, toStatus: newStatus });
  return ticket;
}

async function changePriority(ticket, author, newPriority) {
  if (!PRIORITIES.includes(newPriority) || newPriority === ticket.priority) return ticket;
  const fromPriority = ticket.priority;
  ticket.priority = newPriority;
  ticket.dueAt = new Date(new Date(ticket.createdAt).getTime() + SLA_HOURS_BY_PRIORITY[newPriority] * 60 * 60 * 1000);
  ticket.updatedAt = new Date();

  await pool.query(
    'UPDATE tickets SET priority = $1, due_at = $2, updated_at = $3 WHERE id = $4',
    [ticket.priority, ticket.dueAt, ticket.updatedAt, ticket.id]
  );
  await insertHistory(ticket, { type: 'priority_change', author, fromPriority, toPriority: newPriority });
  return ticket;
}

async function assignTechnician(ticket, author, technicianId) {
  const technician = technicianId ? await userModel.findById(technicianId) : null;
  ticket.assignedTechnicianId = technician ? technician.id : null;
  ticket.updatedAt = new Date();

  await pool.query(
    'UPDATE tickets SET assigned_technician_id = $1, updated_at = $2 WHERE id = $3',
    [ticket.assignedTechnicianId, ticket.updatedAt, ticket.id]
  );
  await insertHistory(ticket, {
    type: 'assigned',
    author,
    message: technician ? `Assigned to ${technician.name}` : 'Unassigned',
  });

  if (ticket.status === 'Open' && technician) {
    await changeStatus(ticket, author, 'In Progress');
  }
  return ticket;
}

async function closeTicket(ticket, author) {
  if (ticket.status !== 'Resolved') return ticket;
  return changeStatus(ticket, author, 'Closed');
}

async function reopenTicket(ticket, author) {
  if (!['Resolved', 'Closed'].includes(ticket.status)) return ticket;
  return changeStatus(ticket, author, 'Open');
}

function computeStats(tickets) {
  const stats = {
    total: tickets.length,
    byStatus: Object.fromEntries(STATUSES.map((s) => [s, 0])),
    byPriority: Object.fromEntries(PRIORITIES.map((p) => [p, 0])),
    byCategory: Object.fromEntries(CATEGORIES.map((c) => [c, 0])),
    overdueCount: 0,
    highPriorityOpenCount: 0,
    avgResolutionHours: null,
  };

  let resolutionTotalHours = 0;
  let resolutionCount = 0;

  for (const t of tickets) {
    stats.byStatus[t.status] = (stats.byStatus[t.status] || 0) + 1;
    stats.byPriority[t.priority] = (stats.byPriority[t.priority] || 0) + 1;
    stats.byCategory[t.category] = (stats.byCategory[t.category] || 0) + 1;
    if (isOverdue(t)) stats.overdueCount += 1;
    if (OPEN_STATUSES.includes(t.status) && (t.priority === 'High' || t.priority === 'Critical')) {
      stats.highPriorityOpenCount += 1;
    }
    if (t.resolvedAt) {
      resolutionTotalHours += (new Date(t.resolvedAt) - new Date(t.createdAt)) / (1000 * 60 * 60);
      resolutionCount += 1;
    }
  }

  if (resolutionCount > 0) {
    stats.avgResolutionHours = Math.round((resolutionTotalHours / resolutionCount) * 10) / 10;
  }

  return stats;
}

module.exports = {
  findById,
  listVisibleTo,
  create,
  addReply,
  changeStatus,
  changePriority,
  assignTechnician,
  closeTicket,
  reopenTicket,
  computeStats,
  canAccess,
  isOverdue,
};
