const ticketModel = require('../models/ticketModel');
const userModel = require('../models/userModel');
const { toAttachmentRecord } = require('../middleware/upload');
const { setFlash } = require('../utils/flash');
const { CATEGORIES, PRIORITIES, STATUSES } = require('../config/constants');

function wantsJson(req) {
  return req.xhr || req.get('X-Requested-With') === 'fetch' || (req.get('Accept') || '').includes('application/json');
}

function serializeTicket(ticket) {
  return {
    ...ticket,
    isOverdue: ticketModel.isOverdue(ticket),
    assignedTechnician: ticket.assignedTechnicianId ? userModel.findById(ticket.assignedTechnicianId) : null,
    history: ticket.history.map((h) => {
      const author = h.authorId ? userModel.findById(h.authorId) : null;
      return { ...h, isStaffAuthor: author ? userModel.isStaff(author) : false };
    }),
  };
}

function list(req, res) {
  const tickets = ticketModel.listVisibleTo(req.user).map(serializeTicket);
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

function create(req, res) {
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

  const attachments = (req.files || []).map(toAttachmentRecord);
  const ticket = ticketModel.create(req.body, req.user, attachments);
  setFlash(req, 'success', `Ticket ${ticket.ticketNumber} was submitted successfully.`);
  res.redirect(`/tickets/${ticket.id}?created=1`);
}

function loadTicketOr404(req, res) {
  const ticket = ticketModel.findById(req.params.id);
  if (!ticket || !ticketModel.canAccess(req.user, ticket)) {
    res.status(404).render('errors/404', { title: 'Ticket not found' });
    return null;
  }
  return ticket;
}

function detail(req, res) {
  const ticket = loadTicketOr404(req, res);
  if (!ticket) return;

  res.render('tickets/detail', {
    title: `${ticket.ticketNumber} · ${ticket.title}`,
    ticket: serializeTicket(ticket),
    technicians: userModel.listTechnicians(),
    statuses: STATUSES,
    priorities: PRIORITIES,
    justCreated: req.query.created === '1',
  });
}

function reply(req, res) {
  const ticket = loadTicketOr404(req, res);
  if (!ticket) return;

  const message = (req.body.message || '').trim();
  if (!message) {
    if (wantsJson(req)) return res.status(400).json({ error: 'Message cannot be empty.' });
    setFlash(req, 'error', 'Message cannot be empty.');
    return res.redirect(`/tickets/${ticket.id}`);
  }

  const internal = userModel.isStaff(req.user) && req.body.internal === 'on';
  ticketModel.addReply(ticket, req.user, message, { internal });

  if (wantsJson(req)) return res.json({ ticket: serializeTicket(ticket) });
  res.redirect(`/tickets/${ticket.id}`);
}

function updateStatus(req, res) {
  const ticket = loadTicketOr404(req, res);
  if (!ticket) return;
  if (!userModel.isStaff(req.user)) return res.status(403).end();

  ticketModel.changeStatus(ticket, req.user, req.body.status);
  if (wantsJson(req)) return res.json({ ticket: serializeTicket(ticket) });
  setFlash(req, 'success', `Status updated to ${ticket.status}.`);
  res.redirect(`/tickets/${ticket.id}`);
}

function updatePriority(req, res) {
  const ticket = loadTicketOr404(req, res);
  if (!ticket) return;
  if (!userModel.isStaff(req.user)) return res.status(403).end();

  ticketModel.changePriority(ticket, req.user, req.body.priority);
  if (wantsJson(req)) return res.json({ ticket: serializeTicket(ticket) });
  setFlash(req, 'success', `Priority updated to ${ticket.priority}.`);
  res.redirect(`/tickets/${ticket.id}`);
}

function assign(req, res) {
  const ticket = loadTicketOr404(req, res);
  if (!ticket) return;
  if (!userModel.isStaff(req.user)) return res.status(403).end();

  ticketModel.assignTechnician(ticket, req.user, req.body.technicianId || null);
  if (wantsJson(req)) return res.json({ ticket: serializeTicket(ticket) });
  setFlash(req, 'success', 'Technician assignment updated.');
  res.redirect(`/tickets/${ticket.id}`);
}

function close(req, res) {
  const ticket = loadTicketOr404(req, res);
  if (!ticket) return;
  if (userModel.isStaff(req.user)) return res.status(403).end();

  ticketModel.closeTicket(ticket, req.user);
  if (wantsJson(req)) return res.json({ ticket: serializeTicket(ticket) });
  setFlash(req, 'success', 'Ticket closed. Thanks for confirming!');
  res.redirect(`/tickets/${ticket.id}`);
}

function reopen(req, res) {
  const ticket = loadTicketOr404(req, res);
  if (!ticket) return;
  if (userModel.isStaff(req.user)) return res.status(403).end();

  ticketModel.reopenTicket(ticket, req.user);
  if (wantsJson(req)) return res.json({ ticket: serializeTicket(ticket) });
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
  close,
  reopen,
};
