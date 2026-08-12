const express = require('express');
const kbController = require('../controllers/kbController');
const { requireLogin, requireAdmin, requirePermission } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');

const router = express.Router();

// Registered before /:id so these aren't captured as an id param.
router.get('/manage', requireLogin, requireAdmin, asyncHandler(kbController.manage));
router.get('/new', requireLogin, requireAdmin, asyncHandler(kbController.showCreateForm));
router.post('/', requireLogin, requireAdmin, asyncHandler(kbController.create));

router.get('/', requireLogin, asyncHandler(kbController.index));

router.get('/:id/edit', requireLogin, requireAdmin, asyncHandler(kbController.showEditForm));
router.post('/:id', requireLogin, requireAdmin, asyncHandler(kbController.update));
router.post('/:id/publish-toggle', requireLogin, requireAdmin, asyncHandler(kbController.togglePublish));
router.post('/:id/delete', requireLogin, requireAdmin, requirePermission('delete_kb_articles'), asyncHandler(kbController.remove));

router.get('/:id', requireLogin, asyncHandler(kbController.show));

module.exports = router;
