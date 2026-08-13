const ticketModel = require('../models/ticketModel');
const taskModel = require('../models/taskModel');
const projectModel = require('../models/projectModel');
const categoryModel = require('../models/categoryModel');
const slaEngine = require('../services/slaEngine');
const { buildBarData, buildPriorityDonut } = require('../utils/chartData');
const { PRIORITIES, TASK_OPEN_STATUSES } = require('../config/constants');

async function dashboard(req, res) {
  const categories = await categoryModel.listNames();
  const myTickets = await ticketModel.listVisibleTo(req.user, { assignedTechnicianId: req.user.id, archived: false });
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

  const myTasks = await taskModel.list({ assignedToId: req.user.id });
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const openTasks = myTasks.filter((t) => TASK_OPEN_STATUSES.includes(t.status));
  const overdueTasks = openTasks.filter((t) => t.dueDate && new Date(t.dueDate) < startOfToday);
  const dueTodayTasks = openTasks.filter((t) => t.dueDate && new Date(t.dueDate) >= startOfToday && new Date(t.dueDate) < endOfToday);
  const recentTasks = openTasks.slice(0, 6);

  const projectIds = [...new Set(recentTasks.map((t) => t.projectId).filter(Boolean))];
  const projects = (await Promise.all(projectIds.map((id) => projectModel.findById(id)))).filter(Boolean);
  const projectById = Object.fromEntries(projects.map((p) => [p.id, p]));

  res.render('agent/dashboard', {
    title: 'Agent Dashboard',
    stats,
    openTickets,
    overdueTickets,
    recentTickets,
    recentActivity,
    openTasks,
    overdueTasks,
    dueTodayTasks,
    recentTasks,
    projectById,
    priorityChart: buildPriorityDonut(stats.byPriority, PRIORITIES),
    categoryChart: buildBarData(stats.byCategory, categories),
    pageScripts: ['charts'],
  });
}

module.exports = { dashboard };
