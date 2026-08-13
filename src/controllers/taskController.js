const taskModel = require('../models/taskModel');
const projectModel = require('../models/projectModel');
const milestoneModel = require('../models/milestoneModel');
const ticketModel = require('../models/ticketModel');
const userModel = require('../models/userModel');
const notificationService = require('../services/notificationService');
const auditLogger = require('../services/auditLogger');
const { setFlash } = require('../utils/flash');
const { TASK_STATUSES, PRIORITIES, MANAGEMENT_ROLES } = require('../config/constants');

async function list(req, res) {
  const isManager = MANAGEMENT_ROLES.includes(req.user.role);
  const filters = {
    status: req.query.status || undefined,
    priority: req.query.priority || undefined,
    search: req.query.q || undefined,
  };
  // Managers can look at anyone's queue via ?assignedTo=; everyone else
  // (and managers with no filter set) sees their own — "My Tasks" default.
  if (isManager && req.query.assignedTo) filters.assignedToId = req.query.assignedTo;
  else filters.assignedToId = req.user.id;

  const tasks = await taskModel.list(filters);
  const projectIds = [...new Set(tasks.map((t) => t.projectId).filter(Boolean))];
  const projects = (await Promise.all(projectIds.map((id) => projectModel.findById(id)))).filter(Boolean);
  const projectById = Object.fromEntries(projects.map((p) => [p.id, p]));

  const technicians = isManager ? await userModel.listTechnicians() : [];

  res.render('tasks/list', {
    title: 'My Tasks',
    tasks, projectById, technicians,
    statuses: TASK_STATUSES, priorities: PRIORITIES,
    query: req.query, isManager,
  });
}

async function create(req, res) {
  const payload = req.body || {};
  if (!payload.title || !payload.title.trim()) {
    setFlash(req, 'error', 'Task title is required.');
    return res.redirect('/tasks');
  }

  const isManager = MANAGEMENT_ROLES.includes(req.user.role);
  const assignedToId = (isManager && payload.assignedToId) ? payload.assignedToId : req.user.id;

  const task = await taskModel.create({
    title: payload.title.trim(),
    description: payload.description,
    assignedToId,
    createdById: req.user.id,
    projectId: payload.projectId || null,
    milestoneId: payload.milestoneId || null,
    ticketId: payload.ticketId || null,
    priority: payload.priority,
    dueDate: payload.dueDate || null,
  });
  await auditLogger.log({ user: req.user, action: 'task.create', entityType: 'task', entityId: task.id, after: { title: task.title, assignedToId }, req });

  if (assignedToId !== req.user.id) {
    await notificationService.notify(assignedToId, {
      type: 'task_assigned', title: `Task assigned: ${task.title}`, body: task.title, taskId: task.id,
    });
  }

  setFlash(req, 'success', `${task.title} was created.`);
  res.redirect('/tasks');
}

async function loadTaskOr403(req, res) {
  const task = await taskModel.findById(req.params.id);
  if (!task) {
    res.status(404).render('errors/404', { title: 'Task not found' });
    return null;
  }
  if (!taskModel.canManage(req.user, task)) {
    res.status(403).render('errors/403', { title: 'Access denied' });
    return null;
  }
  return task;
}

async function update(req, res) {
  const task = await loadTaskOr403(req, res);
  if (!task) return;
  const payload = req.body || {};
  const updated = await taskModel.update(task.id, {
    title: payload.title || task.title,
    description: payload.description,
    priority: payload.priority || task.priority,
    dueDate: payload.dueDate || null,
  });
  await auditLogger.log({ user: req.user, action: 'task.update', entityType: 'task', entityId: task.id, before: { title: task.title }, after: { title: updated.title }, req });
  setFlash(req, 'success', 'Task updated.');
  res.redirect('/tasks');
}

async function updateStatus(req, res) {
  const task = await loadTaskOr403(req, res);
  if (!task) return;
  const status = String((req.body || {}).status || '');
  if (!TASK_STATUSES.includes(status)) {
    setFlash(req, 'error', 'Invalid task status.');
    return res.redirect('/tasks');
  }
  await taskModel.updateStatus(task.id, status);
  await auditLogger.log({ user: req.user, action: 'task.status_change', entityType: 'task', entityId: task.id, before: { status: task.status }, after: { status }, req });
  setFlash(req, 'success', 'Task updated.');
  res.redirect('/tasks');
}

async function updateChecklist(req, res) {
  const task = await loadTaskOr403(req, res);
  if (!task) return;
  const payload = req.body || {};
  let checklist = task.checklist.slice();

  if (payload.action === 'add' && payload.text && payload.text.trim()) {
    checklist.push({ text: payload.text.trim(), done: false });
  } else if (payload.action === 'toggle' && payload.index !== undefined) {
    const i = Number(payload.index);
    if (checklist[i]) checklist[i] = { ...checklist[i], done: !checklist[i].done };
  } else if (payload.action === 'remove' && payload.index !== undefined) {
    checklist = checklist.filter((_, i) => i !== Number(payload.index));
  }

  await taskModel.setChecklist(task.id, checklist);
  setFlash(req, 'success', 'Checklist updated.');
  res.redirect('/tasks');
}

async function assign(req, res) {
  const task = await taskModel.findById(req.params.id);
  if (!task) return res.status(404).render('errors/404', { title: 'Task not found' });
  const assignedToId = (req.body || {}).assignedToId || null;

  await taskModel.assign(task.id, assignedToId);
  await auditLogger.log({ user: req.user, action: 'task.assign', entityType: 'task', entityId: task.id, before: { assignedToId: task.assignedToId }, after: { assignedToId }, req });

  if (assignedToId && assignedToId !== req.user.id) {
    await notificationService.notify(assignedToId, {
      type: 'task_assigned', title: `Task assigned: ${task.title}`, body: task.title, taskId: task.id,
    });
  }

  setFlash(req, 'success', 'Task reassigned.');
  res.redirect('/tasks');
}

async function remove(req, res) {
  const task = await loadTaskOr403(req, res);
  if (!task) return;
  await taskModel.remove(task.id);
  await auditLogger.log({ user: req.user, action: 'task.delete', entityType: 'task', entityId: task.id, before: { title: task.title }, req });
  setFlash(req, 'success', 'Task deleted.');
  res.redirect('/tasks');
}

module.exports = { list, create, update, updateStatus, updateChecklist, assign, remove };
