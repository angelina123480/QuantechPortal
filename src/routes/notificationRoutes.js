const express = require('express');
const notificationController = require('../controllers/notificationController');
const { requireLogin } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');

const router = express.Router();

router.get('/', requireLogin, asyncHandler(notificationController.index));
router.get('/unread-count', requireLogin, asyncHandler(notificationController.unreadCount));
router.get('/recent', requireLogin, asyncHandler(notificationController.recent));
router.post('/:id/read', requireLogin, asyncHandler(notificationController.markRead));
router.post('/:id/delete', requireLogin, asyncHandler(notificationController.remove));
router.post('/read-all', requireLogin, asyncHandler(notificationController.markAllRead));

module.exports = router;
