const pool = require('../data/db');
const ticketModel = require('../models/ticketModel');
const userModel = require('../models/userModel');
const categoryModel = require('../models/categoryModel');
const teamModel = require('../models/teamModel');
const escalationModel = require('../models/escalationModel');
const ticketRatingModel = require('../models/ticketRatingModel');
const ticketLinkModel = require('../models/ticketLinkModel');
const cannedResponseModel = require('../models/cannedResponseModel');
const assignmentEngine = require('../services/assignmentEngine');
const notificationService = require('../services/notificationService');
const auditLogger = require('../services/auditLogger');
const slaEngine = require('../services/slaEngine');
const slaPolicyModel = require('../models/slaPolicyModel');
const { uploadAttachments } = require('../middleware/upload');
const { setFlash } = require('../utils/flash');
const { PRIORITIES, STATUSES, ESCALATION_REASONS } = require('../config/constants');

function wantsJson(req) {
  return req.xhr || req.get('X-Requested-With') === 'fetch' || (req.get('Accept') || '').includes('application/json');
}

async function serializeTicket(ticket) {
  const relatedIds = ticket.history.map((h) => h.authorId).filter(Boolean);
  if (ticket.assignedTechnicianId) relatedIds.push(ticket.assignedTechnicianId);
  const [users, rating, links] = await Promise.all([
    userModel.findByIds(relatedIds),
    ticketRatingModel.findByTicketId(ticket.id),
    ticketLinkModel.listForTicket(ticket.id),
  ]);
  const usersById = Object.fromEntries(users.map((u) => [u.id, u]));

  let linkedTickets = [];
  if (links.length) {
    const linkedTicketRows = await Promise.all(links.map((l) => ticketModel.findById(l.linkedTicketId)));
    linkedTickets = links.map((l, i) => ({ ...l, ticket: linkedTicketRows[i] })).filter((l) => l.ticket);
  }

  return {
    ...ticket,
    isOverdue: ticketModel.isOverdue(ticket),
    assignedTechnician: ticket.assignedTechnicianId ? usersById[ticket.assignedTechnicianId] || null : null,
    history: ticket.history.map((h) => ({
      ...h,
      isStaffAuthor: h.authorId && usersById[h.authorId] ? userModel.isStaff(usersById[h.authorId]) : false,
    })),
    rating,
    linkedTickets,
  };
}

async function serializeTickets(tickets) {
  return Promise.all(tickets.map(serializeTicket));
}

async function notifyForNewTicket(ticket, team) {
  if (team && team.leadUserId) {
    await notificationService.notify(team.leadUserId, {
      type: 'ticket_created',
      title: `New ticket: ${ticket.ticketNumber}`,
      body: ticket.title,
      ticketId: ticket.id,
    });
  }
}

async function list(req, res) {
  const categories = await categoryModel.listNames();
  const filters = {
    status: req.query.status || undefined,
    priority: req.query.priority || undefined,
    category: req.query.category || undefined,
    search: req.query.q || undefined,
    page: Math.max(1, Number(req.query.page) || 1),
    pageSize: 25,
  };
  if (req.query.technician === 'me') filters.assignedTechnicianId = req.user.id;
  else if (req.query.technician) filters.assignedTechnicianId = req.query.technician;

  if (req.query.team === 'mine') {
    const myTeam = await teamModel.findByLeadUserId(req.user.id);
    filters.teamId = myTeam ? myTeam.id : req.user.teamId;
  }

  const { tickets: rawTickets, total, page, pageSize } = await ticketModel.listVisibleTo(req.user, filters);
  const tickets = await serializeTickets(rawTickets);
  res.render('tickets/list', {
    title: req.user.role === 'client' ? 'My Tickets' : 'All Tickets',
    tickets,
    categories,
    priorities: PRIORITIES,
    statuses: STATUSES,
    technicians: userModel.isStaff(req.user) ? await userModel.listTechnicians() : [],
    query: req.query,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  });
}

