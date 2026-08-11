const express = require('express');
const profileController = require('../controllers/profileController');
const { requireLogin } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireLogin, profileController.show);
router.post('/', requireLogin, profileController.updateInfo);
router.post('/password', requireLogin, profileController.updatePassword);
router.post('/notifications', requireLogin, profileController.updateNotifications);

module.exports = router;
