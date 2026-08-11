const express = require('express');
const profileController = require('../controllers/profileController');
const { requireLogin } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');

const router = express.Router();

router.get('/', requireLogin, profileController.show);
router.post('/', requireLogin, asyncHandler(profileController.updateInfo));
router.post('/password', requireLogin, asyncHandler(profileController.updatePassword));
router.post('/notifications', requireLogin, asyncHandler(profileController.updateNotifications));

module.exports = router;
