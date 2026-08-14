const express = require('express');
const projectController = require('../controllers/projectController');
const { requireLogin, requireStaff, requireManager } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');

const router = express.Router();

// Reads are open to any logged-in role (staff see everything; clients are
// scoped to their company/sub-client via projectModel.canAccess/
// buildFilterClauses, mirroring ticketRoutes.js). Writes stay gated below.
router.get('/', requireLogin, asyncHandler(projectController.list));
// Registered before /:id so "new" is never captured as a project id.
router.get('/new', requireLogin, requireManager, asyncHandler(projectController.showCreateForm));
router.post('/', requireLogin, requireManager, asyncHandler(projectController.create));
router.get('/:id', requireLogin, asyncHandler(projectController.detail));
router.post('/:id', requireLogin, requireManager, asyncHandler(projectController.update));
router.post('/:id/status', requireLogin, requireManager, asyncHandler(projectController.updateStatus));

router.post('/:id/milestones', requireLogin, requireManager, asyncHandler(projectController.createMilestone));
router.post('/:id/milestones/:milestoneId', requireLogin, requireManager, asyncHandler(projectController.updateMilestone));
// Management OR the milestone's own assignee — checked inside the controller.
// requireStaff here is belt-and-suspenders: milestones are only ever assigned
// to staff, so a client would already be blocked by canUpdateProgress, but
// every other mutating route in this file is gated at the router level too.
router.post('/:id/milestones/:milestoneId/progress', requireLogin, requireStaff, asyncHandler(projectController.updateMilestoneProgress));

module.exports = router;
