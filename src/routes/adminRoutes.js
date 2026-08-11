const express = require('express');
const adminController = require('../controllers/adminController');
const { requireLogin, requireStaff } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');

const router = express.Router();

router.get('/', requireLogin, requireStaff, asyncHandler(adminController.dashboard));
router.get('/export.csv', requireLogin, requireStaff, asyncHandler(adminController.exportCsv));

module.exports = router;
