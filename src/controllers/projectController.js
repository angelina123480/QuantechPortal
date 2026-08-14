const projectModel = require('../models/projectModel');
const milestoneModel = require('../models/milestoneModel');
const taskModel = require('../models/taskModel');
const ticketModel = require('../models/ticketModel');
const userModel = require('../models/userModel');
const teamModel = require('../models/teamModel');
const companyModel = require('../models/companyModel');
const subClientModel = require('../models/subClientModel');
const notificationService = require('../services/notificationService');
const auditLogger = require('../services/auditLogger');
const { setFlash } = require('../utils/flash');
const { PROJECT_STATUSES, MILESTONE_STATUSES, PRIORITIES, MANAGEMENT_ROLES, ROLES } = require('../config/constants');

async function loadFormOptions() {
  const [companies, teams, subClients, technicians] = await Promise.all([
    companyModel.list(), teamModel.list(), subClientModel.listAll(), userModel.listTechnicians(),
  ]);
  return { companies, teams, subClients, technicians };
}

async function list(req, res) {
  const filters = {
    status: req.query.status || undefined,
    priority: req.query.priority || undefined,
    company: req.query.company || undefined,
    search: req.query.q || undefined,
    page: Math.max(1, Number(req.query.page) || 1),
    pageSize: 25,
  };
  if (req.query.team === 'mine') {
    const myTeam = await teamModel.findByLeadUserId(req.user.id);
    filters.teamId = myTeam ? myTeam.id : req.user.teamId;
  } else if (req.query.teamId) {
    filters.teamId = req.query.teamId;
  }

  const { projects, total, page, pageSize } = await projectModel.list(req.user, filters);
  const projectIds = projects.map((p) => p.id);
  const milestonesByProject = {};
  await Promise.all(projectIds.map(async (id) => {
    milestonesByProject[id] = await milestoneModel.listForProject(id);
  }));
  const projectsWithProgress = projects.map((p) => ({ ...p, progress: projectModel.computeProgress(milestonesByProject[p.id] || []) }));
  const teams = await teamModel.list();
  const teamNamesById = Object.fromEntries(teams.map((t) => [t.id, t.name]));

  res.render('projects/list', {
    title: 'Projects',
    projects: projectsWithProgress,
    teamNamesById,
    statuses: PROJECT_STATUSES,
    priorities: PRIORITIES,
    query: req.query,
    total, page, pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    isManager: MANAGEMENT_ROLES.includes(req.user.role),
  });
}

async function showCreateForm(req, res) {
  const options = await loadFormOptions();
  res.render('projects/create', {
    title: 'New Project', ...options, statuses: PROJECT_STATUSES, priorities: PRIORITIES, errors: null, formData: {},
  });
}

async function create(req, res) {
  const payload = req.body || {};
  if (!payload.name || !payload.name.trim() || !payload.company) {
    const options = await loadFormOptions();
    return res.status(400).render('projects/create', {
      title: 'New Project', ...options, statuses: PROJECT_STATUSES, priorities: PRIORITIES,
      errors: { form: 'Project name and company are required.' }, formData: payload,
    });
  }
  if (!(await companyModel.findByName(payload.company))) {
    const options = await loadFormOptions();
    return res.status(400).render('projects/create', {
      title: 'New Project', ...options, statuses: PROJECT_STATUSES, priorities: PRIORITIES,
      errors: { form: 'That is not a valid company.' }, formData: payload,
    });
  }

  const project = await projectModel.create({
    name: payload.name.trim(),
    description: payload.description,
    company: payload.company,
    subClientId: payload.subClientId || null,
    projectManagerId: payload.projectManagerId || null,
    teamId: payload.teamId || null,
    startDate: payload.startDate || null,
    expectedCompletionDate: payload.expectedCompletionDate || null,
    priority: payload.priority,
    budget: payload.budget || null,
    notes: payload.notes,
  });
  await auditLogger.log({ user: req.user, action: 'project.create', entityType: 'project', entityId: project.id, after: { name: project.name, company: project.company }, req });

  if (project.projectManagerId && project.projectManagerId !== req.user.id) {
    await notificationService.notify(project.projectManagerId, {
      type: 'project_assigned', title: `You were made project manager: ${project.name}`, body: project.name, projectId: project.id,
    });
  }

  const clientAdmins = await userModel.listAll({ role: ROLES.CLIENT_ADMIN, company: project.company });
  if (clientAdmins.length) {
    await notificationService.notify(clientAdmins.map((u) => u.id), {
      type: 'project_created', title: `New project: ${project.name}`, body: `${project.company} — ${project.name}`, projectId: project.id,
    });
  }

  setFlash(req, 'success', `${project.name} was created.`);
  res.redirect(`/projects/${project.id}`);
}

