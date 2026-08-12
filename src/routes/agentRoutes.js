const express = require('express');
const agentController = require('../controllers/agentController');
const { requireLogin, requireRole } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { ROLES } = require('../config/constants');

const router = express.Router();

router.get('/', requireLogin, requireRole(ROLES.AGENT), asyncHandler(agentController.dashboard));

module.exports = router;