async function showCreateForm(req, res) {
  const categories = await categoryModel.listWithSubcategories();
  res.render('tickets/create', {
    title: 'Create Ticket',
    categories,
    priorities: PRIORITIES,
    errors: null,
    formData: {
      company: req.user.company,
      department: req.user.department,
      contactName: req.user.name,
      contactEmail: req.user.email,
      contactPhone: req.user.phone,
    },
  });
}

async function validateCreate(body, categoryNames) {
  const errors = {};
  if (!body.title || !body.title.trim()) errors.title = 'Title is required.';
  else if (body.title.trim().length > 150) errors.title = 'Title must be under 150 characters.';
  if (!body.description || !body.description.trim()) errors.description = 'Description is required.';
  if (!categoryNames.includes(body.category)) errors.category = 'Please select a valid category.';
  if (!PRIORITIES.includes(body.priority)) errors.priority = 'Please select a valid priority.';
  if (!body.contactEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.contactEmail)) {
    errors.contactEmail = 'A valid contact email is required.';
  }
  return errors;
}

async function create(req, res) {
  const categoriesWithSub = await categoryModel.listWithSubcategories();
  const categoryNames = categoriesWithSub.map((c) => c.name);
  const errors = await validateCreate(req.body, categoryNames);

  if (Object.keys(errors).length > 0) {
    return res.status(400).render('tickets/create', {
      title: 'Create Ticket',
      categories: categoriesWithSub,
      priorities: PRIORITIES,
      errors,
      formData: req.body,
    });
  }

  const routing = await assignmentEngine.resolve({ category: req.body.category, priority: req.body.priority, departmentId: null });
  const attachments = await uploadAttachments(req.files);
  const ticket = await ticketModel.create(
    {
      ...req.body,
      clientDepartment: req.body.department,
      subcategoryId: req.body.subcategoryId || null,
      teamId: routing.teamId,
    },
    req.user,
    attachments
  );

  const team = routing.teamId ? await teamModel.findById(routing.teamId) : null;
  if (routing.agentId) {
    await ticketModel.assignTechnician(ticket, req.user, routing.agentId);
    await notificationService.notify(routing.agentId, {
      type: 'ticket_assigned',
      title: `Ticket assigned: ${ticket.ticketNumber}`,
      body: ticket.title,
      ticketId: ticket.id,
    });
  } else {
    await notifyForNewTicket(ticket, team);
  }
  await auditLogger.log({ user: req.user, action: 'ticket.create', entityType: 'ticket', entityId: ticket.id, after: { status: 'Open', priority: ticket.priority }, req });

  setFlash(req, 'success', `Ticket ${ticket.ticketNumber} was submitted successfully.`);
  res.redirect(`/tickets/${ticket.id}?created=1`);
}

async function loadTicketOr404(req, res) {
  const ticket = await ticketModel.findById(req.params.id);
  if (!ticket || !ticketModel.canAccess(req.user, ticket)) {
    res.status(404).render('errors/404', { title: 'Ticket not found' });
    return null;
  }
  return ticket;
}

async function detail(req, res) {
  const ticket = await loadTicketOr404(req, res);
  if (!ticket) return;

  const policy = await slaPolicyModel.findByPriority(ticket.priority);
  res.render('tickets/detail', {
    title: `${ticket.ticketNumber} · ${ticket.title}`,
    ticket: await serializeTicket(ticket),
    slaState: slaEngine.evaluate(ticket, policy),
    technicians: await userModel.listTechnicians(),
    cannedResponses: userModel.isStaff(req.user) ? await cannedResponseModel.list() : [],
    statuses: STATUSES,
    priorities: PRIORITIES,
    justCreated: req.query.created === '1',
  });
}