async function loadProjectOr404(req, res) {
  const project = await projectModel.findById(req.params.id);
  if (!project || !projectModel.canAccess(req.user, project)) {
    res.status(404).render('errors/404', { title: 'Project not found' });
    return null;
  }
  return project;
}

async function detail(req, res) {
  const project = await loadProjectOr404(req, res);
  if (!project) return;

  const [milestones, tasks, technicians] = await Promise.all([
    milestoneModel.listForProject(project.id),
    taskModel.list({ projectId: project.id }),
    userModel.listTechnicians(),
  ]);
  const technicianById = Object.fromEntries(technicians.map((t) => [t.id, t]));

  const ticketIds = [...new Set(tasks.map((t) => t.ticketId).filter(Boolean))];
  let relatedTickets = (await Promise.all(ticketIds.map((id) => ticketModel.findById(id)))).filter(Boolean);
  if (!userModel.isStaff(req.user)) {
    relatedTickets = relatedTickets.filter((t) => ticketModel.canAccess(req.user, t));
  }

  const projectManager = project.projectManagerId ? technicianById[project.projectManagerId] || await userModel.findById(project.projectManagerId) : null;
  const team = project.teamId ? await teamModel.findById(project.teamId) : null;

  const progress = projectModel.computeProgress(milestones);
  const milestonesDone = milestones.filter((m) => m.status === 'Completed').length;
  const openTasks = tasks.filter((t) => ['To Do', 'In Progress', 'Blocked'].includes(t.status)).length;

  const options = await loadFormOptions();

  res.render('projects/detail', {
    title: project.name,
    project, milestones, tasks, relatedTickets, projectManager, team,
    technicianById, progress, milestonesDone, openTasks,
    statuses: PROJECT_STATUSES, milestoneStatuses: MILESTONE_STATUSES, priorities: PRIORITIES,
    isManager: MANAGEMENT_ROLES.includes(req.user.role),
    ...options,
  });
}

async function update(req, res) {
  const project = await loadProjectOr404(req, res);
  if (!project) return;
  const payload = req.body || {};

  const updated = await projectModel.update(project.id, {
    name: payload.name || project.name,
    description: payload.description,
    company: payload.company || project.company,
    subClientId: payload.subClientId || null,
    projectManagerId: payload.projectManagerId || null,
    teamId: payload.teamId || null,
    startDate: payload.startDate || null,
    expectedCompletionDate: payload.expectedCompletionDate || null,
    actualCompletionDate: payload.actualCompletionDate || null,
    priority: payload.priority || project.priority,
    budget: payload.budget || null,
    notes: payload.notes,
  });
  await auditLogger.log({ user: req.user, action: 'project.update', entityType: 'project', entityId: project.id, before: { name: project.name }, after: { name: updated.name }, req });
  setFlash(req, 'success', 'Project updated.');
  res.redirect(`/projects/${project.id}`);
}

async function updateStatus(req, res) {
  const project = await loadProjectOr404(req, res);
  if (!project) return;
  const status = String((req.body || {}).status || '');
  if (!PROJECT_STATUSES.includes(status)) {
    setFlash(req, 'error', 'Invalid project status.');
    return res.redirect(`/projects/${project.id}`);
  }
  await projectModel.updateStatus(project.id, status);
  await auditLogger.log({ user: req.user, action: 'project.status_change', entityType: 'project', entityId: project.id, before: { status: project.status }, after: { status }, req });
  setFlash(req, 'success', 'Project status updated.');
  res.redirect(`/projects/${project.id}`);
}

