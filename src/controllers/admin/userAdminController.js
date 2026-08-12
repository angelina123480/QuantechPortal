const userModel = require('../../models/userModel');
const teamModel = require('../../models/teamModel');
const companyModel = require('../../models/companyModel');
const auditLogger = require('../../services/auditLogger');
const { setFlash } = require('../../utils/flash');
const { ROLES, ROLE_LABELS } = require('../../config/constants');

async function index(req, res) {
  const filters = {};
  if (req.query.role) filters.role = req.query.role;
  if (req.query.q) filters.search = req.query.q;
  const [users, teams, companies] = await Promise.all([userModel.listAll(filters), teamModel.list(), companyModel.list()]);
  res.render('admin/users', {
    title: 'Users', users, teams, companies, roles: Object.values(ROLES), roleLabels: ROLE_LABELS,
    query: req.query, errors: null, formData: {},
  });
}

async function create(req, res) {
  const { name, email, password, role, company, department, title, teamId } = req.body;
  if (!name || !email || !password || password.length < 8 || !role || !company) {
    const [users, teams, companies] = await Promise.all([userModel.listAll({}), teamModel.list(), companyModel.list()]);
    return res.status(400).render('admin/users', {
      title: 'Users', users, teams, companies, roles: Object.values(ROLES), roleLabels: ROLE_LABELS,
      query: {}, errors: { form: 'Name, email, an 8+ character password, role, and company are required.' }, formData: req.body,
    });
  }
  if (await userModel.findByEmail(email)) {
    const [users, teams, companies] = await Promise.all([userModel.listAll({}), teamModel.list(), companyModel.list()]);
    return res.status(400).render('admin/users', {
      title: 'Users', users, teams, companies, roles: Object.values(ROLES), roleLabels: ROLE_LABELS,
      query: {}, errors: { form: 'A user with that email already exists.' }, formData: req.body,
    });
  }

  const user = await userModel.create({ name, email, password, role, company, department, title, teamId: teamId || null });
  await auditLogger.log({ user: req.user, action: 'user.create', entityType: 'user', entityId: user.id, after: { role, company }, req });
  setFlash(req, 'success', `${user.name} was created.`);
  res.redirect('/admin/users');
}

async function update(req, res) {
  const { role, teamId, company, department, title, name, phone, isActive } = req.body;
  const before = await userModel.findById(req.params.id);
  if (!before) return res.status(404).render('errors/404', { title: 'Not found' });

  await userModel.adminUpdate(req.params.id, {
    role, teamId: teamId || null, company, department, title, name, phone, isActive: isActive === 'on',
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
