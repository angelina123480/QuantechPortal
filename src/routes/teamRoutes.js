const express = require('express');
const teamController = require('../controllers/teamController');
const { requireLogin, requireStaff } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');

const router = express.Router();

// Team leaders/admins get full read+act access; agents get their own team read-only
// (the controller scopes data by role — see resolveTeam in teamController.js).
router.get('/', requireLogin, requireStaff, asyncHandler(teamController.dashboard));
router.get('/sla', requireLogin, requireStaff, asyncHandler(teamController.sla));

module.exports = router;
