const assignmentRuleModel = require('../../models/assignmentRuleModel');
const categoryModel = require('../../models/categoryModel');
const teamModel = require('../../models/teamModel');
const departmentModel = require('../../models/departmentModel');
const userModel = require('../../models/userModel');
const auditLogger = require('../../services/auditLogger');
const { setFlash } = require('../../utils/flash');
const { PRIORITIES } = require('../../config/constants');

async function loadFormData() {
  const [rules, categories, teams, departments, agents] = await Promise.all([
    assignmentRuleModel.list(), categoryModel.listNames(), teamModel.list(), departmentModel.list(), userModel.listTechnicians(),
  ]);
  const teamsById = Object.fromEntries(teams.map((t) => [t.id, t]));
  return {
    rules: rules.map((r) => ({ ...r, teamName: r.teamId && teamsById[r.teamId] ? teamsById[r.teamId].name : null })),
    categories, teams, departments, agents, priorities: PRIORITIES,
  };
}

async function index(req, res) {
  const data = await loadFormData();
  res.render('admin/workflows', { title: 'Workflows', ...data, errors: null });
}

async function create(req, res) {
  const { name, category, priority, teamId, agentId, sortOrder } = req.body;
  if (!name || !name.trim() || !teamId) {
    const data = await loadFormData();
    return res.status(400).render('admin/workflows', { title: 'Workflows', ...data, errors: { form: 'Rule name and target team are required.' } });
  }
  const rule = await assignmentRuleModel.create({ name, category: category || null, priority: priority || null, teamId, agentId: agentId || null, sortOrder: Number(sortOrder) || 0 });
  await auditLogger.log({ user: req.user, action: 'assignment_rule.create', entityType: 'assignment_rule', entityId: rule.id, after: { name, teamId }, req });
  setFlash(req, 'success', 'Assignment rule created.');
  res.redirect('/admin/workflows');
}

async function toggle(req, res) {
  const rule = await assignmentRuleModel.findById(req.params.id);
  if (!rule) return res.status(404).render('errors/404', { title: 'Not found' });
  await assignmentRuleModel.update(req.params.id, { ...rule, isActive: !rule.isActive });
  await auditLogger.log({ user: req.user, action: 'assignment_rule.toggle', entityType: 'assignment_rule', entityId: req.params.id, after: { isActive: !rule.isActive }, req });
  res.redirect('/admin/workflows');
}

async function remove(req, res) {
  await assignmentRuleModel.remove(req.params.id);
  await auditLogger.log({ user: req.user, action: 'assignment_rule.delete', entityType: 'assignment_rule', entityId: req.params.id, req });
  setFlash(req, 'success', 'Assignment rule deleted.');
  res.redirect('/admin/workflows');
}

module.exports = { index, create, toggle, remove };
