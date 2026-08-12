const express = require('express');
const analyticsController = require('../controllers/analyticsController');
const { requireLogin, requireManager } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');

const router = express.Router();

router.get('/', requireLogin, requireManager, asyncHandler(analyticsController.index));

module.exports = router;
