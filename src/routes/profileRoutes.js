const express = require('express');
const profileController = require('../controllers/profileController');
const { requireLogin, requireStaff } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');

const router = express.Router();

router.get('/', requireLogin, profileController.show);
router.post('/', requireLogin, asyncHandler(profileController.updateInfo));
router.post('/password', requireLogin, asyncHandler(profileController.updatePassword));
router.post('/notifications', requireLogin, asyncHandler(profileController.updateNotifications));

router.post('/2fa/setup', requireLogin, requireStaff, asyncHandler(profileController.setupTwoFactor));
router.post('/2fa/confirm', requireLogin, requireStaff, asyncHandler(profileController.confirmTwoFactor));
router.post('/2fa/disable', requireLogin, requireStaff, asyncHandler(profileController.disableTwoFactor));

module.exports = router;
