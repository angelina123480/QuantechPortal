const crypto = require('crypto');
const userModel = require('../../models/userModel');
const teamModel = require('../../models/teamModel');
const companyModel = require('../../models/companyModel');
const subClientModel = require('../../models/subClientModel');
const ticketModel = require('../../models/ticketModel');
const projectModel = require('../../models/projectModel');
const auditLogModel = require('../../models/auditLogModel');
const passwordResetModel = require('../../models/passwordResetModel');
const emailService = require('../../services/emailService');
const auditLogger = require('../../services/auditLogger');
const { setFlash } = require('../../utils/flash');
const { ROLES, ROLE_LABELS, STAFF_ROLES, CLIENT_ROLES } = require('../../config/constants');

const INVITE_TTL_MINUTES = 7 * 24 * 60; // 7 days

async function loadFormOptions() {
  const [teams, companies, activeCompanies, subClients] = await Promise.all([
    teamModel.list(), companyModel.list(), companyModel.list({ isActive: true }), subClientModel.listAll(),
  ]);
  return { teams, companies, activeCompanies, subClients };
}

async function index(req, res) {
  const filters = { page: Math.max(1, Number(req.query.page) || 1), pageSize: 25 };
  if (req.query.role) filters.role = req.query.role;
  if (req.query.q) filters.search = req.query.q;
  if (req.query.company) filters.company = req.query.company;
  if (req.query.group === 'staff' || req.query.group === 'client') filters.group = req.query.group;

  const [{ users, total, page, pageSize }, options] = await Promise.all([userModel.listAll(filters), loadFormOptions()]);
  res.render('admin/users', {
    title: 'Users', users, ...options, roles: Object.values(ROLES), roleLabels: ROLE_LABELS,
    query: req.query, errors: null, formData: {},
    total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)),
  });
}

async function create(req, res) {
  const { name, email, role, company, subClientId, department, title, teamId, password } = req.body;

  async function fail(message) {
    const [{ users, total, page, pageSize }, options] = await Promise.all([
      userModel.listAll({ page: 1, pageSize: 25 }), loadFormOptions(),
    ]);
    return res.status(400).render('admin/users', {
      title: 'Users', users, ...options, roles: Object.values(ROLES), roleLabels: ROLE_LABELS,
      query: {}, errors: { form: message }, formData: req.body,
      total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)),
    });
  }

  if (!name || !email || !role || !company) return fail('Name, email, role, and company are required.');
  if (!Object.values(ROLES).includes(role)) return fail('That is not a valid role.');
  if (!(await companyModel.findByName(company))) return fail('That is not a valid company.');
  if (await userModel.findByEmail(email)) return fail('A user with that email already exists.');

  if (CLIENT_ROLES.includes(role)) {
    // Client accounts are invited by email rather than given a password
    // directly — this is what "closing self-registration" was for: proving
    // the recipient controls that inbox before granting portal access.
    // The placeholder password is random and never shown to anyone; login
    // stays impossible until the invite link is used.
    const placeholderPassword = crypto.randomBytes(32).toString('hex');
    const user = await userModel.create({
      name, email, password: placeholderPassword, role, company, subClientId: subClientId || null,
      department, title, teamId: teamId || null, invited: true,
    });
    const token = await passwordResetModel.create(user.id, { ttlMinutes: INVITE_TTL_MINUTES, purpose: 'invite' });
    const inviteUrl = `${req.protocol}://${req.get('host')}/reset-password/${token}`;
    await emailService.send({
      to: user.email,
      subject: 'You’re invited to the QuanTech Support Portal',
      text: `${req.user.name} has added you to the QuanTech Support Portal for ${company}. Set your password to get started (this link expires in 7 days): ${inviteUrl}\n\nIf you weren't expecting this, you can ignore this email.`,
    });
    await auditLogger.log({ user: req.user, action: 'user.invite', entityType: 'user', entityId: user.id, after: { role, company }, req });
    setFlash(req, 'success', `${user.name} was invited — an email was sent to ${user.email} with a link to set their password.`);
  } else {
    if (!password || password.length < 8) return fail('Name, email, an 8+ character password, role, and company are required.');
    const user = await userModel.create({ name, email, password, role, company, subClientId: subClientId || null, department, title, teamId: teamId || null });
    await auditLogger.log({ user: req.user, action: 'user.create', entityType: 'user', entityId: user.id, after: { role, company }, req });
    setFlash(req, 'success', `${user.name} was created.`);
  }
  res.redirect('/admin/users');
}

