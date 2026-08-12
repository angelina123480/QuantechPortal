const express = require('express');
const teamController = require('../controllers/teamController');
const { requireLogin, requireManager } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');

const router = express.Router();

router.get('/', requireLogin, requireManager, asyncHandler(teamController.escalations));
router.post('/:id/resolve', requireLogin, requireManager, asyncHandler(teamController.resolveEscalation));

module.exports = router;
