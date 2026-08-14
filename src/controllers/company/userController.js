const userModel = require('../../models/userModel');
const subClientModel = require('../../models/subClientModel');
const ticketModel = require('../../models/ticketModel');
const projectModel = require('../../models/projectModel');
const auditLogModel = require('../../models/auditLogModel');
const passwordResetModel = require('../../models/passwordResetModel');
const emailService = require('../../services/emailService');
const auditLogger = require('../../services/auditLogger');
const userInviteService = require('../../services/userInviteService');
const { setFlash } = require('../../utils/flash');
const { ROLES, ROLE_LABELS } = require('../../config/constants');

// Deliberately NOT reusing CLIENT_ROLES (which also contains client_admin) —
// this is the exact set of roles a client_admin may view/create/edit here.
// Never widen this without re-reading the whole file for the assumption
// that "manageable" === "these two roles, always".
const MANAGEABLE_ROLES = [ROLES.CLIENT, ROLES.END_CLIENT_USER];

// Same "hide existence" convention as ticketController.loadTicketOr404 and
// companyAdminController's sub-client checks: an out-of-scope id 404s, so a
// client_admin probing ids can't distinguish "wrong company"/"wrong role
// tier" from "doesn't exist".
async function loadManagedUserOr404(req, res) {
  const target = await userModel.findById(req.params.id);
  if (!target || target.company !== req.user.company || !MANAGEABLE_ROLES.includes(target.role)) {
    res.status(404).render('errors/404', { title: 'Not found' });
    return null;
  }
  return target;
}

async function loadOwnSubClientOr404(req, res) {
  const subClient = await subClientModel.findById(req.params.id);
  if (!subClient || subClient.parentCompany !== req.user.company) {
    res.status(404).render('errors/404', { title: 'Not found' });
    return null;
  }
  return subClient;
}

async function loadPageData(req) {
  const [allCompanyUsers, subClients] = await Promise.all([
    userModel.listAll({ company: req.user.company }),
    subClientModel.list(req.user.company),
  ]);
  return { users: allCompanyUsers.filter((u) => MANAGEABLE_ROLES.includes(u.role)), subClients };
}

async function index(req, res) {
  const { users, subClients } = await loadPageData(req);
  res.render('company/users', {
    title: 'Users', users, subClients, roles: MANAGEABLE_ROLES, roleLabels: ROLE_LABELS,
    errors: null, formData: {},
  });
}

async function create(req, res) {
  const { name, email, role, subClientId, department, title } = req.body;

  async function fail(message) {
    const { users, subClients } = await loadPageData(req);
    return res.status(400).render('company/users', {
      title: 'Users', users, subClients, roles: MANAGEABLE_ROLES, roleLabels: ROLE_LABELS,
      errors: { form: message }, formData: req.body,
    });
  }

  if (!name || !email) return fail('Name and email are required.');
  if (!MANAGEABLE_ROLES.includes(role)) return fail('That is not a valid role.');
  if (await userModel.findByEmail(email)) return fail('A user with that email already exists.');

  let ownedSubClientId = null;
  if (subClientId) {
    const subClient = await subClientModel.findById(subClientId);
    if (!subClient || subClient.parentCompany !== req.user.company) return fail('That is not a valid sub-client.');
    ownedSubClientId = subClient.id;
  }

  // company is NEVER read from req.body anywhere in this file — always
  // req.user.company (session-bound, not request-controlled). teamId is
  // never read from req.body anywhere in this file either.
  const user = await userInviteService.inviteUser({
    name, email, role, company: req.user.company, subClientId: ownedSubClientId,
    department, title, teamId: null, req,
  });
  setFlash(req, 'success', `${user.name} was invited — an email was sent to ${user.email} with a link to set their password.`);
  res.redirect('/company/users');
}

async function show(req, res) {
  const user = await loadManagedUserOr404(req, res);
  if (!user) return;

  const [subClients, ticketPage, projectPage, activity] = await Promise.all([
    subClientModel.list(req.user.company),
    ticketModel.listVisibleTo(req.user, { company: req.user.company, page: 1, pageSize: 1 }),
    projectModel.list(req.user, { company: req.user.company, page: 1, pageSize: 1 }),
    auditLogModel.list({ relatedToUserId: user.id, page: 1, pageSize: 20 }),
  ]);

  res.render('company/user-detail', {
    title: user.name, user, subClients,
    subClient: user.subClientId ? subClients.find((s) => s.id === user.subClientId) || null : null,
    ticketCount: ticketPage.total, projectCount: projectPage.total,
    activity: activity.logs, roles: MANAGEABLE_ROLES, roleLabels: ROLE_LABELS,
  });
}

