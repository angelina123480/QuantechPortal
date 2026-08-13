const express = require('express');
const taskController = require('../controllers/taskController');
const { requireLogin, requireStaff, requireManager } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');

const router = express.Router();
router.use(requireLogin, requireStaff);

router.get('/', asyncHandler(taskController.list));
router.post('/', asyncHandler(taskController.create));
router.post('/:id', asyncHandler(taskController.update));
router.post('/:id/status', asyncHandler(taskController.updateStatus));
router.post('/:id/checklist', asyncHandler(taskController.updateChecklist));
router.post('/:id/assign', requireManager, asyncHandler(taskController.assign));
router.post('/:id/delete', asyncHandler(taskController.remove));

module.exports = router;
