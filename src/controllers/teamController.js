const ticketModel = require('../models/ticketModel');
const userModel = require('../models/userModel');
const teamModel = require('../models/teamModel');
const categoryModel = require('../models/categoryModel');
const escalationModel = require('../models/escalationModel');
const slaEngine = require('../services/slaEngine');
const slaPolicyModel = require('../models/slaPolicyModel');
const auditLogger = require('../services/auditLogger');
const { setFlash } = require('../utils/flash');
const { buildBarData, buildStatusDonut } = require('../utils/chartData');
const { ROLES, PRIORITIES, STATUSES } = require('../config/constants');

// Team leaders see the team they lead; agents see their own team read-only;
// admins don't lead a team but can inspect any team's view via ?teamId=.
async function resolveTeam(req) {
  if (req.user.role === ROLES.ADMIN) return req.query.teamId ? teamModel.findById(req.query.teamId) : null;
  if (req.user.role === ROLES.AGENT) return req.user.teamId ? teamModel.findById(req.user.teamId) : null;
  return teamModel.findByLeadUserId(req.user.id);
}

async function dashboard(req, res) {
  const team = await resolveTeam(req);
  const allTeams = req.user.role === 'admin' ? await teamModel.list() : [];

  if (!team) {
    return res.render('team/dashboard', {
      title: 'Team Dashboard', team: null, allTeams, members: [], workload: [], stats: null,
      tickets: [], overdueTickets: [], recentActivity: [], statusChart: null, categoryChart: null,
      pageScripts: [],
    });
  }

  const categories = await categoryModel.listNames();
  const members = await userModel.listByTeam(team.id);
  const tickets = await ticketModel.listVisibleTo(req.user, { teamId: team.id, archived: false });
  await slaEngine.sweep(tickets);
  const stats = ticketModel.computeStats(tickets, categories);

  const membersById = Object.fromEntries(members.map((m) => [m.id, m]));
  const ticketsWithMeta = tickets.map((t) => ({
    ...t,
    isOverdue: ticketModel.isOverdue(t),
    assignedTechnician: t.assignedTechnicianId ? membersById[t.assignedTechnicianId] || null : null,
  }));
  const overdueTickets = ticketsWithMeta.filter((t) => t.isOverdue).sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt));
  const recentActivity = tickets
    .flatMap((t) => t.history.map((h) => ({ ...h, ticket: t })))
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, 10);

  const workload = members.map((m) => ({
    agent: m,
    openCount: ticketsWithMeta.filter((t) => t.assignedTechnicianId === m.id && ['Open', 'In Progress', 'Waiting for Client', 'Escalated'].includes(t.status)).length,
    overdueCount: ticketsWithMeta.filter((t) => t.assignedTechnicianId === m.id && t.isOverdue).length,
  }));

  res.render('team/dashboard', {
    title: 'Team Dashboard',
    team,
    allTeams,
    members,
    workload,
    stats,
    tickets: ticketsWithMeta,
    overdueTickets,
    recentActivity,
    statusChart: buildStatusDonut(stats.byStatus, STATUSES),
    categoryChart: buildBarData(stats.byCategory, categories),
    pageScripts: ['charts'],
  });
}

async function sla(req, res) {
  const team = await resolveTeam(req);
  const allTeams = req.user.role === ROLES.ADMIN ? await teamModel.list() : [];
  if (!team) {
    return res.render('team/sla', { title: 'SLA Monitoring', team: null, allTeams, rows: [] });
  }

  const tickets = await ticketModel.listVisibleTo(req.user, { teamId: team.id, archived: false });
  await slaEngine.sweep(tickets);
  const openTickets = tickets.filter((t) => ['Open', 'In Progress', 'Waiting for Client', 'Escalated'].includes(t.status));
  const policies = await slaPolicyModel.asMap();
  const members = await userModel.listByTeam(team.id);
  const membersById = Object.fromEntries(members.map((m) => [m.id, m]));

  const rows = openTickets
    .map((t) => ({
      ticket: t,
      assignedTechnician: t.assignedTechnicianId ? membersById[t.assignedTechnicianId] || null : null,
      sla: slaEngine.evaluate(t, policies[t.priority]),
    }))
    .sort((a, b) => b.sla.resolutionPercentUsed - a.sla.resolutionPercentUsed);

  res.render('team/sla', { title: 'SLA Monitoring', team, allTeams, rows });
}

async function escalations(req, res) {
  const team = await resolveTeam(req);
  const allTeams = req.user.role === ROLES.ADMIN ? await teamModel.list() : [];
  if (!team) {
    return res.render('team/escalations', { title: 'Escalations', team: null, allTeams, items: [] });
  }

  const list = await escalationModel.listForTeam(team.id, { unresolvedOnly: req.query.all !== '1' });
  const ticketIds = [...new Set(list.map((e) => e.ticketId))];
  const tickets = await Promise.all(ticketIds.map((id) => ticketModel.findById(id)));
  const ticketsById = Object.fromEntries(tickets.filter(Boolean).map((t) => [t.id, t]));
  const escalatorIds = [...new Set(list.map((e) => e.escalatedBy).filter(Boolean))];
  const escalators = await userModel.findByIds(escalatorIds);
  const escalatorsById = Object.fromEntries(escalators.map((u) => [u.id, u]));

  const items = list
    .map((e) => ({ ...e, ticket: ticketsById[e.ticketId], escalatedByUser: e.escalatedBy ? escalatorsById[e.escalatedBy] : null }))
    .filter((e) => e.ticket);

  res.render('team/escalations', { title: 'Escalations', team, allTeams, items, showAll: req.query.all === '1' });
}

async function resolveEscalation(req, res) {
  await escalationModel.resolve(req.params.id);
  await auditLogger.log({ user: req.user, action: 'escalation.resolve', entityType: 'escalation', entityId: req.params.id, req });
  setFlash(req, 'success', 'Escalation marked as resolved.');
  res.redirect('/escalations');
}

module.exports = { dashboard, resolveTeam, sla, escalations, resolveEscalation };