async function reply(req, res) {
  const ticket = await loadTicketOr404(req, res);
  if (!ticket) return;

  const message = (req.body.message || '').trim();
  if (!message) {
    if (wantsJson(req)) return res.status(400).json({ error: 'Message cannot be empty.' });
    setFlash(req, 'error', 'Message cannot be empty.');
    return res.redirect(`/tickets/${ticket.id}`);
  }

  const internal = userModel.isStaff(req.user) && req.body.internal === 'on';
  const attachments = await uploadAttachments(req.files);
  await ticketModel.addReply(ticket, req.user, message, { internal, attachments });

  if (!internal) {
    if (userModel.isStaff(req.user)) {
      await notificationService.notify(ticket.clientUserId, {
        type: 'agent_replied', title: `New reply on ${ticket.ticketNumber}`, body: message, ticketId: ticket.id,
      });
    } else if (ticket.assignedTechnicianId) {
      await notificationService.notify(ticket.assignedTechnicianId, {
        type: 'client_replied', title: `Client replied on ${ticket.ticketNumber}`, body: message, ticketId: ticket.id,
      });
    }
  }

  if (wantsJson(req)) return res.json({ ticket: await serializeTicket(ticket) });
  res.redirect(`/tickets/${ticket.id}`);
}

async function updateStatus(req, res) {
  const ticket = await loadTicketOr404(req, res);
  if (!ticket) return;
  if (!userModel.isStaff(req.user)) return res.status(403).end();

  const fromStatus = ticket.status;
  await ticketModel.changeStatus(ticket, req.user, req.body.status);
  if (fromStatus !== ticket.status) {
    const notifyType = ticket.status === 'Resolved' ? 'ticket_resolved' : ticket.status === 'Closed' ? 'ticket_closed' : 'status_changed';
    await notificationService.notify(ticket.clientUserId, {
      type: notifyType, title: `Ticket ${ticket.ticketNumber} is now ${ticket.status}`, body: ticket.title, ticketId: ticket.id,
    });
    await auditLogger.log({ user: req.user, action: 'ticket.status_change', entityType: 'ticket', entityId: ticket.id, before: { status: fromStatus }, after: { status: ticket.status }, req });
  }

  if (wantsJson(req)) return res.json({ ticket: await serializeTicket(ticket) });
  setFlash(req, 'success', `Status updated to ${ticket.status}.`);
  res.redirect(`/tickets/${ticket.id}`);
}

async function updatePriority(req, res) {
  const ticket = await loadTicketOr404(req, res);
  if (!ticket) return;
  if (!userModel.isStaff(req.user)) return res.status(403).end();

  const fromPriority = ticket.priority;
  await ticketModel.changePriority(ticket, req.user, req.body.priority);
  if (fromPriority !== ticket.priority) {
    if (ticket.assignedTechnicianId) {
      await notificationService.notify(ticket.assignedTechnicianId, {
        type: 'priority_changed', title: `Priority changed on ${ticket.ticketNumber}`, body: `Now ${ticket.priority}.`, ticketId: ticket.id,
      });
    }
    await auditLogger.log({ user: req.user, action: 'ticket.priority_change', entityType: 'ticket', entityId: ticket.id, before: { priority: fromPriority }, after: { priority: ticket.priority }, req });
  }

  if (wantsJson(req)) return res.json({ ticket: await serializeTicket(ticket) });
  setFlash(req, 'success', `Priority updated to ${ticket.priority}.`);
  res.redirect(`/tickets/${ticket.id}`);
}

