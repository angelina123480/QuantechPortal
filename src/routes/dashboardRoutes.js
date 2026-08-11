const express = require('express');
const dashboardController = require('../controllers/dashboardController');
const { requireLogin } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');

const router = express.Router();

router.get('/dashboard', requireLogin, asyncHandler(dashboardController.index));

module.exports = router;
