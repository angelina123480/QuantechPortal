const userModel = require('../../models/userModel');
const teamModel = require('../../models/teamModel');
const companyModel = require('../../models/companyModel');
const subClientModel = require('../../models/subClientModel');
const auditLogger = require('../../services/auditLogger');
const { setFlash } = require('../../utils/flash');
const { ROLES, ROLE_LABELS } = require('../../config/constants');

async function loadFormOptions(filters = {}) {
  const [users, teams, companies, subClients] = await Promise.all([
    userModel.listAll(filters), teamModel.list(), companyModel.list(), subClientModel.listAll(),
  ]);
  return { users, teams, companies, subClients };
}

async function index(req, res) {
  const filters = {};
  if (req.query.role) filters.role = req.query.role;
  if (req.query.q) filters.search = req.query.q;
  const { users, teams, companies, subClients } = await loadFormOptions(filters);
  res.render('admin/users', {
    title: 'Users', users, teams, companies, subClients, roles: Object.values(ROLES), roleLabels: ROLE_LABELS,
    query: req.query, errors: null, formData: {},
  });
}

async function create(req, res) {
  const { name, email, password, role, company, subClientId, department, title, teamId } = req.body;

  async function fail(message) {
    const { users, teams, companies, subClients } = await loadFormOptions({});
    return res.status(400).render('admin/users', {
      title: 'Users', users, teams, companies, subClients, roles: Object.values(ROLES), roleLabels: ROLE_LABELS,
      query: {}, errors: { form: message }, formData: req.body,
    });
  }

  if (!name || !email || !password || password.length < 8 || !role || !company) {
    return fail('Name, email, an 8+ character password, role, and company are required.');
  }
  if (!Object.values(ROLES).includes(role)) {
    return fail('That is not a valid role.');
  }
  if (!(await companyModel.findByName(company))) {
    return fail('That is not a valid company.');
  }
  if (await userModel.findByEmail(email)) {
    return fail('A user with that email already exists.');
  }

  const user = await userModel.create({ name, email, password, role, company, subClientId: subClientId || null, department, title, teamId: teamId || null });
  await auditLogger.log({ user: req.user, action: 'user.create', entityType: 'user', entityId: user.id, after: { role, company }, req });
  setFlash(req, 'success', `${user.name} was created.`);
  res.redirect('/admin/users');
}

async function update(req, res) {
  const { role, teamId, company, subClientId, department, title, name, phone, isActive } = req.body;
  const before = await userModel.findById(req.params.id);
  if (!before) return res.status(404).render('errors/404', { title: 'Not found' });

  if (role !== undefined && !Object.values(ROLES).includes(role)) {
    setFlash(req, 'error', 'That is not a valid role.');
    return res.redirect('/admin/users');
  }
  if (company !== undefined && !(await companyModel.findByName(company))) {
    setFlash(req, 'error', 'That is not a valid company.');
    return res.redirect('/admin/users');
  }
  // Without this, an admin could demote/deactivate every super admin
  // (including their own, from another tab/session) and lock everyone out
  // of system-level configuration with no way back short of a direct
  // database edit.
  if (before.role === ROLES.SUPER_ADMIN && (role !== ROLES.SUPER_ADMIN || isActive !== 'on')) {
    const activeSuperAdmins = (await userModel.listAll({ role: ROLES.SUPER_ADMIN })).filter((u) => u.isActive);
    if (activeSuperAdmins.length <= 1) {
      setFlash(req, 'error', 'You can\'t remove the last active Super Admin.');
      return res.redirect('/admin/users');
    }
  }

  await userModel.adminUpdate(req.params.id, {
    role, teamId: teamId || null, company, subClientId: subClientId || null, department, title, name, phone, isActive: isActive === 'on',
  });
  await auditLogger.log({
    user: req.user, action: 'user.update', entityType: 'user', entityId: req.params.id,
    before: { role: before.role, company: before.company, isActive: before.isActive },
    after: { role, company, isActive: isActive === 'on' }, req,
  });
  setFlash(req, 'success', 'User updated.');
  res.redirect('/admin/users');
}

async function resetPassword(req, res) {
  const target = await userModel.findById(req.params.id);
  if (!target) return res.status(404).render('errors/404', { title: 'Not found' });
  const tempPassword = Math.random().toString(36).slice(-10) + 'Aa1!';
  await userModel.updatePassword(req.params.id, tempPassword);
  await auditLogger.log({ user: req.user, action: 'user.password_reset_by_admin', entityType: 'user', entityId: req.params.id, req });
  setFlash(req, 'success', `Temporary password for ${target.name}: ${tempPassword} (share this securely — it won't be shown again).`);
  res.redirect('/admin/users');
}

module.exports = { index, create, update, resetPassword };
