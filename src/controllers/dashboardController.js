const ticketModel = require('../models/ticketModel');
const userModel = require('../models/userModel');
const categoryModel = require('../models/categoryModel');
const projectModel = require('../models/projectModel');
const milestoneModel = require('../models/milestoneModel');
const { buildBarData, buildPriorityDonut } = require('../utils/chartData');
const { dashboardPathForRole } = require('../utils/roleRouting');
const { PRIORITIES } = require('../config/constants');

async function index(req, res) {
  if (userModel.isStaff(req.user)) {
    return res.redirect(dashboardPathForRole(req.user.role));
  }

  const categories = await categoryModel.listNames();
  const tickets = await ticketModel.listVisibleTo(req.user, { archived: false });
  const stats = ticketModel.computeStats(tickets, categories);
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

  const projects = await projectModel.list(req.user, {});
  const activeProjectsCount = projects.filter((p) => !['Completed', 'Cancelled', 'Archived'].includes(p.status)).length;
  const completedProjectsCount = projects.filter((p) => p.status === 'Completed').length;
  const recentProjects = projects.slice(0, 5);
  const milestonesByProject = {};
  await Promise.all(recentProjects.map(async (p) => {
    milestonesByProject[p.id] = await milestoneModel.listForProject(p.id);
  }));
  const recentProjectsWithProgress = recentProjects.map((p) => ({
    ...p,
    progress: projectModel.computeProgress(milestonesByProject[p.id] || []),
  }));

  res.render('dashboard/index', {
    title: 'Dashboard',
    tickets,
    openTickets,
    awaitingResponse,
    resolvedTickets,
    highPriorityTickets,
    recentTickets,
    recentActivity,
    activeProjectsCount,
    completedProjectsCount,
    recentProjects: recentProjectsWithProgress,
    priorityChart: buildPriorityDonut(stats.byPriority, PRIORITIES),
    categoryChart: buildBarData(stats.byCategory, categories),
    pageScripts: ['charts'],
  });
}

module.exports = { index };
