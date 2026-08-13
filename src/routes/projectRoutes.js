const express = require('express');
const projectController = require('../controllers/projectController');
const { requireLogin, requireStaff, requireManager } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');

const router = express.Router();
router.use(requireLogin, requireStaff);

router.get('/', asyncHandler(projectController.list));
// Registered before /:id so "new" is never captured as a project id.
router.get('/new', requireManager, asyncHandler(projectController.showCreateForm));
router.post('/', requireManager, asyncHandler(projectController.create));
router.get('/:id', asyncHandler(projectController.detail));
router.post('/:id', requireManager, asyncHandler(projectController.update));
router.post('/:id/status', requireManager, asyncHandler(projectController.updateStatus));

router.post('/:id/milestones', requireManager, asyncHandler(projectController.createMilestone));
router.post('/:id/milestones/:milestoneId', requireManager, asyncHandler(projectController.updateMilestone));
// Management OR the milestone's own assignee — checked inside the controller.
router.post('/:id/milestones/:milestoneId/progress', asyncHandler(projectController.updateMilestoneProgress));

module.exports = router;
