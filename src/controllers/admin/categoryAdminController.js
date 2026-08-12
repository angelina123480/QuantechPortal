const categoryModel = require('../../models/categoryModel');
const auditLogger = require('../../services/auditLogger');
const { setFlash } = require('../../utils/flash');

async function index(req, res) {
  const categories = await categoryModel.listWithSubcategories();
  res.render('admin/categories', { title: 'Categories', categories, errors: null, formData: {} });
}

async function create(req, res) {
  const { name, description } = req.body;
  if (!name || !name.trim()) {
    const categories = await categoryModel.listWithSubcategories();
    return res.status(400).render('admin/categories', { title: 'Categories', categories, errors: { form: 'Category name is required.' }, formData: req.body });
  }
  await categoryModel.create({ name, description });
  await auditLogger.log({ user: req.user, action: 'category.create', entityType: 'category', entityId: name, req });
  setFlash(req, 'success', `${name} was created.`);
  res.redirect('/admin/categories');
}

async function remove(req, res) {
  const name = decodeURIComponent(req.params.name);
  await categoryModel.remove(name);
  await auditLogger.log({ user: req.user, action: 'category.delete', entityType: 'category', entityId: name, req });
  setFlash(req, 'success', 'Category deleted.');
  res.redirect('/admin/categories');
}

async function addSubcategory(req, res) {
  const categoryName = decodeURIComponent(req.params.name);
  if (!req.body.name || !req.body.name.trim()) {
    setFlash(req, 'error', 'Subcategory name is required.');
    return res.redirect('/admin/categories');
  }
  await categoryModel.addSubcategory(categoryName, req.body.name.trim());
  await auditLogger.log({ user: req.user, action: 'subcategory.create', entityType: 'category', entityId: categoryName, after: { name: req.body.name }, req });
  setFlash(req, 'success', 'Subcategory added.');
  res.redirect('/admin/categories');
}

async function removeSubcategory(req, res) {
  await categoryModel.removeSubcategory(req.params.id);
  await auditLogger.log({ user: req.user, action: 'subcategory.delete', entityType: 'subcategory', entityId: req.params.id, req });
  setFlash(req, 'success', 'Subcategory removed.');
  res.redirect('/admin/categories');
}

module.exports = { index, create, remove, addSubcategory, removeSubcategory };