async function update(req, res) {
  const before = await loadManagedUserOr404(req, res);
  if (!before) return;

  const { name, phone, department, title, role, subClientId, isActive } = req.body;

  if (role !== undefined && !MANAGEABLE_ROLES.includes(role)) {
    setFlash(req, 'error', 'That is not a valid role.');
    return res.redirect(`/company/users/${before.id}`);
  }

  let nextSubClientId; // undefined = don't touch; null = clear; else validated id
  if (subClientId !== undefined) {
    if (subClientId === '') {
      nextSubClientId = null;
    } else {
      const subClient = await subClientModel.findById(subClientId);
      if (!subClient || subClient.parentCompany !== req.user.company) {
        setFlash(req, 'error', 'That is not a valid sub-client.');
        return res.redirect(`/company/users/${before.id}`);
      }
      nextSubClientId = subClient.id;
    }
  }

  // company and teamId keys are never included in this object — the
  // allow-list shape of userModel.adminUpdate means an absent key is
  // always left untouched, regardless of what req.body contains.
  await userModel.adminUpdate(before.id, {
    name, phone, department, title, role, subClientId: nextSubClientId,
    isActive: isActive === undefined ? undefined : isActive === 'on',
  });
  await auditLogger.log({
    user: req.user, action: 'user.update', entityType: 'user', entityId: before.id,
    before: { role: before.role, isActive: before.isActive },
    after: { role: role || before.role, isActive: isActive === 'on' }, req,
  });
  setFlash(req, 'success', 'User updated.');
  res.redirect('/company/users');
}

async function setStatus(req, res) {
  const before = await loadManagedUserOr404(req, res);
  if (!before) return;
  const isActive = req.body.active === '1';
  await userModel.adminUpdate(before.id, { isActive });
  await auditLogger.log({
    user: req.user, action: isActive ? 'user.activate' : 'user.deactivate', entityType: 'user', entityId: before.id,
    before: { isActive: before.isActive }, after: { isActive }, req,
  });
  setFlash(req, 'success', `${before.name} was ${isActive ? 'reactivated' : 'deactivated'}.`);
  res.redirect(req.body.returnTo || '/company/users');
}

// "Help a locked-out user" — never reveals a password, just re-sends a
// set/reset-password link (same mechanism as forgot-password), unlike the
// admin panel's resetPassword() which is an admin-only affordance.
async function resendInvite(req, res) {
  const target = await loadManagedUserOr404(req, res);
  if (!target) return;
  const token = await passwordResetModel.create(target.id, { ttlMinutes: userInviteService.INVITE_TTL_MINUTES, purpose: 'reset' });
  const resetUrl = `${req.protocol}://${req.get('host')}/reset-password/${token}`;
  await emailService.send({
    to: target.email,
    subject: 'Reset your QuanTech Support Portal password',
    text: `${req.user.name} sent you a link to set/reset your password for the QuanTech Support Portal (this link expires in 7 days): ${resetUrl}\n\nIf you weren't expecting this, you can ignore this email.`,
  });
  await auditLogger.log({ user: req.user, action: 'user.password_reset_link_sent', entityType: 'user', entityId: target.id, req });
  setFlash(req, 'success', `A password reset link was sent to ${target.email}.`);
  res.redirect(req.body.returnTo || `/company/users/${target.id}`);
}

async function createSubClient(req, res) {
  const { name, contactName, contactEmail, contactPhone } = req.body;
  if (!name || !name.trim()) {
    setFlash(req, 'error', 'Sub-client name is required.');
    return res.redirect('/company/users#sub-clients');
  }
  const existing = await subClientModel.list(req.user.company);
  if (existing.some((s) => s.name.toLowerCase() === name.trim().toLowerCase())) {
    setFlash(req, 'error', 'A sub-client with that name already exists for your company.');
    return res.redirect('/company/users#sub-clients');
  }
  // parentCompany hardcoded — never read from req.body.
  const subClient = await subClientModel.create({ parentCompany: req.user.company, name: name.trim(), contactName, contactEmail, contactPhone });
  await auditLogger.log({ user: req.user, action: 'sub_client.create', entityType: 'sub_client', entityId: subClient.id, after: { parentCompany: req.user.company, name }, req });
  setFlash(req, 'success', `${subClient.name} was created.`);
  res.redirect('/company/users#sub-clients');
}

async function updateSubClient(req, res) {
  const subClient = await loadOwnSubClientOr404(req, res);
  if (!subClient) return;
  const { name, contactName, contactEmail, contactPhone } = req.body;
  if (!name || !name.trim()) {
    setFlash(req, 'error', 'Sub-client name is required.');
    return res.redirect('/company/users#sub-clients');
  }
  await subClientModel.update(subClient.id, { name: name.trim(), contactName, contactEmail, contactPhone });
  await auditLogger.log({ user: req.user, action: 'sub_client.update', entityType: 'sub_client', entityId: subClient.id, req });
  setFlash(req, 'success', `${name} was updated.`);
  res.redirect('/company/users#sub-clients');
}

async function setSubClientStatus(req, res) {
  const subClient = await loadOwnSubClientOr404(req, res);
  if (!subClient) return;
  const isActive = req.body.active === '1';
  await subClientModel.setActive(subClient.id, isActive);
  await auditLogger.log({ user: req.user, action: isActive ? 'sub_client.activate' : 'sub_client.deactivate', entityType: 'sub_client', entityId: subClient.id, req });
  setFlash(req, 'success', `${subClient.name} was ${isActive ? 'reactivated' : 'deactivated'}.`);
  res.redirect('/company/users#sub-clients');
}

module.exports = { index, create, show, update, setStatus, resendInvite, createSubClient, updateSubClient, setSubClientStatus };
