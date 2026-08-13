const companyModel = require('../../models/companyModel');
const teamModel = require('../../models/teamModel');
const userModel = require('../../models/userModel');
const ticketModel = require('../../models/ticketModel');
const subClientModel = require('../../models/subClientModel');
const auditLogger = require('../../services/auditLogger');
const { setFlash } = require('../../utils/flash');

async function index(req, res) {
  const [companies, teams] = await Promise.all([companyModel.list(), teamModel.list()]);
  const teamsById = Object.fromEntries(teams.map((t) => [t.id, t]));
  res.render('admin/companies', {
    title: 'Companies',
    companies: companies.map((c) => ({ ...c, teamName: c.teamId && teamsById[c.teamId] ? teamsById[c.teamId].name : null })),
    teams, errors: null, formData: {},
  });
}

async function create(req, res) {
  const { name, contactName, contactEmail, contactPhone, industry, teamId } = req.body;
  if (!name || !name.trim()) {
    const [companies, teams] = await Promise.all([companyModel.list(), teamModel.list()]);
    return res.status(400).render('admin/companies', { title: 'Companies', companies, teams, errors: { form: 'Company name is required.' }, formData: req.body });
  }
  if (await companyModel.findByName(name)) {
    const [companies, teams] = await Promise.all([companyModel.list(), teamModel.list()]);
    return res.status(400).render('admin/companies', { title: 'Companies', companies, teams, errors: { form: 'A company with that name already exists.' }, formData: req.body });
  }
  await companyModel.create({ name, contactName, contactEmail, contactPhone, industry, teamId: teamId || null });
  await auditLogger.log({ user: req.user, action: 'company.create', entityType: 'company', entityId: name, req });
  setFlash(req, 'success', `${name} was created.`);
  res.redirect('/admin/companies');
}

async function update(req, res) {
  const name = decodeURIComponent(req.params.name);
  const { contactName, contactEmail, contactPhone, industry, teamId } = req.body;
  const updated = await companyModel.update(name, { contactName, contactEmail, contactPhone, industry, teamId: teamId || null });
  if (!updated) return res.status(404).render('errors/404', { title: 'Not found' });
  await auditLogger.log({ user: req.user, action: 'company.update', entityType: 'company', entityId: name, req });
  setFlash(req, 'success', 'Company updated.');
  res.redirect('/admin/companies');
}

async function show(req, res) {
  const name = decodeURIComponent(req.params.name);
  const company = await companyModel.findByName(name);
  if (!company) return res.status(404).render('errors/404', { title: 'Not found' });

  const [roster, tickets, teams, subClients] = await Promise.all([
    userModel.listAll({ company: name }),
    ticketModel.listVisibleTo(req.user, { company: name }),
    teamModel.list(),
    subClientModel.list(name),
  ]);
  const team = teams.find((t) => t.id === company.teamId) || null;
  const activeTickets = tickets.filter((t) => ['Open', 'In Progress', 'Waiting for Client', 'Escalated'].includes(t.status));
  const resolvedTickets = tickets.filter((t) => ['Resolved', 'Closed'].includes(t.status));

  res.render('admin/company-detail', {
    title: company.name, company, team, roster, tickets, activeTickets, resolvedTickets, subClients,
  });
}

async function createSubClient(req, res) {
  const name = decodeURIComponent(req.params.name);
  const company = await companyModel.findByName(name);
  if (!company) return res.status(404).render('errors/404', { title: 'Not found' });

  const { name: subName, contactName, contactEmail, contactPhone } = req.body;
  if (!subName || !subName.trim()) {
    setFlash(req, 'error', 'Sub-client name is required.');
    return res.redirect(`/admin/companies/${encodeURIComponent(name)}`);
  }
  const existing = await subClientModel.list(name);
  if (existing.some((s) => s.name.toLowerCase() === subName.trim().toLowerCase())) {
    setFlash(req, 'error', 'A sub-client with that name already exists for this company.');
    return res.redirect(`/admin/companies/${encodeURIComponent(name)}`);
  }

  const subClient = await subClientModel.create({ parentCompany: name, name: subName.trim(), contactName, contactEmail, contactPhone });
  await auditLogger.log({ user: req.user, action: 'sub_client.create', entityType: 'sub_client', entityId: subClient.id, after: { parentCompany: name, name: subName }, req });
  setFlash(req, 'success', `${subClient.name} was created.`);
  res.redirect(`/admin/companies/${encodeURIComponent(name)}`);
}

module.exports = { index, create, update, show, createSubClient };
