const express = require('express');
const userController = require('../controllers/company/userController');
const { requireLogin, requireRole } = require('../middleware/auth');
const { ROLES } = require('../config/constants');
const { asyncHandler } = require('../utils/asyncHandler');

const router = express.Router();
router.use(requireLogin, requireRole(ROLES.CLIENT_ADMIN));

router.get('/users', asyncHandler(userController.index));
router.post('/users', asyncHandler(userController.create));
router.get('/users/:id', asyncHandler(userController.show));
router.post('/users/:id', asyncHandler(userController.update));
router.post('/users/:id/status', asyncHandler(userController.setStatus));
router.post('/users/:id/resend-invite', asyncHandler(userController.resendInvite));

router.post('/sub-clients', asyncHandler(userController.createSubClient));
router.post('/sub-clients/:id', asyncHandler(userController.updateSubClient));
router.post('/sub-clients/:id/status', asyncHandler(userController.setSubClientStatus));

module.exports = router;
