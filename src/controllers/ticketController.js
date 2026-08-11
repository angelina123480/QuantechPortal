const ticketModel = require('../models/ticketModel');
const userModel = require('../models/userModel');
const { uploadAttachments } = require('../middleware/upload');
const { setFlash } = require('../utils/flash');
const { CATEGORIES, PRIORITIES, STATUSES } = require('../config/constants');

function wantsJson(req) {
  return req.xhr || req.get('X-Requested-With') === 'fetch' || (req.get('Accept') || '').includes('application/json');
}

async function serializeTicket(ticket) {
  const relatedIds = ticket.history.map((h) => h.authorId).filter(Boolean);
  if (ticket.assignedTechnicianId) relatedIds.push(ticket.assignedTechnicianId);
  const users = await userModel.findByIds(relatedIds);
  const usersById = Object.fromEntries(users.map((u) => [u.id, u]));

  return {
    ...ticket,
    isOverdue: ticketModel.isOverdue(ticket),
    assignedTechnician: ticket.assignedTechnicianId ? usersById[ticket.assignedTechnicianId] || null : null,
    history: ticket.history.map((h) => ({
      ...h,
      isStaffAuthor: h.authorId && usersById[h.authorId] ? userModel.isStaff(usersById[h.authorId]) : false,
    })),
  };
}

async function serializeTickets(tickets) {
  return Promise.all(tickets.map(serializeTicket));
}

async function list(req, res) {
  const tickets = await serializeTickets(await ticketModel.listVisibleTo(req.user));
  res.render('tickets/list', {
    title: 'My Tickets',
    tickets,
    categories: CATEGORIES,
    priorities: PRIORITIES,
    statuses: STATUSES,
  });
}

function showCreateForm(req, res) {
  res.render('tickets/create', {
    title: 'Create Ticket',
    categories: CATEGORIES,
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

function validateCreate(body) {
  const errors = {};
  if (!body.title || !body.title.trim()) errors.title = 'Title is required.';
  else if (body.title.trim().length > 150) errors.title = 'Title must be under 150 characters.';
  if (!body.description || !body.description.trim()) errors.description = 'Description is required.';
  if (!CATEGORIES.includes(body.category)) errors.category = 'Please select a valid category.';
  if (!PRIORITIES.includes(body.priority)) errors.priority = 'Please select a valid priority.';
  if (!body.contactEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.contactEmail)) {
    errors.contactEmail = 'A valid contact email is required.';
  }
  return errors;
}

async function create(req, res) {
  const errors = validateCreate(req.body);

  if (Object.keys(errors).length > 0) {
    return res.status(400).render('tickets/create', {
      title: 'Create Ticket',
      categories: CATEGORIES,
      priorities: PRIORITIES,
      errors,
      formData: req.body,
    });
  }

  const attachments = await uploadAttachments(req.files);
  const ticket = await ticketModel.create(req.body, req.user, attachments);
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

  res.render('tickets/detail', {
    title: `${ticket.ticketNumber} · ${ticket.title}`,
    ticket: await serializeTicket(ticket),
    technicians: await userModel.listTechnicians(),
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
  await ticketModel.addReply(ticket, req.user, message, { internal });

  if (wantsJson(req)) return res.json({ ticket: await serializeTicket(ticket) });
  res.redirect(`/tickets/${ticket.id}`);
}

async function updateStatus(req, res) {
  const ticket = await loadTicketOr404(req, res);
  if (!ticket) return;
  if (!userModel.isStaff(req.user)) return res.status(403).end();

  await ticketModel.changeStatus(ticket, req.user, req.body.status);
  if (wantsJson(req)) return res.json({ ticket: await serializeTicket(ticket) });
  setFlash(req, 'success', `Status updated to ${ticket.status}.`);
  res.redirect(`/tickets/${ticket.id}`);
}

async function updatePriority(req, res) {
  const ticket = await loadTicketOr404(req, res);
  if (!ticket) return;
  if (!userModel.isStaff(req.user)) return res.status(403).end();

  await ticketModel.changePriority(ticket, req.user, req.body.priority);
  if (wantsJson(req)) return res.json({ ticket: await serializeTicket(ticket) });
  setFlash(req, 'success', `Priority updated to ${ticket.priority}.`);
  res.redirect(`/tickets/${ticket.id}`);
}

async function assign(req, res) {
  const ticket = await loadTicketOr404(req, res);
  if (!ticket) return;
  if (!userModel.isStaff(req.user)) return res.status(403).end();

  await ticketModel.assignTechnician(ticket, req.user, req.body.technicianId || null);
  if (wantsJson(req)) return res.json({ ticket: await serializeTicket(ticket) });
  setFlash(req, 'success', 'Technician assignment updated.');
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
  }
  res.json({ tickets: await serializeTickets(tickets) });
}

async function bulkStatus(req, res) {
  const tickets = await loadOwnedTickets(req, req.body.ticketIds);
  for (const ticket of tickets) {
    await ticketModel.changeStatus(ticket, req.user, req.body.status);
  }
  res.json({ tickets: await serializeTickets(tickets) });
}

async function close(req, res) {
  const ticket = await loadTicketOr404(req, res);
  if (!ticket) return;
  if (userModel.isStaff(req.user)) return res.status(403).end();

  await ticketModel.closeTicket(ticket, req.user);
  if (wantsJson(req)) return res.json({ ticket: await serializeTicket(ticket) });
  setFlash(req, 'success', 'Ticket closed. Thanks for confirming!');
  res.redirect(`/tickets/${ticket.id}`);
}

async function reopen(req, res) {
  const ticket = await loadTicketOr404(req, res);
  if (!ticket) return;
  if (userModel.isStaff(req.user)) return res.status(403).end();

  await ticketModel.reopenTicket(ticket, req.user);
  if (wantsJson(req)) return res.json({ ticket: await serializeTicket(ticket) });
  setFlash(req, 'success', 'Ticket reopened. QuanTech has been notified.');
  res.redirect(`/tickets/${ticket.id}`);
}

module.exports = {
  list,
  showCreateForm,
  create,
  detail,
  reply,
  updateStatus,
  updatePriority,
  assign,
  bulkAssign,
  bulkStatus,
  close,
  reopen,
};