// Shared by update() (the full edit form, which always submits `role`) and
// setStatus() (the one-click activate/deactivate toggle, which never
// submits `role`). Treating an unsubmitted field as "unchanged" — not
// "cleared" — matters here: without it, a bare deactivate click on the last
// active super admin could be misread as also demoting them, and would
// incorrectly block harmless edits (e.g. a phone number change) too.
async function checkSuperAdminGuard(before, body) {
  if (before.role !== ROLES.SUPER_ADMIN) return null;
  const nextRole = body.role !== undefined ? body.role : before.role;
  const nextActive = body.isActive !== undefined ? (body.isActive === 'on' || body.isActive === true) : before.isActive;
  if (nextRole === ROLES.SUPER_ADMIN && nextActive) return null;
  const activeSuperAdmins = (await userModel.listAll({ role: ROLES.SUPER_ADMIN })).filter((u) => u.isActive);
  return activeSuperAdmins.length <= 1 ? 'You can\'t remove the last active Super Admin.' : null;
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
  const guardError = await checkSuperAdminGuard(before, { role, isActive });
  if (guardError) {
    setFlash(req, 'error', guardError);
    return res.redirect('/admin/users');
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

async function setStatus(req, res) {
  const before = await userModel.findById(req.params.id);
  if (!before) return res.status(404).render('errors/404', { title: 'Not found' });
  const isActive = req.body.active === '1';

  const guardError = await checkSuperAdminGuard(before, { isActive });
  if (guardError) {
    setFlash(req, 'error', guardError);
    return res.redirect(req.body.returnTo || '/admin/users');
  }

  await userModel.adminUpdate(before.id, { isActive });
  await auditLogger.log({
    user: req.user, action: isActive ? 'user.activate' : 'user.deactivate', entityType: 'user', entityId: before.id,
    before: { isActive: before.isActive }, after: { isActive }, req,
  });
  setFlash(req, 'success', `${before.name} was ${isActive ? 'reactivated' : 'deactivated'}.`);
  res.redirect(req.body.returnTo || '/admin/users');
}

async function show(req, res) {
  const user = await userModel.findById(req.params.id);
  if (!user) return res.status(404).render('errors/404', { title: 'Not found' });
  const isStaffUser = STAFF_ROLES.includes(user.role);

  const [options, ticketPage, projectPage, activity] = await Promise.all([
    loadFormOptions(),
    ticketModel.listVisibleTo(req.user, isStaffUser ? { assignedTechnicianId: user.id, page: 1, pageSize: 1 } : { company: user.company, page: 1, pageSize: 1 }),
    projectModel.list(req.user, isStaffUser ? { projectManagerId: user.id, page: 1, pageSize: 1 } : { company: user.company, page: 1, pageSize: 1 }),
    auditLogModel.list({ relatedToUserId: user.id, page: 1, pageSize: 20 }),
  ]);

  res.render('admin/user-detail', {
    title: user.name, user, isStaffUser, ...options,
    team: options.teams.find((t) => t.id === user.teamId) || null,
    subClient: user.subClientId ? options.subClients.find((s) => s.id === user.subClientId) || null : null,
    ticketCount: ticketPage.total, projectCount: projectPage.total,
    activity: activity.logs,
    roles: Object.values(ROLES), roleLabels: ROLE_LABELS,
  });
}

async function resetPassword(req, res) {
  const target = await userModel.findById(req.params.id);
  if (!target) return res.status(404).render('errors/404', { title: 'Not found' });
  const tempPassword = Math.random().toString(36).slice(-10) + 'Aa1!';
  await userModel.updatePassword(req.params.id, tempPassword);
  await auditLogger.log({ user: req.user, action: 'user.password_reset_by_admin', entityType: 'user', entityId: req.params.id, req });
  setFlash(req, 'success', `Temporary password for ${target.name}: ${tempPassword} (share this securely — it won't be shown again).`);
  res.redirect(req.body.returnTo || '/admin/users');
}

module.exports = { index, create, update, setStatus, show, resetPassword };