async function createMilestone(req, res) {
  const project = await loadProjectOr404(req, res);
  if (!project) return;
  const payload = req.body || {};
  if (!payload.name || !payload.name.trim()) {
    setFlash(req, 'error', 'Milestone name is required.');
    return res.redirect(`/projects/${project.id}`);
  }

  const existing = await milestoneModel.listForProject(project.id);
  const milestone = await milestoneModel.create({
    projectId: project.id,
    name: payload.name.trim(),
    description: payload.description,
    assignedToId: payload.assignedToId || null,
    startDate: payload.startDate || null,
    dueDate: payload.dueDate || null,
    priority: payload.priority,
    sortOrder: existing.length,
  });
  await auditLogger.log({ user: req.user, action: 'milestone.create', entityType: 'milestone', entityId: milestone.id, after: { name: milestone.name, projectId: project.id }, req });

  if (milestone.assignedToId && milestone.assignedToId !== req.user.id) {
    await notificationService.notify(milestone.assignedToId, {
      type: 'milestone_assigned', title: `Milestone assigned: ${milestone.name}`, body: `${project.name} — ${milestone.name}`,
      projectId: project.id, milestoneId: milestone.id,
    });
  }

  setFlash(req, 'success', `${milestone.name} was added.`);
  res.redirect(`/projects/${project.id}`);
}

async function updateMilestone(req, res) {
  const project = await loadProjectOr404(req, res);
  if (!project) return;
  const milestone = await milestoneModel.findById(req.params.milestoneId);
  if (!milestone || milestone.projectId !== project.id) {
    return res.status(404).render('errors/404', { title: 'Milestone not found' });
  }
  const payload = req.body || {};
  const updated = await milestoneModel.update(milestone.id, {
    name: payload.name || milestone.name,
    description: payload.description,
    assignedToId: payload.assignedToId || null,
    startDate: payload.startDate || null,
    dueDate: payload.dueDate || null,
    priority: payload.priority || milestone.priority,
    sortOrder: milestone.sortOrder,
  });
  await auditLogger.log({ user: req.user, action: 'milestone.update', entityType: 'milestone', entityId: milestone.id, before: { name: milestone.name }, after: { name: updated.name }, req });
  setFlash(req, 'success', 'Milestone updated.');
  res.redirect(`/projects/${project.id}`);
}

async function updateMilestoneProgress(req, res) {
  const project = await loadProjectOr404(req, res);
  if (!project) return;
  const milestone = await milestoneModel.findById(req.params.milestoneId);
  if (!milestone || milestone.projectId !== project.id) {
    return res.status(404).render('errors/404', { title: 'Milestone not found' });
  }
  if (!milestoneModel.canUpdateProgress(req.user, milestone)) {
    return res.status(403).render('errors/403', { title: 'Access denied' });
  }

  const status = String((req.body || {}).status || milestone.status);
  if (!MILESTONE_STATUSES.includes(status)) {
    setFlash(req, 'error', 'Invalid milestone status.');
    return res.redirect(`/projects/${project.id}`);
  }
  const progressPercentage = (req.body || {}).progressPercentage;
  const becameCompleted = status === 'Completed' && milestone.status !== 'Completed';

  await milestoneModel.updateProgress(milestone.id, { status, progressPercentage });
  await auditLogger.log({
    user: req.user, action: 'milestone.progress', entityType: 'milestone', entityId: milestone.id,
    before: { status: milestone.status, progress: milestone.progressPercentage },
    after: { status, progress: progressPercentage }, req,
  });

  if (becameCompleted) {
    const clientAdmins = await userModel.listAll({ role: ROLES.CLIENT_ADMIN, company: project.company });
    if (clientAdmins.length) {
      await notificationService.notify(clientAdmins.map((u) => u.id), {
        type: 'milestone_completed', title: `Milestone completed: ${milestone.name}`, body: `${project.name} — ${milestone.name}`,
        projectId: project.id, milestoneId: milestone.id,
      });
    }
  }

  setFlash(req, 'success', `${milestone.name} updated.`);
  res.redirect(`/projects/${project.id}`);
}

module.exports = {
  list, showCreateForm, create, detail, update, updateStatus,
  createMilestone, updateMilestone, updateMilestoneProgress,
};
