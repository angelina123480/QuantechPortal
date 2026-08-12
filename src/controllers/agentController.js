const ticketModel = require('../models/ticketModel');
const categoryModel = require('../models/categoryModel');
const slaEngine = require('../services/slaEngine');
const { buildBarData, buildPriorityDonut } = require('../utils/chartData');
const { PRIORITIES } = require('../config/constants');

async function dashboard(req, res) {
  const categories = await categoryModel.listNames();
  const myTickets = await ticketModel.listVisibleTo(req.user, { assignedTechnicianId: req.user.id });
  await slaEngine.sweep(myTickets);
  const stats = ticketModel.computeStats(myTickets, categories);

  const openTickets = myTickets.filter((t) => ['Open', 'In Progress', 'Waiting for Client', 'Escalated'].includes(t.status));
  const overdueTickets = myTickets
    .filter((t) => ticketModel.isOverdue(t))
    .sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt));
  const recentTickets = myTickets.slice(0, 6).map((t) => ({ ...t, isOverdue: ticketModel.isOverdue(t) }));
  const recentActivity = myTickets
    .flatMap((t) => t.history.map((h) => ({ ...h, ticket: t })))
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, 8);

  res.render('agent/dashboard', {
    title: 'Agent Dashboard',
    stats,
    openTickets,
    overdueTickets,
    recentTickets,
    recentActivity,
    priorityChart: buildPriorityDonut(stats.byPriority, PRIORITIES),
    categoryChart: buildBarData(stats.byCategory, categories),
    pageScripts: ['charts'],
  });
}

module.exports = { dashboard };
