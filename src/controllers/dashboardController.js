const ticketModel = require('../models/ticketModel');
const userModel = require('../models/userModel');
const { buildBarData, buildPriorityDonut } = require('../utils/chartData');
const { CATEGORIES, PRIORITIES } = require('../config/constants');

function index(req, res) {
  if (userModel.isStaff(req.user)) {
    return res.redirect('/admin');
  }

  const tickets = ticketModel.listVisibleTo(req.user);
  const stats = ticketModel.computeStats(tickets);
  const openTickets = tickets.filter((t) => t.status === 'Open');
  const awaitingResponse = tickets.filter((t) => t.status === 'Waiting for Client');
  const resolvedTickets = tickets.filter((t) => ['Resolved', 'Closed'].includes(t.status));
  const highPriorityTickets = tickets.filter(
    (t) => ['High', 'Critical'].includes(t.priority) && !['Resolved', 'Closed'].includes(t.status)
  );

  const recentTickets = tickets.slice(0, 5).map((t) => ({
    ...t,
    isOverdue: ticketModel.isOverdue(t),
  }));
  const recentActivity = tickets
    .flatMap((t) => t.history.map((h) => ({ ...h, ticket: t })))
    .filter((h) => !h.internal)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, 8);

  res.render('dashboard/index', {
    title: 'Dashboard',
    tickets,
    openTickets,
    awaitingResponse,
    resolvedTickets,
    highPriorityTickets,
    recentTickets,
    recentActivity,
    priorityChart: buildPriorityDonut(stats.byPriority, PRIORITIES),
    categoryChart: buildBarData(stats.byCategory, CATEGORIES),
    pageScripts: ['charts'],
  });
}

module.exports = { index };
