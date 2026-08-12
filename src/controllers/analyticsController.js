const ticketModel = require('../models/ticketModel');
const userModel = require('../models/userModel');
const teamModel = require('../models/teamModel');
const categoryModel = require('../models/categoryModel');
const ticketRatingModel = require('../models/ticketRatingModel');
const slaPolicyModel = require('../models/slaPolicyModel');
const slaEngine = require('../services/slaEngine');
const { buildBarData, buildStatusDonut, buildPriorityDonut, buildTicketsOverTime } = require('../utils/chartData');
const { ROLES, PRIORITIES, STATUSES } = require('../config/constants');

async function resolveScope(req) {
  if (req.user.role === ROLES.ADMIN) {
    const teamId = req.query.teamId || null;
    return { teamId, allTeams: await teamModel.list() };
  }
  const team = await teamModel.findByLeadUserId(req.user.id);
  return { teamId: team ? team.id : null, allTeams: [] };
}

async function index(req, res) {
  const { teamId, allTeams } = await resolveScope(req);
  const categories = await categoryModel.listNames();
  const filters = teamId ? { teamId } : {};
  const tickets = await ticketModel.listVisibleTo(req.user, filters);
  const stats = ticketModel.computeStats(tickets, categories);

  const policies = await slaPolicyModel.asMap();
  const slaCounts = { responseMet: 0, responseBreached: 0, resolutionMet: 0, resolutionBreached: 0 };
  for (const t of tickets) {
    const s = slaEngine.evaluate(t, policies[t.priority]);
    if (s.responseStatus === 'met') slaCounts.responseMet += 1;
    if (s.responseStatus === 'breached') slaCounts.responseBreached += 1;
    if (t.resolvedAt && s.resolutionStatus !== 'breached') slaCounts.resolutionMet += 1;
    if (s.resolutionStatus === 'breached') slaCounts.resolutionBreached += 1;
  }

  let agents;
  if (teamId) {
    agents = await userModel.listByTeam(teamId);
  } else {
    agents = await userModel.listTechnicians();
  }
  const workloadCounts = {};
  for (const a of agents) workloadCounts[a.name] = 0;
  for (const t of tickets) {
    if (t.assignedTechnicianId) {
      const agent = agents.find((a) => a.id === t.assignedTechnicianId);
      if (agent) workloadCounts[agent.name] = (workloadCounts[agent.name] || 0) + 1;
    }
  }

  const ratingStats = await ticketRatingModel.stats(tickets.map((t) => t.id));

  res.render('analytics/index', {
    title: 'Analytics',
    scope: teamId ? (allTeams.find((t) => t.id === teamId) || {}).name : (req.user.role === ROLES.ADMIN ? 'All Teams' : 'Your Team'),
    allTeams,
    teamId,
    stats,
    ratingStats,
    slaCounts,
    statusChart: buildStatusDonut(stats.byStatus, STATUSES),
    priorityChart: buildPriorityDonut(stats.byPriority, PRIORITIES),
    categoryChart: buildBarData(stats.byCategory, categories),
    workloadChart: buildBarData(workloadCounts, Object.keys(workloadCounts)),
    trendChart: buildTicketsOverTime(tickets, 30),
    slaChart: buildBarData(
      { 'Response met': slaCounts.responseMet, 'Response breached': slaCounts.responseBreached, 'Resolution met': slaCounts.resolutionMet, 'Resolution breached': slaCounts.resolutionBreached },
      ['Response met', 'Response breached', 'Resolution met', 'Resolution breached']
    ),
    pageScripts: ['charts'],
  });
}

module.exports = { index };
