const ticketModel = require('../models/ticketModel');
const userModel = require('../models/userModel');
const categoryModel = require('../models/categoryModel');
const slaEngine = require('../services/slaEngine');
const { buildBarData, buildStatusDonut } = require('../utils/chartData');
const { toCsv } = require('../utils/csv');
const { PRIORITIES, STATUSES } = require('../config/constants');

async function technicianLookup(tickets) {
  const ids = tickets.map((t) => t.assignedTechnicianId).filter(Boolean);
  const users = await userModel.findByIds(ids);
  return Object.fromEntries(users.map((u) => [u.id, u]));
}

async function dashboard(req, res) {
  const categories = await categoryModel.listNames();
  const tickets = await ticketModel.listVisibleTo(req.user, { archived: false });
  await slaEngine.sweep(tickets);
  const stats = ticketModel.computeStats(tickets, categories);
  const techniciansById = await technicianLookup(tickets);

  const overdueTickets = tickets
    .filter((t) => ticketModel.isOverdue(t))
    .map((t) => ({ ...t, assignedTechnician: t.assignedTechnicianId ? techniciansById[t.assignedTechnicianId] || null : null }))
    .sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt));
  const technicians = await userModel.listTechnicians();

  const ticketsWithMeta = tickets.map((t) => ({
    ...t,
    isOverdue: ticketModel.isOverdue(t),
    assignedTechnician: t.assignedTechnicianId ? techniciansById[t.assignedTechnicianId] || null : null,
  }));

  const recentActivity = tickets
    .flatMap((t) => t.history.map((h) => ({ ...h, ticket: t })))
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, 10);

  res.render('admin/dashboard', {
    title: 'Admin Dashboard',
    tickets: ticketsWithMeta,
    stats,
    overdueTickets,
    technicians,
    recentActivity,
    categories,
    priorities: PRIORITIES,
    statuses: STATUSES,
    statusChart: buildStatusDonut(stats.byStatus, STATUSES),
    categoryChart: buildBarData(stats.byCategory, categories),
    priorityChart: buildBarData(stats.byPriority, PRIORITIES),
    pageScripts: ['charts', 'admin'],
  });
}

async function exportCsv(req, res) {
  const { status, priority, category, technician, q } = req.query;
  const filters = { status, priority, category, search: q };
  if (technician === '__unassigned') filters.unassignedOnly = true;
  else if (technician) filters.assignedTechnicianId = technician;

  const tickets = await ticketModel.listVisibleTo(req.user, filters);
  const techniciansById = await technicianLookup(tickets);

  const csv = toCsv(tickets, [
    { label: 'Ticket Number', value: (t) => t.ticketNumber },
    { label: 'Title', value: (t) => t.title },
    { label: 'Company', value: (t) => t.company },
    { label: 'Client Department', value: (t) => t.clientDepartment },
    { label: 'Category', value: (t) => t.category },
    { label: 'Priority', value: (t) => t.priority },
    { label: 'Status', value: (t) => t.status },
    { label: 'Assigned Technician', value: (t) => (t.assignedTechnicianId && techniciansById[t.assignedTechnicianId] ? techniciansById[t.assignedTechnicianId].name : 'Unassigned') },
    { label: 'Contact Name', value: (t) => t.contactName },
    { label: 'Contact Email', value: (t) => t.contactEmail },
    { label: 'Created At', value: (t) => new Date(t.createdAt).toISOString() },
    { label: 'Updated At', value: (t) => new Date(t.updatedAt).toISOString() },
    { label: 'SLA Due', value: (t) => new Date(t.dueAt).toISOString() },
    { label: 'Overdue', value: (t) => (ticketModel.isOverdue(t) ? 'Yes' : 'No') },
  ]);

  const filename = `quantech-tickets-${new Date().toISOString().slice(0, 10)}.csv`;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
}

module.exports = { dashboard, exportCsv };
