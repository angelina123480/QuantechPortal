const cannedResponseModel = require('../models/cannedResponseModel');
const userModel = require('../models/userModel');
const auditLogger = require('../services/auditLogger');
const permissionModel = require('../models/permissionModel');
const { setFlash } = require('../utils/flash');

async function canManageOthers(user) {
  if (user.role === 'admin') return true;
  return permissionModel.roleHasPermission(user.role, 'manage_canned_responses');
}

async function index(req, res) {
  const responses = await cannedResponseModel.list();
  const authorIds = [...new Set(responses.map((r) => r.createdBy).filter(Boolean))];
  const authors = await userModel.findByIds(authorIds);
  const authorsById = Object.fromEntries(authors.map((a) => [a.id, a]));
  const canManage = await canManageOthers(req.user);

  res.render('canned-responses/index', {
    title: 'Canned Responses',
    responses: responses.map((r) => ({ ...r, authorName: r.createdBy && authorsById[r.createdBy] ? authorsById[r.createdBy].name : 'System' })),
    canManage,
    errors: null,
    formData: {},
  });
}

async function create(req, res) {
  const { title, body, category } = req.body;
  if (!title || !title.trim() || !body || !body.trim()) {
    const responses = await cannedResponseModel.list();
    return res.status(400).render('canned-responses/index', {
      title: 'Canned Responses', responses, canManage: await canManageOthers(req.user),
      errors: { form: 'Title and body are required.' }, formData: req.body,
    });
  }
  const created = await cannedResponseModel.create({ title, body, category }, req.user);
  await auditLogger.log({ user: req.user, action: 'canned_response.create', entityType: 'canned_response', entityId: created.id, after: { title }, req });
  setFlash(req, 'success', 'Canned response created.');
  res.redirect('/canned-responses');
}

async function update(req, res) {
  const existing = await cannedResponseModel.findById(req.params.id);
  if (!existing) return res.status(404).render('errors/404', { title: 'Not found' });
  if (existing.createdBy !== req.user.id && !(await canManageOthers(req.user))) return res.status(403).end();

  await cannedResponseModel.update(req.params.id, { title: req.body.title, body: req.body.body, category: req.body.category });
  await auditLogger.log({ user: req.user, action: 'canned_response.update', entityType: 'canned_response', entityId: req.params.id, req });
  setFlash(req, 'success', 'Canned response updated.');
  res.redirect('/canned-responses');
}

async function remove(req, res) {
  const existing = await cannedResponseModel.findById(req.params.id);
  if (!existing) return res.status(404).render('errors/404', { title: 'Not found' });
  if (existing.createdBy !== req.user.id && !(await canManageOthers(req.user))) return res.status(403).end();

  await cannedResponseModel.remove(req.params.id);
  await auditLogger.log({ user: req.user, action: 'canned_response.delete', entityType: 'canned_response', entityId: req.params.id, before: { title: existing.title }, req });
  setFlash(req, 'success', 'Canned response deleted.');
  res.redirect('/canned-responses');
}

module.exports = { index, create, update, remove };
