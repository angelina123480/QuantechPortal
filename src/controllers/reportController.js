const ticketModel = require('../models/ticketModel');
const userModel = require('../models/userModel');
const companyModel = require('../models/companyModel');
const categoryModel = require('../models/categoryModel');
const teamModel = require('../models/teamModel');
const auditLogger = require('../services/auditLogger');
const { toCsv } = require('../utils/csv');
const { buildTablePdf } = require('../utils/pdf');
const { ROLES, PRIORITIES, STATUSES } = require('../config/constants');

async function buildFilters(req) {
  const { dateFrom, dateTo, company, category, priority, status, agentId } = req.query;
  const filters = {};
  if (dateFrom) filters.dateFrom = new Date(dateFrom);
  if (dateTo) filters.dateTo = new Date(new Date(dateTo).getTime() + 24 * 60 * 60 * 1000 - 1);
  if (company) filters.company = company;
  if (category) filters.category = category;
  if (priority) filters.priority = priority;
  if (status) filters.status = status;
  if (agentId) filters.assignedTechnicianId = agentId;

  if (req.user.role === ROLES.TEAM_LEADER) {
    const team = await teamModel.findByLeadUserId(req.user.id);
    filters.teamId = team ? team.id : '__none__';
  }
  return filters;
}

async function loadFormOptions() {
  const [companies, categories, agents] = await Promise.all([companyModel.list(), categoryModel.listNames(), userModel.listTechnicians()]);
  return { companies, categories, agents, priorities: PRIORITIES, statuses: STATUSES };
}

async function index(req, res) {
  const filters = await buildFilters(req);
  const tickets = await ticketModel.listVisibleTo(req.user, filters);
  const stats = ticketModel.computeStats(tickets, await categoryModel.listNames());
  const options = await loadFormOptions();
  const agentIds = tickets.map((t) => t.assignedTechnicianId).filter(Boolean);
  const agentsById = Object.fromEntries((await userModel.findByIds(agentIds)).map((a) => [a.id, a]));

  res.render('reports/index', {
    title: 'Reports',
    tickets: tickets.map((t) => ({ ...t, isOverdue: ticketModel.isOverdue(t), assignedTechnician: t.assignedTechnicianId ? agentsById[t.assignedTechnicianId] : null })),
    stats,
    ...options,
    query: req.query,
  });
}

function reportColumns(agentsById) {
  return [
    { label: 'Ticket #', value: (t) => t.ticketNumber },
    { label: 'Title', value: (t) => t.title },
    { label: 'Company', value: (t) => t.company },
    { label: 'Category', value: (t) => t.category },
    { label: 'Priority', value: (t) => t.priority },
    { label: 'Status', value: (t) => t.status },
    { label: 'Agent', value: (t) => (t.assignedTechnicianId && agentsById[t.assignedTechnicianId] ? agentsById[t.assignedTechnicianId].name : 'Unassigned') },
    { label: 'Created', value: (t) => new Date(t.createdAt).toISOString().slice(0, 10) },
    { label: 'Resolved', value: (t) => (t.resolvedAt ? new Date(t.resolvedAt).toISOString().slice(0, 10) : '') },
  ];
}

async function exportCsv(req, res) {
  const filters = await buildFilters(req);
  const tickets = await ticketModel.listVisibleTo(req.user, filters);
  const agentIds = tickets.map((t) => t.assignedTechnicianId).filter(Boolean);
  const agentsById = Object.fromEntries((await userModel.findByIds(agentIds)).map((a) => [a.id, a]));

  const csv = toCsv(tickets, reportColumns(agentsById));
  await auditLogger.log({ user: req.user, action: 'report.export_csv', entityType: 'report', req });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="quantech-report-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send(csv);
}

async function exportPdf(req, res) {
  const filters = await buildFilters(req);
  const tickets = await ticketModel.listVisibleTo(req.user, filters);
  const stats = ticketModel.computeStats(tickets, await categoryModel.listNames());
  const agentIds = tickets.map((t) => t.assignedTechnicianId).filter(Boolean);
  const agentsById = Object.fromEntries((await userModel.findByIds(agentIds)).map((a) => [a.id, a]));

  const filterSummary = Object.entries(req.query).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join('  |  ') || 'No filters applied';

  const pdfBuffer = await buildTablePdf({
    title: 'QuanTech Support Portal — Ticket Report',
    subtitle: `Generated ${new Date().toLocaleString('en-GB')} by ${req.user.name}  |  ${filterSummary}`,
    columns: reportColumns(agentsById),
    rows: tickets,
    footerLines: [
      `Total: ${stats.total}  |  Overdue: ${stats.overdueCount}  |  Avg. resolution: ${stats.avgResolutionHours !== null ? stats.avgResolutionHours + 'h' : 'n/a'}`,
    ],
  });

  await auditLogger.log({ user: req.user, action: 'report.export_pdf', entityType: 'report', req });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="quantech-report-${new Date().toISOString().slice(0, 10)}.pdf"`);
  res.send(pdfBuffer);
}

module.exports = { index, exportCsv, exportPdf };
