const companyModel = require('../../models/companyModel');
const teamModel = require('../../models/teamModel');
const userModel = require('../../models/userModel');
const ticketModel = require('../../models/ticketModel');
const subClientModel = require('../../models/subClientModel');
const projectModel = require('../../models/projectModel');
const milestoneModel = require('../../models/milestoneModel');
const auditLogger = require('../../services/auditLogger');
const { setFlash } = require('../../utils/flash');

async function index(req, res) {
  const statusFilter = req.query.status === 'inactive' ? false : req.query.status === 'all' ? undefined : true;
  const [companies, teams, userCounts, subClientCounts, projectCounts, ticketCounts] = await Promise.all([
    companyModel.list(statusFilter === undefined ? {} : { isActive: statusFilter }),
    teamModel.list(),
    userModel.countsByCompany(),
    subClientModel.countsByCompany(),
    projectModel.countsByCompany(),
    ticketModel.countsByCompany(),
  ]);
  const teamsById = Object.fromEntries(teams.map((t) => [t.id, t]));
  res.render('admin/companies', {
    title: 'Companies',
    companies: companies.map((c) => ({
      ...c,
      teamName: c.teamId && teamsById[c.teamId] ? teamsById[c.teamId].name : null,
      userCount: userCounts[c.name] || 0,
      subClientCount: subClientCounts[c.name] || 0,
      projectCount: projectCounts[c.name] || 0,
      ticketCount: ticketCounts[c.name] || 0,
    })),
    teams, statusFilter: req.query.status || 'active', errors: null, formData: {},
  });
}

async function create(req, res) {
  const { name, contactName, contactEmail, contactPhone, industry, teamId } = req.body;
  if (!name || !name.trim()) {
    const [companies, teams] = await Promise.all([companyModel.list(), teamModel.list()]);
    return res.status(400).render('admin/companies', { title: 'Companies', companies, teams, statusFilter: 'active', errors: { form: 'Company name is required.' }, formData: req.body });
  }
  if (await companyModel.findByName(name)) {
    const [companies, teams] = await Promise.all([companyModel.list(), teamModel.list()]);
    return res.status(400).render('admin/companies', { title: 'Companies', companies, teams, statusFilter: 'active', errors: { form: 'A company with that name already exists.' }, formData: req.body });
  }
  await companyModel.create({ name, contactName, contactEmail, contactPhone, industry, teamId: teamId || null });
  await auditLogger.log({ user: req.user, action: 'company.create', entityType: 'company', entityId: name, req });
  setFlash(req, 'success', `${name} was created.`);
  res.redirect('/admin/companies');
}

async function update(req, res) {
  const currentName = decodeURIComponent(req.params.name);
  const { name, contactName, contactEmail, contactPhone, industry, teamId } = req.body;
  let targetName = currentName;

  const newName = (name || '').trim();
  if (newName && newName !== currentName) {
    if (await companyModel.findByName(newName)) {
      setFlash(req, 'error', 'A company with that name already exists.');
      return res.redirect(`/admin/companies/${encodeURIComponent(currentName)}`);
    }
    const renamed = await companyModel.rename(currentName, newName);
    if (!renamed) return res.status(404).render('errors/404', { title: 'Not found' });
    await auditLogger.log({ user: req.user, action: 'company.rename', entityType: 'company', entityId: newName, before: { name: currentName }, after: { name: newName }, req });
    targetName = newName;
  }

  const updated = await companyModel.update(targetName, { contactName, contactEmail, contactPhone, industry, teamId: teamId || null });
  if (!updated) return res.status(404).render('errors/404', { title: 'Not found' });
  await auditLogger.log({ user: req.user, action: 'company.update', entityType: 'company', entityId: targetName, req });
  setFlash(req, 'success', 'Company updated.');
  res.redirect(`/admin/companies/${encodeURIComponent(targetName)}`);
}

async function setStatus(req, res) {
  const name = decodeURIComponent(req.params.name);
  if (!(await companyModel.findByName(name))) return res.status(404).render('errors/404', { title: 'Not found' });
  const isActive = req.body.active === '1';
  await companyModel.setActive(name, isActive);
  await auditLogger.log({ user: req.user, action: isActive ? 'company.activate' : 'company.deactivate', entityType: 'company', entityId: name, req });
  setFlash(req, 'success', `${name} was ${isActive ? 'reactivated' : 'deactivated'}.`);
  res.redirect(`/admin/companies/${encodeURIComponent(name)}`);
}

async function show(req, res) {
  const name = decodeURIComponent(req.params.name);
  const company = await companyModel.findByName(name);
  if (!company) return res.status(404).render('errors/404', { title: 'Not found' });

  const [roster, tickets, teams, subClients, projects] = await Promise.all([
    userModel.listAll({ company: name }),
    ticketModel.listVisibleTo(req.user, { company: name }),
    teamModel.list(),
    subClientModel.list(name),
    projectModel.list(req.user, { company: name }),
  ]);
  const team = teams.find((t) => t.id === company.teamId) || null;
  const activeTickets = tickets.filter((t) => ['Open', 'In Progress', 'Waiting for Client', 'Escalated'].includes(t.status));
  const resolvedTickets = tickets.filter((t) => ['Resolved', 'Closed'].includes(t.status));

  const milestonesByProject = {};
  await Promise.all(projects.map(async (p) => {
    milestonesByProject[p.id] = await milestoneModel.listForProject(p.id);
  }));
  const projectsWithProgress = projects.map((p) => ({ ...p, progress: projectModel.computeProgress(milestonesByProject[p.id] || []) }));

  res.render('admin/company-detail', {
    title: company.name, company, team, roster, tickets, activeTickets, resolvedTickets, subClients, projects: projectsWithProgress,
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

async function updateSubClient(req, res) {
  const name = decodeURIComponent(req.params.name);
  const subClient = await subClientModel.findById(req.params.subClientId);
  if (!subClient || subClient.parentCompany !== name) return res.status(404).render('errors/404', { title: 'Not found' });

  const { name: subName, contactName, contactEmail, contactPhone } = req.body;
  if (!subName || !subName.trim()) {
    setFlash(req, 'error', 'Sub-client name is required.');
    return res.redirect(`/admin/companies/${encodeURIComponent(name)}`);
  }
  await subClientModel.update(subClient.id, { name: subName.trim(), contactName, contactEmail, contactPhone });
  await auditLogger.log({ user: req.user, action: 'sub_client.update', entityType: 'sub_client', entityId: subClient.id, req });
  setFlash(req, 'success', `${subName} was updated.`);
  res.redirect(`/admin/companies/${encodeURIComponent(name)}`);
}

async function setSubClientStatus(req, res) {
  const name = decodeURIComponent(req.params.name);
  const subClient = await subClientModel.findById(req.params.subClientId);
  if (!subClient || subClient.parentCompany !== name) return res.status(404).render('errors/404', { title: 'Not found' });

  const isActive = req.body.active === '1';
  await subClientModel.setActive(subClient.id, isActive);
  await auditLogger.log({ user: req.user, action: isActive ? 'sub_client.activate' : 'sub_client.deactivate', entityType: 'sub_client', entityId: subClient.id, req });
  setFlash(req, 'success', `${subClient.name} was ${isActive ? 'reactivated' : 'deactivated'}.`);
  res.redirect(`/admin/companies/${encodeURIComponent(name)}`);
}

module.exports = { index, create, update, setStatus, show, createSubClient, updateSubClient, setSubClientStatus };
