const express = require('express');
const reportController = require('../controllers/reportController');
const { requireLogin, requireManager, requirePermission } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');

const router = express.Router();

router.get('/', requireLogin, requireManager, asyncHandler(reportController.index));
router.get('/export.csv', requireLogin, requireManager, requirePermission('export_reports'), asyncHandler(reportController.exportCsv));
router.get('/export.pdf', requireLogin, requireManager, requirePermission('export_reports'), asyncHandler(reportController.exportPdf));

module.exports = router;