async function assign(req, res) {
  const ticket = await loadTicketOr404(req, res);
  if (!ticket) return;
  if (!userModel.isStaff(req.user)) return res.status(403).end();

  const before = ticket.assignedTechnicianId;
  await ticketModel.assignTechnician(ticket, req.user, req.body.technicianId || null);
  if (ticket.assignedTechnicianId && ticket.assignedTechnicianId !== before) {
    await notificationService.notify(ticket.assignedTechnicianId, {
      type: 'ticket_assigned', title: `Ticket assigned: ${ticket.ticketNumber}`, body: ticket.title, ticketId: ticket.id,
    });
  }
  await auditLogger.log({ user: req.user, action: 'ticket.assign', entityType: 'ticket', entityId: ticket.id, before: { assignedTechnicianId: before }, after: { assignedTechnicianId: ticket.assignedTechnicianId }, req });

  if (wantsJson(req)) return res.json({ ticket: await serializeTicket(ticket) });
  setFlash(req, 'success', 'Assignment updated.');
  res.redirect(`/tickets/${ticket.id}`);
}

async function escalate(req, res) {
  const ticket = await loadTicketOr404(req, res);
  if (!ticket) return;
  if (!userModel.isStaff(req.user)) return res.status(403).end();

  const fromStatus = ticket.status;
  await ticketModel.escalate(ticket, req.user, req.body.note);
  await escalationModel.create({
    ticketId: ticket.id,
    reason: ESCALATION_REASONS.MANUAL,
    escalatedBy: req.user.id,
    escalatedToTeamId: ticket.teamId,
    note: req.body.note || null,
  });

  const team = ticket.teamId ? await teamModel.findById(ticket.teamId) : null;
  const recipients = [team && team.leadUserId, ticket.clientUserId].filter(Boolean);
  await notificationService.notify(recipients, {
    type: 'ticket_escalated', title: `Ticket escalated: ${ticket.ticketNumber}`, body: ticket.title, ticketId: ticket.id,
  });
  await auditLogger.log({ user: req.user, action: 'ticket.escalate', entityType: 'ticket', entityId: ticket.id, before: { status: fromStatus }, after: { status: 'Escalated' }, req });

  if (wantsJson(req)) return res.json({ ticket: await serializeTicket(ticket) });
  setFlash(req, 'success', 'Ticket escalated to the team leader.');
  res.redirect(`/tickets/${ticket.id}`);
}

async function link(req, res) {
  const ticket = await loadTicketOr404(req, res);
  if (!ticket) return;
  if (!userModel.isStaff(req.user)) return res.status(403).end();

  const otherNumber = (req.body.ticketNumber || '').trim();
  const linkType = ['duplicate', 'related', 'parent'].includes(req.body.linkType) ? req.body.linkType : 'related';
  const matches = await pool.query('SELECT id FROM tickets WHERE ticket_number = $1', [otherNumber]);
  if (!matches.rows.length || matches.rows[0].id === ticket.id) {
    setFlash(req, 'error', 'Enter a valid, different ticket number to link.');
    return res.redirect(`/tickets/${ticket.id}`);
  }
  const linkedTicketId = matches.rows[0].id;

  await ticketLinkModel.create({ ticketId: ticket.id, linkedTicketId, linkType, createdBy: req.user.id });

  if (linkType === 'duplicate') {
    const linked = await ticketModel.findById(linkedTicketId);
    await ticketModel.changeStatus(ticket, req.user, 'Closed');
    await ticketModel.insertHistory(ticket, { type: 'status_change', author: req.user, message: `Merged into ${linked.ticketNumber} as a duplicate.`, fromStatus: ticket.status, toStatus: 'Closed' });
  }

  await auditLogger.log({ user: req.user, action: 'ticket.link', entityType: 'ticket', entityId: ticket.id, after: { linkedTicketId, linkType }, req });
  setFlash(req, 'success', 'Tickets linked.');
  res.redirect(`/tickets/${ticket.id}`);
}

