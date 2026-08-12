const articleModel = require('../models/articleModel');
const categoryModel = require('../models/categoryModel');
const auditLogger = require('../services/auditLogger');
const { setFlash } = require('../utils/flash');

async function index(req, res) {
  const { q = '', category = '' } = req.query;
  const articles = await articleModel.list({ search: q, category });
  const categories = await categoryModel.listNames();

  res.render('kb/index', {
    title: 'Knowledge Base',
    articles,
    categories,
    query: q,
    activeCategory: category,
  });
}

async function show(req, res) {
  const article = await articleModel.findById(req.params.id);
  if (!article || (article.status !== 'published' && !res.locals.isStaff)) {
    return res.status(404).render('errors/404', { title: 'Article not found' });
  }
  await articleModel.incrementViewCount(article.id);
  const related = (await articleModel.list({ category: article.category }))
    .filter((a) => a.id !== article.id)
    .slice(0, 4);

  res.render('kb/article', {
    title: article.title,
    article,
    related,
  });
}

async function manage(req, res) {
  const articles = await articleModel.list({ includeDrafts: true });
  res.render('kb/manage', { title: 'Manage Knowledge Base', articles });
}

async function showCreateForm(req, res) {
  const categories = await categoryModel.listNames();
  res.render('kb/form', { title: 'New Article', categories, article: null, errors: null, formData: {} });
}

async function showEditForm(req, res) {
  const article = await articleModel.findById(req.params.id);
  if (!article) return res.status(404).render('errors/404', { title: 'Article not found' });
  const categories = await categoryModel.listNames();
  res.render('kb/form', { title: `Edit: ${article.title}`, categories, article, errors: null, formData: article });
}

function validate(body) {
  const errors = {};
  if (!body.title || !body.title.trim()) errors.title = 'Title is required.';
  if (!body.category) errors.category = 'Category is required.';
  if (!body.summary || !body.summary.trim()) errors.summary = 'Summary is required.';
  if (!body.body || !body.body.trim()) errors.body = 'Body is required.';
  return errors;
}

async function create(req, res) {
  const errors = validate(req.body);
  if (Object.keys(errors).length) {
    const categories = await categoryModel.listNames();
    return res.status(400).render('kb/form', { title: 'New Article', categories, article: null, errors, formData: req.body });
  }
  const tags = (req.body.tags || '').split(',').map((t) => t.trim()).filter(Boolean);
  const article = await articleModel.create(
    { title: req.body.title, category: req.body.category, summary: req.body.summary, body: req.body.body, tags, status: req.body.status === 'published' ? 'published' : 'draft' },
    req.user
  );
  await auditLogger.log({ user: req.user, action: 'article.create', entityType: 'article', entityId: article.id, after: { title: article.title, status: article.status }, req });
  setFlash(req, 'success', `"${article.title}" was created.`);
  res.redirect('/kb/manage');
}

async function update(req, res) {
  const existing = await articleModel.findById(req.params.id);
  if (!existing) return res.status(404).render('errors/404', { title: 'Article not found' });

  const errors = validate(req.body);
  if (Object.keys(errors).length) {
    const categories = await categoryModel.listNames();
    return res.status(400).render('kb/form', { title: `Edit: ${existing.title}`, categories, article: existing, errors, formData: req.body });
  }
  const tags = (req.body.tags || '').split(',').map((t) => t.trim()).filter(Boolean);
  await articleModel.update(req.params.id, { title: req.body.title, category: req.body.category, summary: req.body.summary, body: req.body.body, tags, status: req.body.status === 'published' ? 'published' : 'draft' });
  await auditLogger.log({ user: req.user, action: 'article.update', entityType: 'article', entityId: req.params.id, before: { status: existing.status }, after: { status: req.body.status }, req });
  setFlash(req, 'success', 'Article updated.');
  res.redirect('/kb/manage');
}

async function togglePublish(req, res) {
  const existing = await articleModel.findById(req.params.id);
  if (!existing) return res.status(404).render('errors/404', { title: 'Article not found' });
  const status = existing.status === 'published' ? 'draft' : 'published';
  await articleModel.update(req.params.id, { status });
  await auditLogger.log({ user: req.user, action: 'article.publish_toggle', entityType: 'article', entityId: req.params.id, before: { status: existing.status }, after: { status }, req });
  setFlash(req, 'success', status === 'published' ? 'Article published.' : 'Article unpublished.');
  res.redirect('/kb/manage');
}

async function remove(req, res) {
  const existing = await articleModel.findById(req.params.id);
  if (!existing) return res.status(404).render('errors/404', { title: 'Article not found' });
  await articleModel.remove(req.params.id);
  await auditLogger.log({ user: req.user, action: 'article.delete', entityType: 'article', entityId: req.params.id, before: { title: existing.title }, req });
  setFlash(req, 'success', 'Article deleted.');
  res.redirect('/kb/manage');
}

module.exports = { index, show, manage, showCreateForm, showEditForm, create, update, togglePublish, remove };
