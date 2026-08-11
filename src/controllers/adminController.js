const ticketModel = require('../models/ticketModel');
const userModel = require('../models/userModel');
const { buildBarData, buildStatusDonut } = require('../utils/chartData');
const { CATEGORIES, PRIORITIES, STATUSES } = require('../config/constants');

function dashboard(req, res) {
  const tickets = ticketModel.listVisibleTo(req.user);
  const stats = ticketModel.computeStats(tickets);
  const overdueTickets = tickets
    .filter((t) => ticketModel.isOverdue(t))
    .map((t) => ({ ...t, assignedTechnician: t.assignedTechnicianId ? userModel.findById(t.assignedTechnicianId) : null }))
    .sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt));
  const technicians = userModel.listTechnicians();

  const ticketsWithMeta = tickets.map((t) => ({
    ...t,
    isOverdue: ticketModel.isOverdue(t),
    assignedTechnician: t.assignedTechnicianId ? userModel.findById(t.assignedTechnicianId) : null,
  }));

  const recentActivity = tickets
    .flatMap((t) => t.history.map((h) => ({ ...h, ticket: t })))
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, 10);

  res.render('admin/dashboard', {
    title: 'Technician Dashboard',
    tickets: ticketsWithMeta,
    stats,
    overdueTickets,
    technicians,
    recentActivity,
    categories: CATEGORIES,
    priorities: PRIORITIES,
    statuses: STATUSES,
    statusChart: buildStatusDonut(stats.byStatus, STATUSES),
    categoryChart: buildBarData(stats.byCategory, CATEGORIES),
    priorityChart: buildBarData(stats.byPriority, PRIORITIES),
    pageScripts: ['charts', 'admin'],
  });
}

module.exports = { dashboard };