async function rate(req, res) {
  const ticket = await loadTicketOr404(req, res);
  if (!ticket) return;
  if (userModel.isStaff(req.user) || ticket.clientUserId !== req.user.id) return res.status(403).end();
  if (!['Resolved', 'Closed'].includes(ticket.status)) {
    setFlash(req, 'error', 'You can only rate a resolved or closed ticket.');
    return res.redirect(`/tickets/${ticket.id}`);
  }

  const stars = Number(req.body.stars);
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
    setFlash(req, 'error', 'Please select a rating between 1 and 5 stars.');
    return res.redirect(`/tickets/${ticket.id}`);
  }

  try {
    await ticketRatingModel.create({ ticketId: ticket.id, clientUserId: req.user.id, stars, feedback: (req.body.feedback || '').trim() || null });
  } catch (err) {
    setFlash(req, 'error', 'This ticket has already been rated.');
    return res.redirect(`/tickets/${ticket.id}`);
  }

  setFlash(req, 'success', 'Thanks for the feedback!');
  res.redirect(`/tickets/${ticket.id}`);
}

async function loadOwnedTickets(req, ticketIds) {
  const ids = Array.isArray(ticketIds) ? ticketIds : [ticketIds].filter(Boolean);
  const tickets = await Promise.all(ids.map((id) => ticketModel.findById(id)));
  return tickets.filter((ticket) => ticket && ticketModel.canAccess(req.user, ticket));
}

async function bulkAssign(req, res) {
  const tickets = await loadOwnedTickets(req, req.body.ticketIds);
  for (const ticket of tickets) {
    await ticketModel.assignTechnician(ticket, req.user, req.body.technicianId || null);
    if (ticket.assignedTechnicianId) {
      await notificationService.notify(ticket.assignedTechnicianId, {
        type: 'ticket_assigned', title: `Ticket assigned: ${ticket.ticketNumber}`, body: ticket.title, ticketId: ticket.id,
      });
    }
  }
  res.json({ tickets: await serializeTickets(tickets) });
}

async function bulkStatus(req, res) {
  const tickets = await loadOwnedTickets(req, req.body.ticketIds);
  for (const ticket of tickets) {
    await ticketModel.changeStatus(ticket, req.user, req.body.status);
    await notificationService.notify(ticket.clientUserId, {
      type: 'status_changed', title: `Ticket ${ticket.ticketNumber} is now ${ticket.status}`, body: ticket.title, ticketId: ticket.id,
    });
  }
  res.json({ tickets: await serializeTickets(tickets) });
}

async function close(req, res) {
  const ticket = await loadTicketOr404(req, res);
  if (!ticket) return;
  if (userModel.isStaff(req.user)) return res.status(403).end();

  await ticketModel.closeTicket(ticket, req.user);
  if (ticket.assignedTechnicianId) {
    await notificationService.notify(ticket.assignedTechnicianId, {
      type: 'ticket_closed', title: `Ticket closed by client: ${ticket.ticketNumber}`, body: ticket.title, ticketId: ticket.id,
    });
  }
  if (wantsJson(req)) return res.json({ ticket: await serializeTicket(ticket) });
  setFlash(req, 'success', 'Ticket closed. Thanks for confirming!');
  res.redirect(`/tickets/${ticket.id}`);
}

async function reopen(req, res) {
  const ticket = await loadTicketOr404(req, res);
  if (!ticket) return;
  if (userModel.isStaff(req.user)) return res.status(403).end();

  await ticketModel.reopenTicket(ticket, req.user);
  if (ticket.assignedTechnicianId) {
    await notificationService.notify(ticket.assignedTechnicianId, {
      type: 'status_changed', title: `Ticket reopened by client: ${ticket.ticketNumber}`, body: ticket.title, ticketId: ticket.id,
    });
  }
  if (wantsJson(req)) return res.json({ ticket: await serializeTicket(ticket) });
  setFlash(req, 'success', 'Ticket reopened. QuanTech has been notified.');
  res.redirect(`/tickets/${ticket.id}`);
}

module.exports = {
  serializeTicket,
  list,
  showCreateForm,
  create,
  detail,
  reply,
  updateStatus,
  updatePriority,
  assign,
  escalate,
  link,
  rate,
  bulkAssign,
  bulkStatus,
  close,
  reopen,
};
