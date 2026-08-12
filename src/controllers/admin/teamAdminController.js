const teamModel = require('../../models/teamModel');
const departmentModel = require('../../models/departmentModel');
const userModel = require('../../models/userModel');
const auditLogger = require('../../services/auditLogger');
const { setFlash } = require('../../utils/flash');
const { ROLES } = require('../../config/constants');

async function loadFormData() {
  const [teams, departments, leaders] = await Promise.all([
    teamModel.list(),
    departmentModel.list(),
    userModel.listAll({ role: ROLES.TEAM_LEADER }),
  ]);
  const departmentsById = Object.fromEntries(departments.map((d) => [d.id, d]));
  const leadersById = Object.fromEntries(leaders.map((l) => [l.id, l]));
  return {
    teams: teams.map((t) => ({
      ...t,
      departmentName: departmentsById[t.departmentId] ? departmentsById[t.departmentId].name : '—',
      leadName: t.leadUserId && leadersById[t.leadUserId] ? leadersById[t.leadUserId].name : 'Unassigned',
    })),
    departments, leaders,
  };
}

async function index(req, res) {
  const data = await loadFormData();
  res.render('admin/teams', { title: 'Teams', ...data, errors: null, formData: {} });
}

async function create(req, res) {
  const { name, departmentId, leadUserId } = req.body;
  if (!name || !name.trim() || !departmentId) {
    const data = await loadFormData();
    return res.status(400).render('admin/teams', { title: 'Teams', ...data, errors: { form: 'Team name and department are required.' }, formData: req.body });
  }
  const team = await teamModel.create({ name, departmentId, leadUserId: leadUserId || null });
  await auditLogger.log({ user: req.user, action: 'team.create', entityType: 'team', entityId: team.id, after: { name, departmentId }, req });
  setFlash(req, 'success', `${team.name} was created.`);
  res.redirect('/admin/teams');
}

async function update(req, res) {
  const { name, departmentId, leadUserId } = req.body;
  const updated = await teamModel.update(req.params.id, { name, departmentId, leadUserId: leadUserId || null });
  if (!updated) return res.status(404).render('errors/404', { title: 'Not found' });
  if (leadUserId) await userModel.adminUpdate(leadUserId, { teamId: req.params.id });
  await auditLogger.log({ user: req.user, action: 'team.update', entityType: 'team', entityId: req.params.id, req });
  setFlash(req, 'success', 'Team updated.');
  res.redirect('/admin/teams');
}

module.exports = { index, create, update };
