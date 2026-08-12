const departmentModel = require('../../models/departmentModel');
const teamModel = require('../../models/teamModel');
const auditLogger = require('../../services/auditLogger');
const { setFlash } = require('../../utils/flash');

async function index(req, res) {
  const [departments, teams] = await Promise.all([departmentModel.list(), teamModel.list()]);
  const teamCountByDept = {};
  for (const t of teams) teamCountByDept[t.departmentId] = (teamCountByDept[t.departmentId] || 0) + 1;

  res.render('admin/departments', {
    title: 'Departments',
    departments: departments.map((d) => ({ ...d, teamCount: teamCountByDept[d.id] || 0 })),
    errors: null, formData: {},
  });
}

async function create(req, res) {
  const { name, description } = req.body;
  if (!name || !name.trim()) {
    const departments = await departmentModel.list();
    return res.status(400).render('admin/departments', { title: 'Departments', departments, errors: { form: 'Department name is required.' }, formData: req.body });
  }
  const dept = await departmentModel.create({ name, description });
  await auditLogger.log({ user: req.user, action: 'department.create', entityType: 'department', entityId: dept.id, after: { name }, req });
  setFlash(req, 'success', `${dept.name} was created.`);
  res.redirect('/admin/departments');
}

async function update(req, res) {
  const { name, description } = req.body;
  const updated = await departmentModel.update(req.params.id, { name, description });
  if (!updated) return res.status(404).render('errors/404', { title: 'Not found' });
  await auditLogger.log({ user: req.user, action: 'department.update', entityType: 'department', entityId: req.params.id, req });
  setFlash(req, 'success', 'Department updated.');
  res.redirect('/admin/departments');
}

module.exports = { index, create, update };
