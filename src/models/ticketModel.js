const { v4: uuidv4 } = require('uuid');
const pool = require('../data/db');
const userModel = require('./userModel');
const {
  STATUSES,
  OPEN_STATUSES,
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
    subcategoryId: row.subcategory_id,
    priority: row.priority,
    status: row.status,
    affectedService: row.affected_service,
    company: row.company,
    clientDepartment: row.client_department,
    contactName: row.contact_name,
    contactEmail: row.contact_email,
    contactPhone: row.contact_phone,
    clientUserId: row.client_user_id,
    assignedTechnicianId: row.assigned_technician_id,
    teamId: row.team_id,
    dueAt: row.due_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    resolvedAt: row.resolved_at,
    closedAt: row.closed_at,
    firstResponseAt: row.first_response_at,
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
    uploadedBy: row.uploaded_by,
    internal: row.internal,
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

function buildFilterClauses(user, filters) {
  const clauses = [];
  const params = [];

  function addClause(sql, value) {
    params.push(value);
    clauses.push(sql.replace('?', `$${params.length}`));
  }

  if (!userModel.isStaff(user)) {
    addClause('company = ?', user.company);
  }

  if (filters.status) addClause('status = ?', filters.status);
  if (filters.priority) addClause('priority = ?', filters.priority);
  if (filters.category) addClause('category = ?', filters.category);
  if (filters.company) addClause('company = ?', filters.company);
  if (filters.teamId) addClause('team_id = ?', filters.teamId);
  if (filters.assignedTechnicianId) addClause('assigned_technician_id = ?', filters.assignedTechnicianId);
  if (filters.unassignedOnly) clauses.push('assigned_technician_id IS NULL');
  if (filters.overdueOnly) {
    addClause('status = ANY(?)', OPEN_STATUSES);
    clauses.push('due_at < now()');
  }
  if (filters.dateFrom) addClause('created_at >= ?', filters.dateFrom);
  if (filters.dateTo) addClause('created_at <= ?', filters.dateTo);
  if (filters.search) {
    const q = `%${filters.search.trim().toLowerCase()}%`;
    params.push(q);
    const p = `$${params.length}`;
    clauses.push(`(lower(ticket_number) LIKE ${p} OR lower(title) LIKE ${p} OR lower(description) LIKE ${p} OR lower(company) LIKE ${p})`);
  }

  return { where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', params };
}

/**
 * Returns tickets visible to `user`, optionally filtered. History is always
 * populated (dashboards flatten it for the activity feed); attachments are
 * not, since no list view needs them — only ticket detail does, via findById.
 * filters: { status, priority, category, search, assignedTechnicianId, company,
 *   teamId, overdueOnly, unassignedOnly, dateFrom, dateTo, page, pageSize }
 * When filters.page is set, returns { tickets, total, page, pageSize } instead
 * of a bare array.
 */
async function listVisibleTo(user, filters = {}) {
  const { where, params } = buildFilterClauses(user, filters);

  if (filters.page) {
    const pageSize = filters.pageSize || 25;
    const page = Math.max(1, filters.page);
    const countRes = await pool.query(`SELECT count(*) AS n FROM tickets ${where}`, params);
    const total = Number(countRes.rows[0].n);
    const pagedParams = [...params, pageSize, (page - 1) * pageSize];
    const res = await pool.query(
      `SELECT * FROM tickets ${where} ORDER BY updated_at DESC LIMIT $${pagedParams.length - 1} OFFSET $${pagedParams.length}`,
      pagedParams
    );
    const tickets = await attachHistoryAndAttachments(res.rows.map(mapTicketRow));
    return { tickets, total, page, pageSize };
  }

  const res = await pool.query(`SELECT * FROM tickets ${where} ORDER BY updated_at DESC`, params);
  const tickets = res.rows.map(mapTicketRow);
  return attachHistoryAndAttachments(tickets);
}

async function nextTicketNumber() {
  const res = await pool.query("SELECT nextval('ticket_number_seq') AS n");
  const year = new Date().getFullYear();
  return `QNT-${year}-${String(res.rows[0].n).padStart(5, '0')}`;
}

/**
 * data.category is trusted here (validated by the controller against
 * categoryModel.list()); category/subcategory/team resolution against the
 * DB-backed catalog happens above this layer.
 */
async function create(data, clientUser, attachments = []) {
  const id = uuidv4();
  const now = new Date();
  const priority = PRIORITIES.includes(data.priority) ? data.priority : 'Medium';
  const category = data.category || 'Other';
  const ticketNumber = await nextTicketNumber();
  const dueAt = new Date(now.getTime() + SLA_HOURS_BY_PRIORITY[priority] * 60 * 60 * 1000);

  await pool.query(
    `INSERT INTO tickets (
       id, ticket_number, title, description, category, subcategory_id, priority, status,
       affected_service, company, client_department, contact_name, contact_email, contact_phone,
       client_user_id, assigned_technician_id, team_id, due_at, created_at, updated_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,'Open',$8,$9,$10,$11,$12,$13,$14,NULL,$15,$16,$17,$17)`,
    [
      id, ticketNumber, data.title, data.description, category, data.subcategoryId || null, priority,
      data.affectedService || category, clientUser.company, data.clientDepartment || clientUser.department,
      data.contactName || clientUser.name, data.contactEmail || clientUser.email, data.contactPhone || clientUser.phone,
      clientUser.id, data.teamId || null, dueAt, now,
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
        `INSERT INTO attachments (filename, ticket_id, original_name, size, mime_type, url, uploaded_at, uploaded_by, internal)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,false)`,
        [file.filename, id, file.originalName, file.size, file.mimeType, file.url, file.uploadedAt, clientUser.id]
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

async function addReply(ticket, author, message, { internal = false, attachments = [] } = {}) {
  await insertHistory(ticket, { type: internal ? 'note' : 'reply', author, message, internal });
  ticket.updatedAt = new Date();

  const isFirstAgentResponse = !internal && userModel.isStaff(author) && !ticket.firstResponseAt;
  if (isFirstAgentResponse) ticket.firstResponseAt = ticket.updatedAt;

  await pool.query(
    'UPDATE tickets SET updated_at = $1, first_response_at = COALESCE(first_response_at, $2) WHERE id = $3',
    [ticket.updatedAt, isFirstAgentResponse ? ticket.updatedAt : null, ticket.id]
  );

  for (const file of attachments) {
    await pool.query(
      `INSERT INTO attachments (filename, ticket_id, original_name, size, mime_type, url, uploaded_at, uploaded_by, internal)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [file.filename, ticket.id, file.originalName, file.size, file.mimeType, file.url, file.uploadedAt, author.id, internal]
    );
    ticket.attachments.push({ ...file, uploadedBy: author.id, internal });
  }

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

async function assignTeam(ticket, author, teamId) {
  ticket.teamId = teamId || null;
  ticket.updatedAt = new Date();
  await pool.query('UPDATE tickets SET team_id = $1, updated_at = $2 WHERE id = $3', [ticket.teamId, ticket.updatedAt, ticket.id]);
  await insertHistory(ticket, { type: 'assigned', author, message: teamId ? 'Routed to a new team' : 'Team unassigned' });
  return ticket;
}

async function escalate(ticket, author, note) {
  return changeStatus(ticket, author, 'Escalated');
}

async function closeTicket(ticket, author) {
  if (ticket.status !== 'Resolved') return ticket;
  return changeStatus(ticket, author, 'Closed');
}

async function reopenTicket(ticket, author) {
  if (!['Resolved', 'Closed'].includes(ticket.status)) return ticket;
  return changeStatus(ticket, author, 'Open');
}

function computeStats(tickets, categories = []) {
  const stats = {
    total: tickets.length,
    byStatus: Object.fromEntries(STATUSES.map((s) => [s, 0])),
    byPriority: Object.fromEntries(PRIORITIES.map((p) => [p, 0])),
    byCategory: Object.fromEntries(categories.map((c) => [c, 0])),
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
  assignTeam,
  escalate,
  closeTicket,
  reopenTicket,
  computeStats,
  canAccess,
  isOverdue,
  insertHistory,
};
