const store = require('../data/store');
const userModel = require('./userModel');
const {
  STATUSES,
  OPEN_STATUSES,
  CATEGORIES,
  PRIORITIES,
  SLA_HOURS_BY_PRIORITY,
} = require('../config/constants');

function nextHistoryId() {
  const id = `h${store.nextHistorySeq}`;
  store.nextHistorySeq += 1;
  return id;
}

function pushHistory(ticket, entry) {
  const record = {
    id: nextHistoryId(),
    type: entry.type,
    authorId: entry.author ? entry.author.id : null,
    authorName: entry.author ? entry.author.name : 'System',
    authorRole: entry.author ? entry.author.role : 'system',
    message: entry.message || null,
    fromStatus: entry.fromStatus || null,
    toStatus: entry.toStatus || null,
    fromPriority: entry.fromPriority || null,
    toPriority: entry.toPriority || null,
    internal: !!entry.internal,
    timestamp: new Date(),
  };
  ticket.history.push(record);
  return record;
}

function findById(id) {
  return store.tickets.find((t) => t.id === id) || null;
}

function findByTicketNumber(ticketNumber) {
  return store.tickets.find((t) => t.ticketNumber === ticketNumber) || null;
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
 * Returns tickets visible to `user`, optionally filtered.
 * filters: { status, priority, category, search, assignedTechnicianId, company, overdueOnly }
 */
function listVisibleTo(user, filters = {}) {
  let list = userModel.isStaff(user)
    ? store.tickets.slice()
    : store.tickets.filter((t) => t.company === user.company);

  if (filters.status) list = list.filter((t) => t.status === filters.status);
  if (filters.priority) list = list.filter((t) => t.priority === filters.priority);
  if (filters.category) list = list.filter((t) => t.category === filters.category);
  if (filters.company) list = list.filter((t) => t.company === filters.company);
  if (filters.assignedTechnicianId) {
    list = list.filter((t) => t.assignedTechnicianId === filters.assignedTechnicianId);
  }
  if (filters.unassignedOnly) list = list.filter((t) => !t.assignedTechnicianId);
  if (filters.overdueOnly) list = list.filter((t) => isOverdue(t));
  if (filters.search) {
    const q = filters.search.trim().toLowerCase();
    list = list.filter((t) =>
      t.title.toLowerCase().includes(q) ||
      t.ticketNumber.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.company.toLowerCase().includes(q)
    );
  }

  return list.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

function create(data, clientUser, attachments = []) {
  const id = `t${store.nextTicketSeq}`;
  store.nextTicketSeq += 1;
  const now = new Date();
  const priority = PRIORITIES.includes(data.priority) ? data.priority : 'Medium';
  const category = CATEGORIES.includes(data.category) ? data.category : 'Other';

  const ticket = {
    id,
    ticketNumber: store.generateTicketNumber(now),
    title: data.title,
    description: data.description,
    category,
    priority,
    status: 'Open',
    affectedService: data.affectedService || category,
    company: clientUser.company,
    department: data.department || clientUser.department,
    contactName: data.contactName || clientUser.name,
    contactEmail: data.contactEmail || clientUser.email,
    contactPhone: data.contactPhone || clientUser.phone,
    clientUserId: clientUser.id,
    assignedTechnicianId: null,
    attachments,
    dueAt: new Date(now.getTime() + SLA_HOURS_BY_PRIORITY[priority] * 60 * 60 * 1000),
    createdAt: now,
    updatedAt: now,
    resolvedAt: null,
    closedAt: null,
    history: [],
  };

  pushHistory(ticket, { type: 'created', author: clientUser, message: data.description });
  store.tickets.push(ticket);
  return ticket;
}

function addReply(ticket, author, message, { internal = false } = {}) {
  pushHistory(ticket, { type: internal ? 'note' : 'reply', author, message, internal });
  ticket.updatedAt = new Date();
  return ticket;
}

function changeStatus(ticket, author, newStatus) {
  if (!STATUSES.includes(newStatus) || newStatus === ticket.status) return ticket;
  const fromStatus = ticket.status;
  ticket.status = newStatus;
  ticket.updatedAt = new Date();

  if (newStatus === 'Resolved') {
    ticket.resolvedAt = ticket.updatedAt;
    ticket.closedAt = null;
  } else if (newStatus === 'Closed') {
    ticket.closedAt = ticket.updatedAt;
    if (!ticket.resolvedAt) ticket.resolvedAt = ticket.updatedAt;
  } else if (OPEN_STATUSES.includes(newStatus)) {
    ticket.resolvedAt = null;
    ticket.closedAt = null;
  }

  pushHistory(ticket, { type: 'status_change', author, fromStatus, toStatus: newStatus });
  return ticket;
}

function changePriority(ticket, author, newPriority) {
  if (!PRIORITIES.includes(newPriority) || newPriority === ticket.priority) return ticket;
  const fromPriority = ticket.priority;
  ticket.priority = newPriority;
  ticket.dueAt = new Date(ticket.createdAt.getTime() + SLA_HOURS_BY_PRIORITY[newPriority] * 60 * 60 * 1000);
  ticket.updatedAt = new Date();
  pushHistory(ticket, { type: 'priority_change', author, fromPriority, toPriority: newPriority });
  return ticket;
}

function assignTechnician(ticket, author, technicianId) {
  const technician = technicianId ? userModel.findById(technicianId) : null;
  ticket.assignedTechnicianId = technician ? technician.id : null;
  ticket.updatedAt = new Date();
  pushHistory(ticket, {
    type: 'assigned',
    author,
    message: technician ? `Assigned to ${technician.name}` : 'Unassigned',
  });
  if (ticket.status === 'Open' && technician) {
    changeStatus(ticket, author, 'In Progress');
  }
  return ticket;
}

function closeTicket(ticket, author) {
  if (ticket.status !== 'Resolved') return ticket;
  return changeStatus(ticket, author, 'Closed');
}

function reopenTicket(ticket, author) {
  if (!['Resolved', 'Closed'].includes(ticket.status)) return ticket;
  return changeStatus(ticket, author, 'Open');
}

function addAttachments(ticket, files) {
  ticket.attachments.push(...files);
  ticket.updatedAt = new Date();
  return ticket;
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
  findByTicketNumber,
  listVisibleTo,
  create,
  addReply,
  changeStatus,
  changePriority,
  assignTechnician,
  closeTicket,
  reopenTicket,
  addAttachments,
  computeStats,
  canAccess,
  isOverdue,
};
