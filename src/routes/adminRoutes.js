const express = require('express');
const adminController = require('../controllers/adminController');
const userAdminController = require('../controllers/admin/userAdminController');
const companyAdminController = require('../controllers/admin/companyAdminController');
const departmentAdminController = require('../controllers/admin/departmentAdminController');
const teamAdminController = require('../controllers/admin/teamAdminController');
const categoryAdminController = require('../controllers/admin/categoryAdminController');
const slaAdminController = require('../controllers/admin/slaAdminController');
const workflowAdminController = require('../controllers/admin/workflowAdminController');
const permissionAdminController = require('../controllers/admin/permissionAdminController');
const auditLogController = require('../controllers/admin/auditLogController');
const { requireLogin, requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');

const router = express.Router();
router.use(requireLogin, requireAdmin);

router.get('/', asyncHandler(adminController.dashboard));
router.get('/export.csv', asyncHandler(adminController.exportCsv));

router.get('/users', asyncHandler(userAdminController.index));
router.post('/users', asyncHandler(userAdminController.create));
router.post('/users/:id', asyncHandler(userAdminController.update));
router.post('/users/:id/reset-password', asyncHandler(userAdminController.resetPassword));

router.get('/companies', asyncHandler(companyAdminController.index));
router.post('/companies', asyncHandler(companyAdminController.create));
router.get('/companies/:name', asyncHandler(companyAdminController.show));
router.post('/companies/:name', asyncHandler(companyAdminController.update));

router.get('/departments', asyncHandler(departmentAdminController.index));
router.post('/departments', asyncHandler(departmentAdminController.create));
router.post('/departments/:id', asyncHandler(departmentAdminController.update));

router.get('/teams', asyncHandler(teamAdminController.index));
router.post('/teams', asyncHandler(teamAdminController.create));
router.post('/teams/:id', asyncHandler(teamAdminController.update));

// /subcategories/:id/delete registered before /:name routes so "subcategories" is never captured as a category name.
router.post('/categories/subcategories/:id/delete', asyncHandler(categoryAdminController.removeSubcategory));
router.get('/categories', asyncHandler(categoryAdminController.index));
router.post('/categories', asyncHandler(categoryAdminController.create));
router.post('/categories/:name/subcategories', asyncHandler(categoryAdminController.addSubcategory));
router.post('/categories/:name/delete', asyncHandler(categoryAdminController.remove));

router.get('/sla', asyncHandler(slaAdminController.index));
router.post('/sla/business-hours', asyncHandler(slaAdminController.updateBusinessHours));
router.post('/sla/:priority', asyncHandler(slaAdminController.update));

router.get('/workflows', asyncHandler(workflowAdminController.index));
router.post('/workflows', asyncHandler(workflowAdminController.create));
router.post('/workflows/:id/toggle', asyncHandler(workflowAdminController.toggle));
router.post('/workflows/:id/delete', asyncHandler(workflowAdminController.remove));

router.get('/permissions', asyncHandler(permissionAdminController.index));
router.post('/permissions', asyncHandler(permissionAdminController.update));

router.get('/audit-logs', asyncHandler(auditLogController.index));

module.exports = router;
