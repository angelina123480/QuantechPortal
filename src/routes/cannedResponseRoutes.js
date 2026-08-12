const express = require('express');
const cannedResponseController = require('../controllers/cannedResponseController');
const { requireLogin, requireStaff } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');

const router = express.Router();

router.get('/', requireLogin, requireStaff, asyncHandler(cannedResponseController.index));
router.post('/', requireLogin, requireStaff, asyncHandler(cannedResponseController.create));
router.post('/:id', requireLogin, requireStaff, asyncHandler(cannedResponseController.update));
router.post('/:id/delete', requireLogin, requireStaff, asyncHandler(cannedResponseController.remove));

module.exports = router;
